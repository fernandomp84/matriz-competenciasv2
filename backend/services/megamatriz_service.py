"""
Servicio de procesamiento de Megamatriz Electivas.
Adaptado de procesar_megamatriz.py para funcionar con FastAPI (bytes en memoria).
"""

import getpass
import io
import os
import re
import socket
import time
import unicodedata
from datetime import datetime

import pandas as pd


# ── Constantes ─────────────────────────────────────────────────────────────────

NIVEL_CODIGOS: dict[str, str] = {
    "Introducir": "I",
    "Consolidar": "C",
    "Dominar":    "D",
    "Saber":      "S",
}

RASGOS_MAP: dict[str, str] = {
    "Rasgo Actitud Humanizadora (AH)":         "Actitud Humanizadora",
    "Rasgo Conexión con el Entorno (CE)":  "Conexión con el Entorno",
    "Rasgo Conexión Global (CG)":           "Conexión Global",
    "Rasgo Cointeligencia (CI)":                 "Cointeligencia",
}

NO_APLICA = {"no aplica", "no aplica.", "nan", "", "none"}

PREFIJOS_NIVEL = {
    "Inicial":     "Inicial - ",
    "Progresivo":  "Progresivo - ",
    "Avanzado":    "Avanzado - ",
    "Excelente":   "Excelente - ",
}

COL_CATALOGO = "Número de catálogo"


# ── Utilidades ─────────────────────────────────────────────────────────────────

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
    if valor is None:
        return True
    try:
        if pd.isna(valor):
            return True
    except (TypeError, ValueError):
        pass
    return str(valor).strip() in ("", "nan", "none")


def a_int(valor, default: int = 0) -> int:
    try:
        return int(float(str(valor).strip()))
    except (ValueError, TypeError):
        return default


def _buscar_columna_robusta(serie: pd.Series, nombre: str) -> str | None:
    """Encuentra columna tolerando variaciones de tildes, espacios y encoding."""
    def normalizar_simple(s: str) -> str:
        s = s.lower()
        s = s.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
        s = s.replace("à", "a").replace("è", "e").replace("ì", "i").replace("ò", "o").replace("ù", "u")
        s = s.replace("ä", "a").replace("ë", "e").replace("ï", "i").replace("ö", "o").replace("ü", "u")
        s = s.replace("ã", "a").replace("õ", "o").replace("ñ", "n")
        s = re.sub(r"[^a-z0-9]", "", s)
        return s
    
    nombre_norm = normalizar_simple(nombre)
    for col in serie.index:
        col_norm = normalizar_simple(str(col))
        if col_norm == nombre_norm:
            return col
    return None


def _get_seguro(serie: pd.Series, nombre: str, default=0):
    """Obtiene valor tolerando problemas de encoding en nombres de columnas."""
    if nombre in serie.index:
        return serie.get(nombre, default)
    col = _buscar_columna_robusta(serie, nombre)
    return serie.get(col, default) if col else default


# Espacios "raros" que se convierten en espacio normal:
#   U+00A0 nbsp, U+2007 figure space, U+202F narrow nbsp, tab
_ESPACIOS_ESPECIALES = (" ", " ", " ", "	")
# Caracteres de anchura cero que se eliminan por completo:
#   U+200B zwsp, U+200C/U+200D zwj, U+FEFF bom/zwnbsp
_ANCHURA_CERO = ("​", "‌", "‍", "﻿")


def _normalizar_invisibles(texto: str) -> str:
    for ch in _ESPACIOS_ESPECIALES:
        texto = texto.replace(ch, " ")
    for ch in _ANCHURA_CERO:
        texto = texto.replace(ch, "")
    return texto


def limpiar_str(valor) -> str:
    if es_vacio_estricto(valor):
        return ""
    texto = str(valor).replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    texto = _normalizar_invisibles(texto)
    texto = re.sub(r" {2,}", " ", texto).strip()
    return texto


def html_wrap(valor) -> str | None:
    texto = limpiar_str(valor)
    if not texto:
        return None
    return f"<p>{texto}<br/></p>"


def siga_id_a_str(valor) -> str:
    return str(int(float(str(valor).strip())))


def extraer_codigo_meta(id_indicador: str) -> str:
    partes = id_indicador.strip().split("_")
    if partes[-1].upper() == "SABE":
        return "SABE"
    # 'SABE' en medio (ej. ..._SABE_UX_INS): la metacompetencia va desde 'SABE'
    # hasta el final (SABE_UX_INS); su padre raíz será UX_INS.
    for i, p in enumerate(partes):
        if p.upper() == "SABE":
            return "_".join(partes[i:])
    for i, p in enumerate(partes):
        if re.match(r"^M\d+$", p):
            return "_".join(partes[i:])
    return "_".join(partes[-2:])


def extraer_codigo_ra(id_indicador: str) -> str:
    partes = id_indicador.strip().split("_")
    if partes[-1].upper() == "SABE":
        return "_".join(partes[-2:])
    for i, p in enumerate(partes):
        if re.match(r"^RA\d+$", p):
            return "_".join(partes[i:])
    return "_".join(partes[-3:])


def extraer_rasgos(fila: pd.Series) -> list[str]:
    rasgos = []
    for col_nombre, rasgo_corto in RASGOS_MAP.items():
        valor = str(fila.get(col_nombre, "")).strip().lower()
        if valor.startswith("tiene"):
            rasgos.append(rasgo_corto)
    return rasgos


def construir_lista_texto(valor) -> list[str]:
    texto = limpiar_str(valor)
    if not texto:
        return []
    return [texto]


# ── Lectura de equivalencias ────────────────────────────────────────────────────

def leer_equivalencias_bytes(equiv_bytes: bytes) -> tuple[dict, dict]:
    df = pd.read_excel(io.BytesIO(equiv_bytes), sheet_name="Hoja1", header=None)
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
    mapa: dict[str, str] = {}
    for _, row in df_t1.iterrows():
        source = limpiar_str(row.get("Source.Name", ""))
        programa = limpiar_str(row.get("Programa", ""))
        if source and source not in mapa:
            mapa[source] = programa
    return mapa


def _normalizar_col(s: str) -> str:
    """NFC + minúsculas + sin acentos para comparación robusta de nombres de columna."""
    s = unicodedata.normalize("NFC", str(s)).strip().lower()
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode("ascii")


def leer_tm(sheets: dict) -> dict[str, str]:
    """
    Lee la hoja TM del Excel.
    Columna 'Matriz Principal' → código del padre principal (ej. 'UX_INS').
    Columna 'Descripción'      → texto para Nombre_corto y Descripción del padre.
    Busca las columnas por subcadena para tolerar variaciones de tildes y espacios.
    Retorna un dict {codigo_padre: descripcion}.
    """
    df_tm = sheets.get("TM", pd.DataFrame())
    if df_tm.empty:
        return {}

    # Mapa normalizado → nombre original de columna
    col_norm = {_normalizar_col(c): str(c) for c in df_tm.columns}

    col_codigo: str | None = None
    col_desc:   str | None = None
    for norm, original in col_norm.items():
        if "matriz" in norm and "principal" in norm:
            col_codigo = original
        if "descr" in norm:   # cubre Descripción, Descripcion, Descrpción (typo), etc.
            col_desc = original

    if not col_codigo or not col_desc:
        import logging
        logging.getLogger(__name__).warning(
            "Hoja TM: no se encontraron columnas 'Matriz Principal' o 'Descripción'. "
            f"Columnas disponibles: {list(df_tm.columns)}"
        )
        return {}

    mapa: dict[str, str] = {}
    for _, row in df_tm.iterrows():
        codigo = limpiar_str(row.get(col_codigo, ""))
        desc   = limpiar_str(row.get(col_desc, ""))
        if codigo and desc and codigo not in mapa:
            mapa[codigo] = desc
    return mapa


# ── Sub-estructuras ─────────────────────────────────────────────────────────────

def _num_conteo(valor) -> int | None:
    """Extrae el número de secuencia final de la columna 'Conteo' (ej. '...Obligaciones16' → 16)."""
    m = re.search(r"(\d+)\s*$", str(valor))
    return int(m.group(1)) if m else None


def _filas_ordenadas(sub_df: pd.DataFrame):
    """Devuelve las filas ordenadas por el número final de 'Conteo'.

    Garantiza que saberes y referencias respeten el orden real del archivo
    aunque las filas estén físicamente reordenadas en el Excel. Si no existe
    una columna 'Conteo' con numeración válida en todas las filas, se conserva
    el orden físico original.
    """
    col_conteo = None
    if len(sub_df):
        for c in sub_df.columns:
            if str(c).strip().lower() == "conteo":
                col_conteo = c
                break
    if col_conteo is not None:
        nums = [_num_conteo(v) for v in sub_df[col_conteo].tolist()]
        if nums and all(n is not None for n in nums):
            orden = sorted(range(len(sub_df)), key=lambda i: nums[i])
            return [(sub_df.index[i], sub_df.iloc[i]) for i in orden]
    return list(sub_df.iterrows())


def construir_saberes(num_catalogo: str, df_t3: pd.DataFrame, errores: list) -> list:
    mask = df_t3[COL_CATALOGO].astype(str).str.strip() == num_catalogo.strip()
    saberes = []
    for idx, row in _filas_ordenadas(df_t3[mask]):
        fila_excel = idx + 2
        titulo = limpiar_str(row.get("Saber", ""))
        desc = limpiar_str(row.get("Descripción", ""))
        saber_raw = row.get("Saber", "")
        desc_raw = row.get("Descripción", "")
        if (es_vacio_estricto(saber_raw) or str(saber_raw).strip() == "0" or not titulo
                or es_vacio_estricto(desc_raw) or str(desc_raw).strip() == "0" or not desc):
            errores.append({
                "hoja": "T3", "fila": fila_excel,
                "error": "El valor en el campo 'Saber' o 'Descripción' no es válido",
            })
            continue
        saberes.append({"titulo": titulo, "descripcion": desc})
    return saberes


def construir_referencias(num_catalogo: str, df_t5: pd.DataFrame, errores: list) -> list:
    mask = df_t5[COL_CATALOGO].astype(str).str.strip() == num_catalogo.strip()
    referencias = []
    for idx, row in _filas_ordenadas(df_t5[mask]):
        fila_excel = idx + 2
        ref_raw = row.get("Referencia", "")
        texto = limpiar_str(ref_raw)
        if es_vacio_estricto(ref_raw) or str(ref_raw).strip() == "0" or not texto:
            errores.append({
                "hoja": "T5", "fila": fila_excel,
                "error": "El valor en el campo 'Referencia' no es válido",
            })
            continue
        url = row.get("URL", None)
        referencias.append({
            "texto": texto,
            "url": None if es_vacio_estricto(url) else limpiar_str(url),
        })
    return referencias


def construir_competencias(num_catalogo: str, df_t2: pd.DataFrame, mapa_programa: dict) -> list:
    mask = df_t2[COL_CATALOGO].astype(str).str.strip() == num_catalogo.strip()
    competencias = []
    for _, row in df_t2[mask].iterrows():
        id_equivalente = limpiar_str(row.get("ID Indicador equivalente", ""))
        id_principal = limpiar_str(row.get("ID Indicador principal", ""))
        if id_equivalente:
            id_ind = id_equivalente
            tipo = "Homologado"
            codigo_homolog = id_principal
        elif id_principal:
            id_ind = id_principal
            tipo = "Principal"
            codigo_homolog = "No Aplica"
        else:
            continue
        nivel_nombre = limpiar_str(row.get("Nivel de logro", ""))
        nivel_cod = NIVEL_CODIGOS.get(nivel_nombre, nivel_nombre)
        source_name = limpiar_str(row.get("Source.Name", ""))
        nombre_prog = mapa_programa.get(source_name, source_name)
        competencias.append({
            "programa": {"nombre": nombre_prog, "codigo": source_name},
            "metaCompetencia": {
                "titulo": limpiar_str(row.get("Metacompetencia", "")),
                "codigo": extraer_codigo_meta(id_ind),
            },
            "indicadorDesempeno": {
                "descripcion": limpiar_str(row.get("Indicador de desempeño", "")),
                "codigo": id_ind,
                "tipo": tipo,
                "codigoHomologado": codigo_homolog,
            },
            "nivel": {"nivel": nivel_nombre, "codigo": nivel_cod},
            "resultadoAprendizaje": {
                "descripcion": limpiar_str(row.get("Resultados de aprendizaje", "")),
                "codigo": extraer_codigo_ra(id_ind),
            },
        })
    return competencias


def construir_rubrica(num_catalogo: str, df_t2: pd.DataFrame) -> list:
    mask = df_t2[COL_CATALOGO].astype(str).str.strip() == num_catalogo.strip()
    rubrica = []
    vistos_codigo: set[str] = set()
    vistos_desc: set[str] = set()
    for _, row in df_t2[mask].iterrows():
        id_equivalente = limpiar_str(row.get("ID Indicador equivalente", ""))
        id_principal = limpiar_str(row.get("ID Indicador principal", ""))
        if id_equivalente or not id_principal:
            continue
        descripcion = limpiar_str(row.get("Indicador de desempeño", ""))
        if id_principal in vistos_codigo or descripcion in vistos_desc:
            continue
        vistos_codigo.add(id_principal)
        if descripcion:
            vistos_desc.add(descripcion)

        def nivel_texto(col: str) -> str:
            prefijo = PREFIJOS_NIVEL.get(col, f"{col} - ")
            valor = limpiar_str(row.get(col, ""))
            return f"{prefijo}{valor}" if valor else ""

        rubrica.append({
            "indicadorDesempeno": {"descripcion": descripcion, "codigo": id_principal},
            "nivelInicial": nivel_texto("Inicial") or None,
            "nivelProgresivo": nivel_texto("Progresivo") or None,
            "nivelAvanzado": nivel_texto("Avanzado") or None,
            "nivelExcelente": nivel_texto("Excelente") or None,
        })
    return rubrica


def construir_registro(fila, df_t2, df_t3, df_t5, mapa_tipo_registro, mapa_departamento, mapa_programa, errores):
    num_catalogo = limpiar_str(fila.get("Número de catálogo", ""))
    id_siga = siga_id_a_str(fila["ID SIGA"])
    dept_nombre = limpiar_str(fila.get("Departamento que oferta el espacio académico", ""))
    dept_codigo = mapa_departamento.get(dept_nombre, "")
    tipo_reg_nombre = limpiar_str(fila.get("Tipo de registro", ""))
    tipo_reg_codigo = mapa_tipo_registro.get(tipo_reg_nombre, tipo_reg_nombre)
    aula = a_int(fila.get("Aula", 0))
    otro = a_int(fila.get("Otro", 0))
    teor = a_int(fila.get("Teórico", 0))
    htp = a_int(fila.get("Horas teórico-prácticas", 0))

    # Precalcular horas directas para evitar problemas de encoding en el diccionario
    horas_fisico_sin = aula + otro
    horas_fisico_asin = a_int(_get_seguro(fila, "Físico asincrónico", 0))
    horas_virtual_sin = a_int(_get_seguro(fila, "Virtual sincrónico", 0))
    horas_virtual_asin = a_int(_get_seguro(fila, "Virtual asincrónico", 0))
    horas_hyflex = a_int(_get_seguro(fila, "Hyflex", 0))
    horas_practicas = a_int(fila.get("Horas prácticas", 0))
    horas_hti = a_int(fila.get("Horas de trabajo independiente (HTI)", 0))
    horas_total = a_int(fila.get("Horas totales (HTT)", 0))

    return {
        "idCursoSiga": id_siga,
        "nombreCurso": limpiar_str(fila.get("Módulo o espacio académico", "")),
        "creditos": a_int(fila.get("Créditos", 0)),
        "horas": {
            "Directas": {
                "FisicoSincronico": horas_fisico_sin,
                "FisicoAsincronico": horas_fisico_asin,
                "VirtualSincronico": horas_virtual_sin,
                "VirtualAsincronico": horas_virtual_asin,
                "Hyflex": horas_hyflex,
            },
            "TeoricoPracticas": teor + htp,
            "Practicas": horas_practicas,
            "TrabajoIndependiente": horas_hti,
            "Total": horas_total,
        },
        "departamento": {"nombre": dept_nombre, "codigo": dept_codigo},
        "idioma": limpiar_str(fila.get("Idioma", "")),
        "descripcion": limpiar_str(fila.get("Descripción de la asignatura o espacio académico", "")) or None,
        "nivelFormacion": limpiar_str(fila.get("nivelFormacion", "")),
        "EspacioAcademico": limpiar_str(fila.get("EspacioAcademico", "")),
        "modalidad": limpiar_str(fila.get("Modalidad", "")),
        "metodologia": limpiar_str(fila.get("Metodología de aprendizaje experiencial", "")),
        "gradoInternacionalizacion": None,
        "tipoDeRegistro": tipo_reg_codigo,
        "saberes": construir_saberes(num_catalogo, df_t3, errores),
        "referencias": construir_referencias(num_catalogo, df_t5, errores),
        "UX": {
            "competenciaCertificable": html_wrap(fila.get("Competencia Certificable", "")),
            "desCompetencia": html_wrap(fila.get("Descripción de Competencia Certificable", "")),
            "rasgos": extraer_rasgos(fila),
            "clasificador": limpiar_str(fila.get("Clasificador de Módulo", "")),
        },
        "competencias": construir_competencias(num_catalogo, df_t2, mapa_programa),
        "rubricaEvaluacion": construir_rubrica(num_catalogo, df_t2),
        "prerrequisitos": construir_lista_texto(fila.get("Presaberes", "")),
        "correquisitos": construir_lista_texto(fila.get("Cosaberes", "")),
    }


# ── Servicio principal ──────────────────────────────────────────────────────────

def procesar(main_bytes: bytes, equiv_bytes: bytes, filename: str = "archivo.xlsx") -> dict:
    t_inicio = time.perf_counter()

    sheets = pd.read_excel(io.BytesIO(main_bytes), sheet_name=None)
    df_t1 = sheets.get("T1", pd.DataFrame())
    df_t2 = sheets.get("T2", pd.DataFrame())
    df_t3 = sheets.get("T3", pd.DataFrame())
    df_t5 = sheets.get("T5", pd.DataFrame())

    mapa_tipo_registro, mapa_departamento = leer_equivalencias_bytes(equiv_bytes)
    mapa_programa = construir_mapa_programa(df_t1)
    mapa_tm = leer_tm(sheets)

    errores: list[dict] = []
    resultado: dict = {"status": True, "data": {}, "tm": mapa_tm}
    procesados = 0

    for idx, fila in df_t1.iterrows():
        fila_num = idx + 2
        id_siga_raw = fila.get("ID SIGA", None)

        # Omitir filas sin ID SIGA sin reportar como error (simplemente no tienen dato)
        if es_vacio_estricto(id_siga_raw):
            continue

        try:
            registro = construir_registro(
                fila, df_t2, df_t3, df_t5,
                mapa_tipo_registro, mapa_departamento, mapa_programa, errores,
            )
            resultado["data"][registro["idCursoSiga"]] = registro
            procesados += 1
        except KeyError as exc:
            # Error real: columna no encontrada
            errores.append({
                "hoja": "T1", "fila": fila_num,
                "error": f"Columna no encontrada: {exc}",
                "tipo": "COLUMNA_FALTANTE",
            })
        except ValueError as exc:
            # Error real: dato inválido
            errores.append({
                "hoja": "T1", "fila": fila_num,
                "error": f"Dato inválido: {exc}",
                "tipo": "DATO_INVALIDO",
            })
        except Exception as exc:
            # Error inesperado
            errores.append({
                "hoja": "T1", "fila": fila_num,
                "error": f"Error inesperado: {exc}",
                "tipo": "ERROR_INESPERADO",
            })

    try:
        usuario = getpass.getuser()
    except Exception:
        usuario = os.getenv("USERNAME") or os.getenv("USER") or "desconocido"
    try:
        equipo = socket.gethostname()
    except Exception:
        equipo = "desconocido"

    fecha_gen = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    elapsed_ms = (time.perf_counter() - t_inicio) * 1000

    return {
        "resultado": resultado,
        "errores": errores,
        "stats": {
            "procesados": procesados,
            "totalErrores": len(errores),
            "t1Errores": sum(1 for e in errores if e["hoja"] == "T1"),
            "t3Errores": sum(1 for e in errores if e["hoja"] == "T3"),
            "t5Errores": sum(1 for e in errores if e["hoja"] == "T5"),
            "totalFilasT1": len(df_t1),
            "tmEntradas": len(mapa_tm),
            "elapsedMs": round(elapsed_ms, 1),
        },
        "audit": {
            "usuario": usuario,
            "equipo": equipo,
            "fecha": fecha_gen,
            "archivoFuente": filename,
        },
    }
