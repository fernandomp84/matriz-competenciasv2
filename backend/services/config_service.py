"""
Gestión persistente del archivo de equivalencias.
Carga automáticamente al inicio; permite actualización vía API.
"""
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Ruta guardada (sobrevive reinicios)
_SAVED_PATH = Path(__file__).parent.parent / "data" / "equivalencias.xlsx"
# Ruta por defecto del proyecto original (solo existe en local: *.xlsx no se versiona)
_DEFAULT_PATH = Path(__file__).parent.parent.parent / "Entrada" / "Tabla de equivalencias.xlsx"
# Copia versionada en el repo: en Render el disco se borra en cada reinicio, así que sin
# esta copia el servidor público arrancaría sin equivalencias tras cada "despertar".
_BUNDLED_PATH = Path(__file__).parent.parent / "equivalencias_default.xlsx"

_equiv_bytes: bytes | None = None


def get_equiv_bytes() -> bytes | None:
    return _equiv_bytes


def is_configured() -> bool:
    return _equiv_bytes is not None


def load_default() -> bool:
    """Carga las equivalencias al arrancar el servidor."""
    global _equiv_bytes

    for path in [_SAVED_PATH, _DEFAULT_PATH, _BUNDLED_PATH]:
        if path.exists():
            try:
                _equiv_bytes = path.read_bytes()
                logger.info(f"Equivalencias cargadas desde: {path}")
                return True
            except Exception as exc:
                logger.warning(f"No se pudo leer {path}: {exc}")

    logger.warning("Equivalencias no encontradas. Configúrelas desde la UI.")
    return False


def update(new_bytes: bytes) -> None:
    """Actualiza en memoria y persiste en disco."""
    global _equiv_bytes
    _equiv_bytes = new_bytes
    _SAVED_PATH.parent.mkdir(parents=True, exist_ok=True)
    _SAVED_PATH.write_bytes(new_bytes)
    logger.info(f"Equivalencias actualizadas y guardadas en: {_SAVED_PATH}")
