import io
import json
import re

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

from ..services import config_service, matriz_service, megamatriz_service

router = APIRouter(prefix="/process", tags=["processing"])


@router.post("/debug-sabe")
async def debug_sabe(
    main_file: UploadFile = File(...),
):
    """Diagnóstico: muestra los valores de programa.codigo para competencias SABE."""
    try:
        equiv = config_service.get_equiv_bytes()
        if not equiv:
            raise HTTPException(400, "Equivalencias no configuradas")
        main_bytes = await main_file.read()
        result = megamatriz_service.procesar(main_bytes, equiv, main_file.filename or "archivo.xlsx")
        sabe_entries = []
        for id_siga, curso in result["resultado"]["data"].items():
            for comp in curso.get("competencias", []):
                if comp.get("metaCompetencia", {}).get("codigo") == "SABE":
                    sabe_entries.append({
                        "idCursoSiga": id_siga,
                        "nombreCurso": curso.get("nombreCurso", ""),
                        "programa_codigo": comp.get("programa", {}).get("codigo", ""),
                        "programa_nombre": comp.get("programa", {}).get("nombre", ""),
                        "indicador_codigo": comp.get("indicadorDesempeno", {}).get("codigo", ""),
                    })
        return {
            "total_sabe": len(sabe_entries),
            "muestra": sabe_entries[:10],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc


@router.post("/preview-tm")
async def preview_tm(
    main_file: UploadFile = File(..., description="Archivo Excel Megamatriz (.xlsx)"),
):
    """Lee solo la hoja TM y devuelve los datos para verificación antes de procesar."""
    try:
        main_bytes = await main_file.read()
        sheets = pd.read_excel(io.BytesIO(main_bytes), sheet_name=None)
        hojas = list(sheets.keys())
        mapa_tm = megamatriz_service.leer_tm(sheets)
        return {
            "hojas": hojas,
            "tmEncontrada": "TM" in sheets,
            "tmEntradas": mapa_tm,
            "total": len(mapa_tm),
        }
    except Exception as exc:
        raise HTTPException(500, f"Error al leer el archivo: {exc}") from exc


def _require_equiv() -> bytes:
    equiv = config_service.get_equiv_bytes()
    if equiv is None:
        raise HTTPException(
            400,
            "La tabla de equivalencias no está configurada. "
            "Ve a la sección 'Actualizar equivalencias' y sube el archivo.",
        )
    return equiv


@router.post("/megamatriz")
async def process_megamatriz(
    main_file: UploadFile = File(..., description="Archivo Excel Megamatriz (.xlsx)"),
):
    if not (main_file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "main_file debe ser un archivo Excel (.xlsx)")
    try:
        equiv_bytes = _require_equiv()
        main_bytes = await main_file.read()
        return megamatriz_service.procesar(main_bytes, equiv_bytes, main_file.filename or "archivo.xlsx")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Error al procesar el archivo: {exc}") from exc


@router.post("/matrix")
async def process_matrix(
    json_file: UploadFile = File(..., description="JSON generado por megamatriz (.json)"),
):
    if not (json_file.filename or "").lower().endswith(".json"):
        raise HTTPException(400, "json_file debe ser un archivo JSON (.json)")
    try:
        raw = (await json_file.read()).decode("utf-8", errors="replace")
        raw = re.sub(r"^/\*.*?\*/\s*", "", raw, flags=re.DOTALL)
        raw = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", raw)
        json_data = json.loads(raw)
        return matriz_service.procesar(json_data)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, f"Archivo JSON inválido: {exc}") from exc
    except Exception as exc:
        raise HTTPException(500, f"Error al procesar: {exc}") from exc


@router.post("/full")
async def process_full(
    main_file: UploadFile = File(...),
):
    """Ejecuta ambos pasos en secuencia y devuelve los resultados combinados."""
    try:
        equiv_bytes = _require_equiv()
        main_bytes = await main_file.read()
        mega_result = megamatriz_service.procesar(
            main_bytes, equiv_bytes, main_file.filename or "archivo.xlsx"
        )
        matrix_result = matriz_service.procesar(mega_result["resultado"])
        return {"megamatriz": mega_result, "matrix": matrix_result}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Error al procesar: {exc}") from exc
