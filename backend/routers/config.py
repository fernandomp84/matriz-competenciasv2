from fastapi import APIRouter, File, HTTPException, UploadFile

from ..services import config_service

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/equivalencias/status")
def equiv_status():
    return {
        "configured": config_service.is_configured(),
        "message": "Equivalencias cargadas correctamente"
        if config_service.is_configured()
        else "Equivalencias no configuradas — sube el archivo desde la UI",
    }


@router.put("/equivalencias")
async def update_equivalencias(
    file: UploadFile = File(..., description="Tabla de equivalencias (.xlsx)"),
):
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "El archivo debe ser Excel (.xlsx)")
    try:
        data = await file.read()
        config_service.update(data)
        return {"status": "ok", "message": "Equivalencias actualizadas correctamente"}
    except Exception as exc:
        raise HTTPException(500, f"Error al procesar equivalencias: {exc}") from exc
