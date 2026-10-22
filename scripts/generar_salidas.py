"""
Genera en local los 3 archivos de salida a partir de un Omnia, con la misma lógica del backend v2:

    Salida/salida.json
    Salida/Matriz_Competencias.csv
    Salida/Errores_Megamatriz.xlsx

Uso (desde la carpeta Matriz 2):
    python scripts/generar_salidas.py "Entrada/Omnia2.xlsx" [--salida <carpeta>]

La Tabla de equivalencias se toma de Entrada/Tabla de equivalencias.xlsx.
"""
import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from backend.services import matriz_service  # noqa: E402
from backend.services import megamatriz_service as mm  # noqa: E402
from backend.services import reporte_service  # noqa: E402

SALIDA = os.path.join(ROOT, "Salida")
EQUIV = os.path.join(ROOT, "Entrada", "Tabla de equivalencias.xlsx")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("omnia")
    ap.add_argument("--salida", default=SALIDA, help="Carpeta de salida (por defecto Salida/)")
    args = ap.parse_args()
    omnia = os.path.abspath(args.omnia)
    salida = os.path.abspath(args.salida)
    os.makedirs(salida, exist_ok=True)
    with open(omnia, "rb") as f:
        datos = f.read()
    with open(EQUIV, "rb") as f:
        equiv = f.read()
    fecha = datetime.fromtimestamp(os.path.getmtime(omnia)).strftime("%Y-%m-%d %H:%M")
    archivo = f"{os.path.basename(omnia)} ({fecha})"

    sheets = mm.leer_hojas(datos)
    r = mm.procesar_hojas(sheets, equiv, os.path.basename(omnia))
    m = matriz_service.procesar(r["resultado"])
    with open(os.path.join(salida, "salida.json"), "w", encoding="utf-8") as f:
        json.dump(r["resultado"], f, ensure_ascii=False, indent=2)
    with open(os.path.join(salida, "Matriz_Competencias.csv"), "w", encoding="utf-8-sig", newline="") as f:
        f.write(m["csvContent"])
    with open(os.path.join(salida, "Errores_Megamatriz.xlsx"), "wb") as f:
        f.write(reporte_service.generar_reporte_xlsx(sheets, r, m, archivo))

    st = r["stats"]
    tipos = Counter(reporte_service.tipo_error(e) for e in r["errores"] + r["advertencias"])
    print(f"Archivo: {archivo}")
    print(f"Cursos únicos: {st['cursosUnicosT1']} | procesados: {st['procesados']} | omitidos: {st['cursosOmitidos']}")
    print(f"Indicadores en conflicto: {st['indicadoresOmitidos']} | indicadores en la matriz: {m['stats']['totalFilas']}")
    print("Errores y advertencias:", dict(tipos))
    print("Archivos generados en", salida)


if __name__ == "__main__":
    main()
