"""
Procesador de Megamatriz Electivas → JSON estructurado + CSV de errores.

Entrada principal : hoja T1 (un curso por fila)
Hojas auxiliares  : T2 (competencias / rúbrica), T3 (saberes), T5 (referencias)
Tabla equivalencias: tipo de registro y código de departamento
"""

import csv
import getpass
import json
import os
import re
import socket
import time
from datetime import datetime
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv


# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------

def cargar_configuracion() -> dict:
    load_dotenv()
    claves = {
        "input_path":       "INPUT_FILE_PATH",
        "input_name":       "INPUT_FILE_NAME",
        "output_json_path": "OUTPUT_JSON_PATH",
        "output_csv_path":  "OUTPUT_CSV_PATH",
        "equiv_file":       "EQUIV_FILE_PATH",
    }
    config = {}
    faltantes = []
    for clave_python, var_env in claves.items():
        valor = os.getenv(var_env, "").strip()
        if not valor:
            faltantes.append(var_env)
        config[clave_python] = valor
    if faltantes:
        raise ValueError(
            f"Variables de entorno requeridas no encontradas: {', '.join(faltantes)}"
        )
    return config


# ---------------------------------------------------------------------------
# Lectura de archivos
# ---------------------------------------------------------------------------

def leer_megamatriz(ruta_archivo: str) -> dict[str, pd.DataFrame]:
    return pd.read_excel(ruta_archivo, sheet_name=None)


def leer_equivalencias(ruta_archivo: str) -> tuple[dict, dict]:
    """
    Retorna dos dicts:
      mapa_tipo_registro : nombre_registro → codigo
      mapa_departamento  : nombre_departamento → codigo_departamento
    """
    df = pd.read_excel(ruta_archivo, sheet_name="Hoja1", header=None)

    mapa_tipo_registro: dict[str, str] = {}
    mapa_departamento: dict[str, str] = {}

    for i in range(1, len(df)):
        nombre_tr = str(df.iloc[i, 0]).strip()
        codigo_tr = str(df.iloc[i, 1]).strip()
        if nombre_tr not in ("", "nan") and codigo_tr not in ("", "nan"):
            mapa_tipo_registro[nombre_tr] = codigo_tr

        codigo_dep = str(df.iloc[i, 4]).strip()
        nombre_dep = str(df.iloc[i, 5]).strip()
        if codigo_dep not in ("", "nan") and nombre_dep not in ("", "nan"):
            mapa_departamento[nombre_dep] = codigo_dep

    return mapa_tipo_registro, mapa_departamento


def construir_mapa_programa(df_t1: pd.DataFrame) -> dict[str, str]:
    """
    Regla 4: Source.Name (T1) → Programa (T1).
    Permite que, al construir competencias desde T2, se obtenga
    el nombre del programa cruzando por Source.Name.
    """
    mapa: dict[str, str] = {}
    for _, row in df_t1.iterrows():
        source = limpiar_str(row.get("Source.Name", ""))
        programa = limpiar_str(row.get("Programa", ""))
        if source and source not in mapa:
            mapa[source] = programa
    return mapa


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

NIVEL_CODIGOS: dict[str, str] = {
    "Introducir": "I",
    "Consolidar": "C",
    "Dominar":    "D",
    "Saber":      "S",
}

# Columnas de rasgo en T1 → nombre corto que va al JSON
RASGOS_MAP: dict[str, str] = {
    "Rasgo Actitud Humanizadora (AH)":          "Actitud Humanizadora",
    "Rasgo Conexi\u00f3n con el Entorno (CE)":  "Conexi\u00f3n con el Entorno",
    "Rasgo Conexi\u00f3n Global (CG)":           "Conexi\u00f3n Global",
    "Rasgo Cointeligencia (CI)":                 "Cointeligencia",
}

NO_APLICA = {"no aplica", "no aplica.", "nan", "", "none"}

# Prefijos para los niveles de la rúbrica
PREFIJOS_NIVEL = {
    "Inicial":     "Inicial - ",
    "Progresivo":  "Progresivo - ",
    "Avanzado":    "Avanzado - ",
    "Excelente":   "Excelente - ",
}


def es_vacio(valor) -> bool:
    if valor is None:
        return True
    try:
        if pd.isna(valor):
            return True
    except (TypeError, ValueError):
        pass
    return str(valor).strip().lower() in NO_APLICA


def es_vacio_estricto(valor) -> bool:
    """Vacío estricto: solo NaN/None/string vacío. No filtra 'No aplica'."""
    if valor is None:
        return True
    try:
        if pd.isna(valor):
            return True
    except (TypeError, ValueError):
        pass
    s = str(valor).strip()
    return s in ("", "nan", "none")


def a_int(valor, default: int = 0) -> int:
    try:
        return int(float(str(valor).strip()))
    except (ValueError, TypeError):
        return default


def limpiar_str(valor) -> str:
    """
    Regla 2: elimina saltos de línea y normaliza espacios.
    Retorna cadena vacía si el valor es nulo o NaN.
    """
    if es_vacio_estricto(valor):
        return ""
    texto = str(valor).replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    texto = re.sub(r" {2,}", " ", texto).strip()
    return texto


def html_wrap(valor) -> str | None:
    texto = limpiar_str(valor)
    if not texto:
        return None
    return f"<p>{texto}<br/></p>"


def siga_id_a_str(valor) -> str:
    """Convierte 676106.0 → '676106'."""
    return str(int(float(str(valor).strip())))


def extraer_codigo_meta(id_indicador: str) -> str:
    """
    Busca la primera parte del ID que empiece con 'M' seguido de dígitos
    (ej. M012, M017) y retorna desde esa parte hasta el final.
    Ej: IND001_CE_RA001_M012_UX_INS → M012_UX_INS

    Caso especial: si termina en SABE → retorna 'SABE'.
    Fallback (sin patrón M+dígitos): retorna las últimas 2 partes.
    """
    partes = id_indicador.strip().split("_")
    if partes[-1].upper() == "SABE":
        return "SABE"
    for i, p in enumerate(partes):
        if re.match(r"^M\d+$", p):
            return "_".join(partes[i:])
    return "_".join(partes[-2:])


def extraer_codigo_ra(id_indicador: str) -> str:
    """
    Busca la primera parte del ID que empiece con 'RA' seguido de dígitos
    (ej. RA001) y retorna desde esa parte hasta el final.
    Ej: IND001_CE_RA001_M012_UX_INS → RA001_M012_UX_INS

    Caso especial: si termina en SABE → retorna las últimas 2 partes.
    Fallback (sin patrón RA+dígitos): retorna las últimas 3 partes.
    """
    partes = id_indicador.strip().split("_")
    if partes[-1].upper() == "SABE":
        return "_".join(partes[-2:])
    for i, p in enumerate(partes):
        if re.match(r"^RA\d+$", p):
            return "_".join(partes[i:])
    return "_".join(partes[-3:])


def extraer_rasgos(fila: pd.Series) -> list[str]:
    """
    Columnas M-P de T1: Rasgo AH, CE, CG, CI.
    Si la celda contiene exactamente (o incluye) 'Tiene el rasgo',
    se agrega al arreglo el nombre corto del rasgo que corresponde
    a esa columna. Puede haber varios rasgos activos por registro.
    """
    rasgos = []
    for col_nombre, rasgo_corto in RASGOS_MAP.items():
        # Acepta "Tiene el rasgo", "tiene el rasgo", "tiene " y cualquier
        # variante truncada que comience con la palabra "tiene".
        valor = str(fila.get(col_nombre, "")).strip().lower()
        if valor.startswith("tiene"):
            rasgos.append(rasgo_corto)
    return rasgos


def construir_lista_texto(valor) -> list[str]:
    """
    Convierte un campo de texto (Presaberes / Cosaberes) en un array.
    Si el valor es nulo/vacío retorna lista vacía.
    """
    texto = limpiar_str(valor)
    if not texto:
        return []
    return [texto]


# ---------------------------------------------------------------------------
# Construcción de sub-estructuras
# ---------------------------------------------------------------------------

COL_CATALOGO = "N\u00famero de cat\u00e1logo"


def construir_saberes(
    num_catalogo: str,
    df_t3: pd.DataFrame,
    errores: list[dict],
) -> list[dict]:
    """
    Regla 1: valida que 'Saber' y 'Descripción' no sean 0 ni vacíos.
    Registra error en la lista compartida si la validación falla.
    """
    mask = df_t3[COL_CATALOGO].astype(str).str.strip() == num_catalogo.strip()
    saberes = []

    for idx, row in df_t3[mask].iterrows():
        fila_excel = idx + 2  # +1 header, +1 base-1
        titulo = limpiar_str(row.get("Saber", ""))
        desc   = limpiar_str(row.get("Descripci\u00f3n", ""))

        # Validación: valor 0 o vacío/nulo
        saber_raw = row.get("Saber", "")
        desc_raw  = row.get("Descripci\u00f3n", "")

        saber_invalido = (
            es_vacio_estricto(saber_raw)
            or str(saber_raw).strip() == "0"
            or not titulo
        )
        desc_invalida = (
            es_vacio_estricto(desc_raw)
            or str(desc_raw).strip() == "0"
            or not desc
        )

        if saber_invalido or desc_invalida:
            errores.append({
                "hoja":  "T3",
                "fila":  fila_excel,
                "error": "El valor en el campo 'Saber' o 'Descripci\u00f3n' no es v\u00e1lido",
            })
            continue

        saberes.append({"titulo": titulo, "descripcion": desc})

    return saberes


def construir_referencias(
    num_catalogo: str,
    df_t5: pd.DataFrame,
    errores: list[dict],
) -> list[dict]:
    """
    Regla 1: valida que 'Referencia' no sea 0 ni vacía.
    """
    mask = df_t5[COL_CATALOGO].astype(str).str.strip() == num_catalogo.strip()
    referencias = []

    for idx, row in df_t5[mask].iterrows():
        fila_excel = idx + 2
        ref_raw = row.get("Referencia", "")
        texto   = limpiar_str(ref_raw)

        if es_vacio_estricto(ref_raw) or str(ref_raw).strip() == "0" or not texto:
            errores.append({
                "hoja":  "T5",
                "fila":  fila_excel,
                "error": "El valor en el campo 'Referencia' no es v\u00e1lido",
            })
            continue

        url = row.get("URL", None)
        referencias.append({
            "texto": texto,
            "url":   None if es_vacio_estricto(url) else limpiar_str(url),
        })

    return referencias


def construir_competencias(
    num_catalogo: str,
    df_t2: pd.DataFrame,
    mapa_programa: dict[str, str],
) -> list[dict]:
    """
    Regla 4: el nombre del programa se obtiene cruzando Source.Name de T2
    con la hoja T1 para obtener el campo Programa.

    Lógica de ID:
    - Si 'ID Indicador equivalente' tiene valor → se usa como código del
      indicador, tipo='Homologado', codigoHomologado='ID Indicador principal'.
    - Si 'ID Indicador equivalente' está vacío → se usa 'ID Indicador principal'
      como código, tipo='Principal', codigoHomologado='No Aplica'.
    - Si ambos están vacíos → la fila se omite.
    """
    mask = df_t2[COL_CATALOGO].astype(str).str.strip() == num_catalogo.strip()
    competencias = []

    for _, row in df_t2[mask].iterrows():
        id_equivalente = limpiar_str(row.get("ID Indicador equivalente", ""))
        id_principal   = limpiar_str(row.get("ID Indicador principal", ""))

        if id_equivalente:
            # Camino homologado: se usa el ID equivalente como código
            id_ind         = id_equivalente
            tipo           = "Homologado"
            codigo_homolog = id_principal
        elif id_principal:
            # Camino principal: se usa el ID principal como código
            id_ind         = id_principal
            tipo           = "Principal"
            codigo_homolog = "No Aplica"
        else:
            # Sin ningún ID válido → omitir fila
            continue

        nivel_nombre = limpiar_str(row.get("Nivel de logro", ""))
        nivel_cod    = NIVEL_CODIGOS.get(nivel_nombre, nivel_nombre)

        # Regla 4: nombre del programa desde T1 vía Source.Name
        source_name = limpiar_str(row.get("Source.Name", ""))
        nombre_prog = mapa_programa.get(source_name, source_name)

        competencias.append({
            "programa": {
                "nombre": nombre_prog,
                "codigo": source_name,
            },
            "metaCompetencia": {
                "titulo": limpiar_str(row.get("Metacompetencia", "")),
                "codigo": extraer_codigo_meta(id_ind),
            },
            "indicadorDesempeno": {
                "descripcion":      limpiar_str(row.get("Indicador de desempe\u00f1o", "")),
                "codigo":           id_ind,
                "tipo":             tipo,
                "codigoHomologado": codigo_homolog,
            },
            "nivel": {
                "nivel":  nivel_nombre,
                "codigo": nivel_cod,
            },
            "resultadoAprendizaje": {
                "descripcion": limpiar_str(row.get("Resultados de aprendizaje", "")),
                "codigo":      extraer_codigo_ra(id_ind),
            },
        })

    return competencias


def construir_rubrica(
    num_catalogo: str,
    df_t2: pd.DataFrame,
) -> list[dict]:
    """
    Solo genera registros donde 'ID Indicador equivalente' está vacío
    y 'ID Indicador principal' tiene valor (camino principal puro).
    El valor de cada nivel lleva el prefijo 'NivelNombre - '.
    Antes de agregar un registro valida duplicados: si ya existe uno con
    el mismo 'codigo' o la misma 'descripcion' en indicadorDesempeno,
    el nuevo se omite.
    """
    mask = df_t2[COL_CATALOGO].astype(str).str.strip() == num_catalogo.strip()
    rubrica = []
    vistos_codigo = set()
    vistos_desc   = set()

    for _, row in df_t2[mask].iterrows():
        id_equivalente = limpiar_str(row.get("ID Indicador equivalente", ""))
        id_principal   = limpiar_str(row.get("ID Indicador principal", ""))

        # Solo filas donde el equivalente está vacío y el principal tiene valor
        if id_equivalente or not id_principal:
            continue

        descripcion = limpiar_str(row.get("Indicador de desempe\u00f1o", ""))

        # Validación de duplicados: omitir si codigo o descripcion ya existen
        if id_principal in vistos_codigo or descripcion in vistos_desc:
            continue

        vistos_codigo.add(id_principal)
        if descripcion:
            vistos_desc.add(descripcion)

        def nivel_texto(col: str) -> str:
            prefijo = PREFIJOS_NIVEL.get(col, f"{col} - ")
            valor   = limpiar_str(row.get(col, ""))
            return f"{prefijo}{valor}" if valor else ""

        rubrica.append({
            "indicadorDesempeno": {
                "descripcion": descripcion,
                "codigo":      id_principal,
            },
            "nivelInicial":    nivel_texto("Inicial")    or None,
            "nivelProgresivo": nivel_texto("Progresivo") or None,
            "nivelAvanzado":   nivel_texto("Avanzado")   or None,
            "nivelExcelente":  nivel_texto("Excelente")  or None,
        })

    return rubrica


# ---------------------------------------------------------------------------
# Construcción del registro completo de un curso
# ---------------------------------------------------------------------------

def construir_registro(
    fila: pd.Series,
    df_t2: pd.DataFrame,
    df_t3: pd.DataFrame,
    df_t5: pd.DataFrame,
    mapa_tipo_registro: dict,
    mapa_departamento: dict,
    mapa_programa: dict,
    errores: list[dict],
) -> dict:
    num_catalogo = limpiar_str(fila.get("N\u00famero de cat\u00e1logo", ""))
    id_siga      = siga_id_a_str(fila["ID SIGA"])

    dept_nombre = limpiar_str(fila.get("Departamento que oferta el espacio acad\u00e9mico", ""))
    dept_codigo = mapa_departamento.get(dept_nombre, "")

    tipo_reg_nombre = limpiar_str(fila.get("Tipo de registro", ""))
    tipo_reg_codigo = mapa_tipo_registro.get(tipo_reg_nombre, tipo_reg_nombre)

    aula  = a_int(fila.get("Aula", 0))
    otro  = a_int(fila.get("Otro", 0))
    teor  = a_int(fila.get("Te\u00f3rico", 0))
    htp   = a_int(fila.get("Horas te\u00f3rico-pr\u00e1cticas", 0))

    return {
        "idCursoSiga":  id_siga,
        "nombreCurso":  limpiar_str(fila.get("M\u00f3dulo o espacio acad\u00e9mico", "")),
        "creditos":     a_int(fila.get("Cr\u00e9ditos", 0)),
        "horas": {
            "Directas": {
                "FisicoSincronico":   aula + otro,
                "FisicoAsincronico":  a_int(fila.get("F\u00edsico asinc\u00f3nico", 0)),
                "VirtualSincronico":  a_int(fila.get("Virtual sinc\u00f3nico", 0)),
                "VirtualAsincronico": a_int(fila.get("Virtual asinc\u00f3nico", 0)),
                "Hyflex":             a_int(fila.get("Hyflex", 0)),
            },
            "TeoricoPracticas":     teor + htp,
            "Practicas":            a_int(fila.get("Horas pr\u00e1cticas", 0)),
            "TrabajoIndependiente": a_int(fila.get("Horas de trabajo independiente (HTI)", 0)),
            "Total":                a_int(fila.get("Horas totales (HTT)", 0)),
        },
        "departamento": {
            "nombre": dept_nombre,
            "codigo": dept_codigo,
        },
        "idioma":      limpiar_str(fila.get("Idioma", "")),
        "descripcion": limpiar_str(fila.get("Descripci\u00f3n de la asignatura o espacio acad\u00e9mico", "")) or None,
        "nivelFormacion":   limpiar_str(fila.get("nivelFormacion", "")),
        "EspacioAcademico": limpiar_str(fila.get("EspacioAcademico", "")),
        "modalidad":   limpiar_str(fila.get("Modalidad", "")),
        "metodologia": limpiar_str(fila.get("Metodolog\u00eda de aprendizaje experiencial", "")),
        "gradoInternacionalizacion": None,
        "tipoDeRegistro": tipo_reg_codigo,
        "saberes":    construir_saberes(num_catalogo, df_t3, errores),
        "referencias": construir_referencias(num_catalogo, df_t5, errores),
        "UX": {
            "competenciaCertificable": html_wrap(fila.get("Competencia Certificable", "")),
            "desCompetencia":          html_wrap(fila.get("Descripci\u00f3n de Competencia Certificable", "")),
            "rasgos":                  extraer_rasgos(fila),
            "clasificador":            limpiar_str(fila.get("Clasificador de M\u00f3dulo", "")),
        },
        "competencias":      construir_competencias(num_catalogo, df_t2, mapa_programa),
        "rubricaEvaluacion": construir_rubrica(num_catalogo, df_t2),
        "prerrequisitos":    construir_lista_texto(fila.get("Presaberes", "")),
        "correquisitos":     construir_lista_texto(fila.get("Cosaberes", "")),
    }


# ---------------------------------------------------------------------------
# Orquestador principal
# ---------------------------------------------------------------------------

def procesar(config: dict) -> None:
    t_inicio = time.perf_counter()
    ruta_entrada = Path(config["input_path"]) / config["input_name"]
    ruta_json    = Path(config["output_json_path"]) / "salida.json"
    ruta_csv     = Path(config["output_csv_path"]) / "errores.csv"

    Path(config["output_json_path"]).mkdir(parents=True, exist_ok=True)
    Path(config["output_csv_path"]).mkdir(parents=True, exist_ok=True)

    print(f"[INFO] Leyendo archivo principal: {ruta_entrada}")
    sheets = leer_megamatriz(str(ruta_entrada))

    df_t1 = sheets.get("T1", pd.DataFrame())
    df_t2 = sheets.get("T2", pd.DataFrame())
    df_t3 = sheets.get("T3", pd.DataFrame())
    df_t5 = sheets.get("T5", pd.DataFrame())

    print(f"[INFO] Leyendo tabla de equivalencias: {config['equiv_file']}")
    mapa_tipo_registro, mapa_departamento = leer_equivalencias(config["equiv_file"])

    # Regla 4: construir mapa Source.Name → Programa desde T1
    mapa_programa = construir_mapa_programa(df_t1)

    errores: list[dict] = []
    resultado: dict = {"status": True, "data": {}}
    procesados = 0

    for idx, fila in df_t1.iterrows():
        fila_num = idx + 2  # fila Excel: +1 header, +1 base-1

        id_siga_raw = fila.get("ID SIGA", None)

        # Validación crítica: ID SIGA vacío o nulo
        if es_vacio_estricto(id_siga_raw):
            errores.append({
                "hoja":  "T1",
                "fila":  fila_num,
                "error": "no se puede procesar por falta de creaci\u00f3n en siga",
            })
            continue

        try:
            registro = construir_registro(
                fila, df_t2, df_t3, df_t5,
                mapa_tipo_registro, mapa_departamento,
                mapa_programa, errores,
            )
            resultado["data"][registro["idCursoSiga"]] = registro
            procesados += 1
        except Exception as exc:
            errores.append({
                "hoja":  "T1",
                "fila":  fila_num,
                "error": f"Error inesperado al procesar: {exc}",
            })

    # Capturar usuario y equipo para la cabecera del JSON
    try:
        usuario = getpass.getuser()
    except Exception:
        usuario = os.getenv("USERNAME") or os.getenv("USER") or "desconocido"
    try:
        equipo = socket.gethostname()
    except Exception:
        equipo = "desconocido"
    fecha_gen = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cabecera = (
        f"/* ============================================================\n"
        f"   Generado por  : {usuario}\n"
        f"   Equipo        : {equipo}\n"
        f"   Fecha         : {fecha_gen}\n"
        f"   Archivo fuente: {ruta_entrada.name}\n"
        f"   ============================================================ */\n"
    )

    # Escribir JSON de salida con cabecera de auditoría
    with open(ruta_json, "w", encoding="utf-8") as f:
        f.write(cabecera)
        json.dump(resultado, f, ensure_ascii=False, indent=2)
    print(f"[OK] JSON generado en: {ruta_json}")

    # Escribir CSV de errores (columnas: hoja, fila, error)
    with open(ruta_csv, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["hoja", "fila", "error"])
        writer.writeheader()
        writer.writerows(errores)
    print(f"[OK] CSV de errores en: {ruta_csv}")

    t_fin = time.perf_counter()
    elapsed_ms = (t_fin - t_inicio) * 1000

    print(f"\n--- Resumen ---")
    print(f"  Registros procesados : {procesados}")
    print(f"  Errores registrados  : {len(errores)}")
    print(f"    - T1 (ID SIGA)     : {sum(1 for e in errores if e['hoja'] == 'T1')}")
    print(f"    - T3 (Saberes)     : {sum(1 for e in errores if e['hoja'] == 'T3')}")
    print(f"    - T5 (Referencias) : {sum(1 for e in errores if e['hoja'] == 'T5')}")
    print(f"  Total filas T1       : {len(df_t1)}")
    if elapsed_ms < 1000:
        print(f"  Tiempo de ejecucion : {elapsed_ms:.1f} ms")
    else:
        print(f"  Tiempo de ejecucion : {elapsed_ms / 1000:.3f} s ({elapsed_ms:.0f} ms)")


# ---------------------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    try:
        cfg = cargar_configuracion()
        procesar(cfg)
    except Exception as e:
        print(f"[ERROR FATAL] {e}")
        raise
