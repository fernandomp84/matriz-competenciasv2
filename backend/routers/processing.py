import base64
import json
import re
from datetime import datetime

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..services import config_service, matriz_service, megamatriz_service, reporte_service

router = APIRouter(prefix="/process", tags=["processing"])


@router.post("/preview")
async def preview(
    main_file: UploadFile = File(..., description="Archivo Excel Omnia (.xlsx)"),
):
    """Análisis completo previo: revisión + resultados + reporte de errores (sin procesar dos veces)."""
    try:
        equiv_bytes = _require_equiv()
        main_bytes = await main_file.read()
        sheets = megamatriz_service.leer_hojas(main_bytes)
        prev = megamatriz_service.previsualizar_hojas(sheets)
        if prev["faltantes"]:
            return {**prev, "megamatriz": None, "matrix": None}
        mega, matriz = _procesar_hojas_con_reporte(
            sheets, equiv_bytes, main_file.filename or "archivo.xlsx"
        )
        return {**prev, "megamatriz": mega, "matrix": matriz}
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
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


def _procesar_con_reporte(main_bytes: bytes, equiv_bytes: bytes, filename: str) -> tuple[dict, dict]:
    """Lee el Excel una vez; devuelve (resultado megamatriz con reporteXlsxB64, resultado matriz)."""
    sheets = megamatriz_service.leer_hojas(main_bytes)
    return _procesar_hojas_con_reporte(sheets, equiv_bytes, filename)


def _procesar_hojas_con_reporte(sheets: dict, equiv_bytes: bytes, filename: str) -> tuple[dict, dict]:
    """Igual que _procesar_con_reporte sobre hojas ya leídas."""
    mega = megamatriz_service.procesar_hojas(sheets, equiv_bytes, filename)
    matriz = matriz_service.procesar(mega["resultado"])
    archivo = f"{filename} ({datetime.now().strftime('%Y-%m-%d %H:%M')})"
    xlsx = reporte_service.generar_reporte_xlsx(sheets, mega, matriz, archivo)
    mega["reporteXlsxB64"] = base64.b64encode(xlsx).decode("ascii")
    return mega, matriz


@router.post("/megamatriz")
async def process_megamatriz(
    main_file: UploadFile = File(..., description="Archivo Excel Megamatriz (.xlsx)"),
):
    if not (main_file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "main_file debe ser un archivo Excel (.xlsx)")
    try:
        equiv_bytes = _require_equiv()
        main_bytes = await main_file.read()
        mega, _ = _procesar_con_reporte(main_bytes, equiv_bytes, main_file.filename or "archivo.xlsx")
        return mega
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
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
        mega_result, matrix_result = _procesar_con_reporte(
            main_bytes, equiv_bytes, main_file.filename or "archivo.xlsx"
        )
        return {"megamatriz": mega_result, "matrix": matrix_result}
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(500, f"Error al procesar: {exc}") from exc
