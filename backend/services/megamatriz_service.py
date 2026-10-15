"""
Servicio de procesamiento de la Megamatriz (v2, estructura Omnia.xlsx).
Adaptado de procesar_megamatriz.py para funcionar con FastAPI (bytes en memoria).

Estructura esperada: hojas T_1, T_2, T_3 y T_5 (también se aceptan T1, T2, T3, T5).
Cada indicador se identifica por 'ID Indicador' (mismo ID para todos los programas).
"""

import getpass
import io
import os
import re
import socket
import time
from datetime import datetime

import pandas as pd


# ── Constantes ─────────────────────────────────────────────────────────────────

NIVEL_CODIGOS: dict[str, str] = {
    "Introducir": "I",
    "Consolidar": "C",
    "Dominar":    "D",
    "Saber":      "S",
}

# Rasgo → nombres de columna aceptados (las entregas han usado ambas siglas)
RASGOS_MAP: dict[str, tuple[str, ...]] = {
    "Actitud Humanizadora":    ("Rasgo Actitud Humanizadora (AH)", "Rasgo Actitud Humanizadora (H)"),
    "Conexión con el Entorno": ("Rasgo Conexión con el Entorno (CE)", "Rasgo Conexión con el Entorno (E)"),
    "Conexión Global":         ("Rasgo Conexión Global (CG)", "Rasgo Conexión Global (G)"),
    "Cointeligencia":          ("Rasgo Cointeligencia (CI)", "Rasgo Cointeligencia (C)"),
}

NO_APLICA = {"no aplica", "no aplica.", "nan", "", "none"}

PREFIJOS_NIVEL = {
    "Inicial":     "Inicial - ",
    "Progresivo":  "Progresivo - ",
    "Avanzado":    "Avanzado - ",
    "Excelente":   "Excelente - ",
}

COL_CATALOGO = "Número de catálogo"
COL_ID_INDICADOR = "ID Indicador"

# Hojas requeridas: clave lógica → nombres aceptados (el primero es el de Omnia.xlsx)
HOJAS: dict[str, tuple[str, ...]] = {
    "T1": ("T_1", "T1"),
    "T2": ("T_2", "T2"),
    "T3": ("T_3", "T3"),
    "T5": ("T_5", "T5"),
}

# Campos que deben coincidir en todas las filas de un mismo ID Indicador
CAMPOS_INDICADOR = ("Indicador de desempeño", "Inicial", "Progresivo", "Avanzado", "Excelente")

# Columnas de T_1 que van al JSON del curso. T_1 trae una fila por programa que
# dicta el curso; estas columnas deben coincidir en todas las filas del mismo ID SIGA.
CAMPOS_CURSO = (
    "Número de catálogo", "Módulo o espacio académico", "Créditos",
    "Departamento que oferta el espacio académico", "Tipo de registro",
    "Aula", "Otro", "Teórico", "Horas teórico-prácticas", "Físico asincrónico",
    "Virtual sincrónico", "Virtual asincrónico", "Horas prácticas",
    "Horas de trabajo independiente (HTI)", "Horas totales (HTT)",
    "Idioma", "Descripción de la asignatura o espacio académico", "nivelFormacion",
    "EspacioAcademico", "Modalidad", "Metodología de aprendizaje experiencial",
    "Competencia Certificable", "Descripción de Competencia Certificable",
    "Presaberes", "Cosaberes",
) + tuple(c for columnas in RASGOS_MAP.values() for c in columnas)

# 'Clasificador de Módulo' NO está en CAMPOS_CURSO: puede variar por programa y
# se envía como lista con todos los valores del curso (igual que 'rasgos').
COL_CLASIFICADOR = "Clasificador de Módulo"


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


def id_indicador_a_str(valor) -> str:
    """
    El ID se conserva tal como viene en el Excel, con sus ceros a la izquierda
    ('00093' → '00093'). Solo las celdas numéricas se normalizan (2348.0 → '2348').
    """
    if es_vacio_estricto(valor):
        return ""
    if isinstance(valor, float) and valor.is_integer():
        return str(int(valor))
    texto = limpiar_str(valor)
    # Celda numérica leída como texto: '2348.0' → '2348'
    return texto[:-2] if re.fullmatch(r"\d+\.0", texto) else texto


def leer_hojas(main_bytes: bytes) -> dict[str, pd.DataFrame]:
    """
    Lee todas las hojas. 'ID Indicador' se lee como texto: si no, pandas
    convierte '00093' en 93 y se pierden los ceros a la izquierda.
    """
    return pd.read_excel(io.BytesIO(main_bytes), sheet_name=None, dtype={COL_ID_INDICADOR: str})


def extraer_rasgos(fila: pd.Series) -> list[str]:
    rasgos = []
    for rasgo, columnas in RASGOS_MAP.items():
        col = next((c for c in columnas if c in fila.index), None)
        valor = str(fila.get(col, "")).strip().lower() if col else ""
        if valor.startswith("tiene"):
            rasgos.append(rasgo)
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


def resolver_hojas(sheets: dict) -> tuple[dict[str, str], list[str]]:
    """Devuelve ({clave lógica: nombre real de la hoja}, [hojas faltantes])."""
    encontradas: dict[str, str] = {}
    faltantes: list[str] = []
    for clave, nombres in HOJAS.items():
        nombre = next((n for n in nombres if n in sheets), None)
        if nombre:
            encontradas[clave] = nombre
        else:
            faltantes.append(nombres[0])
    return encontradas, faltantes


def quitar_encabezados_repetidos(df: pd.DataFrame) -> pd.DataFrame:
    """
    Elimina filas que repiten los encabezados (la mitad o más de sus celdas son
    iguales al nombre de su columna). Conserva el índice original para que los
    números de fila reportados sigan coincidiendo con el Excel.
    """
    if df.empty:
        return df
    nombres = [str(c).strip() for c in df.columns]
    def es_encabezado(row) -> bool:
        iguales = sum(1 for v, n in zip(row.tolist(), nombres) if str(v).strip() == n)
        return iguales >= max(2, len(nombres) // 2)
    mask = df.apply(es_encabezado, axis=1)
    return df[~mask]


def _listar_filas(filas: list[int], maximo: int = 10) -> str:
    texto = ", ".join(str(f) for f in filas[:maximo])
    return texto + (f" y {len(filas) - maximo} más" if len(filas) > maximo else "")


def analizar_indicadores(df_t2: pd.DataFrame) -> dict[str, dict]:
    """
    Regla: un mismo ID Indicador debe tener la misma descripción y la misma
    rúbrica (Inicial, Progresivo, Avanzado, Excelente) en todo el archivo.
    Retorna {id: {"filas": [...], "campos": [...]}} solo para los IDs que la incumplen.
    """
    if COL_ID_INDICADOR not in df_t2.columns:
        return {}
    valores: dict[str, dict[str, set]] = {}
    filas: dict[str, list[int]] = {}
    for idx, row in df_t2.iterrows():
        id_ind = id_indicador_a_str(row.get(COL_ID_INDICADOR, ""))
        if not id_ind:
            continue
        filas.setdefault(id_ind, []).append(idx + 2)
        por_campo = valores.setdefault(id_ind, {c: set() for c in CAMPOS_INDICADOR})
        for campo in CAMPOS_INDICADOR:
            por_campo[campo].add(limpiar_str(row.get(campo, "")))
    conflictos: dict[str, dict] = {}
    for id_ind, por_campo in valores.items():
        campos = [c for c in CAMPOS_INDICADOR if len(por_campo[c]) > 1]
        if campos:
            conflictos[id_ind] = {"filas": filas[id_ind], "campos": campos}
    return conflictos


def analizar_cursos(df_t1: pd.DataFrame) -> dict[str, dict]:
    """
    Regla: un mismo curso (ID SIGA) debe tener los mismos datos en todas sus filas
    de T_1 (una por programa). Las diferencias solo de mayúsculas no cuentan.
    Retorna {id_siga: {"filas": [...], "campos": {campo: {valor: [filas]}}}}
    solo para los cursos que la incumplen.
    """
    columnas = [c for c in CAMPOS_CURSO if c in df_t1.columns]
    conflictos: dict[str, dict] = {}
    for id_raw, sub in df_t1.groupby("ID SIGA", sort=False):
        if len(sub) < 2 or es_vacio_estricto(id_raw):
            continue
        campos: dict[str, dict[str, list[int]]] = {}
        for col in columnas:
            valores: dict[str, list[int]] = {}
            vistos: set[str] = set()
            for idx, v in sub[col].items():
                texto = limpiar_str(v)
                clave = texto.lower()
                if clave not in vistos:
                    vistos.add(clave)
                    valores[texto] = []
                valores[next(t for t in valores if t.lower() == clave)].append(idx + 2)
            if len(valores) > 1:
                campos[col] = valores
        if campos:
            conflictos[siga_id_a_str(id_raw)] = {"filas": [i + 2 for i in sub.index], "campos": campos}
    return conflictos


def _describir_conflicto_curso(campos: dict[str, dict[str, list[int]]]) -> str:
    partes = []
    for col, valores in campos.items():
        detalle = "; ".join(
            f"'{(v or '(vacío)')[:40]}' en filas {_listar_filas(f, 5)}" for v, f in valores.items()
        )
        partes.append(f"{col} ({detalle})")
    return " | ".join(partes)


def cursos_con_indicadores_en_conflicto(df_t2: pd.DataFrame, ids_conflicto) -> dict[str, list[str]]:
    """{número de catálogo: [IDs en conflicto que usa]} para los cursos afectados."""
    ids = set(ids_conflicto)
    mapa: dict[str, list[str]] = {}
    if not ids or COL_ID_INDICADOR not in df_t2.columns:
        return mapa
    for _, row in df_t2.iterrows():
        id_ind = id_indicador_a_str(row.get(COL_ID_INDICADOR, ""))
        if id_ind in ids:
            catalogo = limpiar_str(row.get(COL_CATALOGO, ""))
            lista = mapa.setdefault(catalogo, [])
            if id_ind not in lista:
                lista.append(id_ind)
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


def construir_saberes(num_catalogo: str, df_t3: pd.DataFrame, errores: list, hoja: str = "T_3") -> list:
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
                "hoja": hoja, "fila": fila_excel,
                "error": "El valor en el campo 'Saber' o 'Descripción' no es válido",
            })
            continue
        saberes.append({"titulo": titulo, "descripcion": desc})
    return saberes


def construir_referencias(num_catalogo: str, df_t5: pd.DataFrame, errores: list, hoja: str = "T_5") -> list:
    mask = df_t5[COL_CATALOGO].astype(str).str.strip() == num_catalogo.strip()
    referencias = []
    for idx, row in _filas_ordenadas(df_t5[mask]):
        fila_excel = idx + 2
        ref_raw = row.get("Referencia", "")
        texto = limpiar_str(ref_raw)
        if es_vacio_estricto(ref_raw) or str(ref_raw).strip() == "0" or not texto:
            errores.append({
                "hoja": hoja, "fila": fila_excel,
                "error": "El valor en el campo 'Referencia' no es válido",
            })
            continue
        url = row.get("URL", None)
        referencias.append({
            "texto": texto,
            "url": None if es_vacio_estricto(url) else limpiar_str(url),
        })
    return referencias


def construir_competencias(num_catalogo: str, df_t2: pd.DataFrame, mapa_programa: dict,
                           ids_omitidos: set) -> list:
    mask = df_t2[COL_CATALOGO].astype(str).str.strip() == num_catalogo.strip()
    competencias = []
    for _, row in df_t2[mask].iterrows():
        id_ind = id_indicador_a_str(row.get(COL_ID_INDICADOR, ""))
        if not id_ind or id_ind in ids_omitidos:
            continue
        nivel_nombre = limpiar_str(row.get("Nivel de logro", ""))
        nivel_cod = NIVEL_CODIGOS.get(nivel_nombre, nivel_nombre)
        source_name = limpiar_str(row.get("Source.Name", ""))
        nombre_prog = mapa_programa.get(source_name, source_name)
        competencias.append({
            "programa": {"nombre": nombre_prog, "codigo": source_name},
            "metaCompetencia": {
                "titulo": limpiar_str(row.get("Metacompetencia", "")),
            },
            "indicadorDesempeno": {
                "descripcion": limpiar_str(row.get("Indicador de desempeño", "")),
                "codigo": id_ind,
                # Ya no hay homologados (mismo ID para todos los programas); se
                # conservan con valor fijo para no romper a quien consume el JSON.
                "tipo": "Principal",
                "codigoHomologado": "No Aplica",
                "clasificacion": limpiar_str(row.get("Clasificación de Indicador", "")),
            },
            "nivel": {"nivel": nivel_nombre, "codigo": nivel_cod},
            "resultadoAprendizaje": {
                "descripcion": limpiar_str(row.get("Resultados de aprendizaje", "")),
            },
        })
    return competencias


def construir_rubrica(num_catalogo: str, df_t2: pd.DataFrame, ids_omitidos: set) -> list:
    """Una entrada por ID Indicador en el curso (el mismo ID puede venir de varios programas)."""
    mask = df_t2[COL_CATALOGO].astype(str).str.strip() == num_catalogo.strip()
    rubrica = []
    vistos: set[str] = set()
    for _, row in df_t2[mask].iterrows():
        id_ind = id_indicador_a_str(row.get(COL_ID_INDICADOR, ""))
        if not id_ind or id_ind in ids_omitidos or id_ind in vistos:
            continue
        vistos.add(id_ind)

        def nivel_texto(col: str) -> str:
            prefijo = PREFIJOS_NIVEL.get(col, f"{col} - ")
            valor = limpiar_str(row.get(col, ""))
            return f"{prefijo}{valor}" if valor else ""

        rubrica.append({
            "indicadorDesempeno": {
                "descripcion": limpiar_str(row.get("Indicador de desempeño", "")),
                "codigo": id_ind,
            },
            "nivelInicial": nivel_texto("Inicial") or None,
            "nivelProgresivo": nivel_texto("Progresivo") or None,
            "nivelAvanzado": nivel_texto("Avanzado") or None,
            "nivelExcelente": nivel_texto("Excelente") or None,
        })
    return rubrica


def clasificadores_por_curso(df_t1: pd.DataFrame) -> dict[str, list[str]]:
    """
    {id_siga: [clasificadores]} con los valores distintos de 'Clasificador de Módulo'
    en todas las filas del curso (una por programa), en orden de aparición.
    Las diferencias solo de mayúsculas cuentan como el mismo valor.
    """
    mapa: dict[str, list[str]] = {}
    if COL_CLASIFICADOR not in df_t1.columns:
        return mapa
    for _, fila in df_t1.iterrows():
        id_raw = fila.get("ID SIGA", None)
        if es_vacio_estricto(id_raw):
            continue
        try:
            id_siga = siga_id_a_str(id_raw)
        except (ValueError, TypeError):
            id_siga = limpiar_str(id_raw)
        valores = mapa.setdefault(id_siga, [])
        texto = limpiar_str(fila.get(COL_CLASIFICADOR, ""))
        if texto and texto.lower() not in (v.lower() for v in valores):
            valores.append(texto)
    return mapa


def construir_registro(fila, df_t2, df_t3, df_t5, mapa_tipo_registro, dept_nombre, dept_codigo,
                       mapa_programa, ids_omitidos, hojas, errores, clasificadores=None):
    num_catalogo = limpiar_str(fila.get("Número de catálogo", ""))
    id_siga = siga_id_a_str(fila["ID SIGA"])
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
        "saberes": construir_saberes(num_catalogo, df_t3, errores, hojas["T3"]),
        "referencias": construir_referencias(num_catalogo, df_t5, errores, hojas["T5"]),
        "UX": {
            "competenciaCertificable": html_wrap(fila.get("Competencia Certificable", "")),
            "desCompetencia": html_wrap(fila.get("Descripción de Competencia Certificable", "")),
            "rasgos": extraer_rasgos(fila),
            "clasificador": clasificadores or [],
        },
        "competencias": construir_competencias(num_catalogo, df_t2, mapa_programa, ids_omitidos),
        "rubricaEvaluacion": construir_rubrica(num_catalogo, df_t2, ids_omitidos),
        "prerrequisitos": construir_lista_texto(fila.get("Presaberes", "")),
        "correquisitos": construir_lista_texto(fila.get("Cosaberes", "")),
    }


# ── Servicio principal ──────────────────────────────────────────────────────────

def procesar(main_bytes: bytes, equiv_bytes: bytes, filename: str = "archivo.xlsx") -> dict:
    t_inicio = time.perf_counter()

    sheets = leer_hojas(main_bytes)
    hojas, faltantes = resolver_hojas(sheets)
    if faltantes:
        raise ValueError(
            f"Faltan hojas en el archivo: {', '.join(faltantes)}. "
            f"Hojas encontradas: {', '.join(map(str, sheets.keys()))}"
        )
    df_t1 = quitar_encabezados_repetidos(sheets[hojas["T1"]])
    df_t2 = quitar_encabezados_repetidos(sheets[hojas["T2"]])
    df_t3 = quitar_encabezados_repetidos(sheets[hojas["T3"]])
    df_t5 = quitar_encabezados_repetidos(sheets[hojas["T5"]])

    mapa_tipo_registro, mapa_departamento = leer_equivalencias_bytes(equiv_bytes)
    mapa_programa = construir_mapa_programa(df_t1)

    errores: list[dict] = []
    resultado: dict = {"status": True, "data": {}}
    cursos_omitidos: set[str] = set()
    cursos_vistos: set[str] = set()

    # Cursos con datos distintos entre programas: se omiten y se reportan una vez
    conflictos_cursos = analizar_cursos(df_t1)
    mapa_clasificadores = clasificadores_por_curso(df_t1)

    # IDs con descripción o rúbrica distinta entre filas: se omiten y se reportan una vez
    conflictos = analizar_indicadores(df_t2)
    for id_ind, info in conflictos.items():
        errores.append({
            "hoja": hojas["T2"], "fila": info["filas"][0],
            "error": (
                f"ID Indicador {id_ind}: valores distintos en {', '.join(info['campos'])} "
                f"(filas {_listar_filas(info['filas'])}) — indicador omitido"
            ),
        })
    ids_omitidos = set(conflictos)
    # Cursos que usan algún indicador en conflicto: también se omiten
    cursos_afectados = cursos_con_indicadores_en_conflicto(df_t2, ids_omitidos)

    for idx, fila in df_t1.iterrows():
        fila_num = idx + 2
        id_siga_raw = fila.get("ID SIGA", None)

        # Omitir filas sin ID SIGA sin reportar como error (simplemente no tienen dato)
        if es_vacio_estricto(id_siga_raw):
            continue

        # T_1 trae una fila por programa: cada curso se construye una sola vez
        try:
            id_siga = siga_id_a_str(id_siga_raw)
        except (ValueError, TypeError):
            id_siga = limpiar_str(id_siga_raw)
        if id_siga in cursos_vistos:
            continue
        cursos_vistos.add(id_siga)
        catalogo = limpiar_str(fila.get("Número de catálogo", ""))

        if id_siga in conflictos_cursos:
            errores.append({
                "hoja": hojas["T1"], "fila": fila_num,
                "error": (
                    f"Curso {id_siga} ({catalogo}): datos distintos entre programas en "
                    f"{_describir_conflicto_curso(conflictos_cursos[id_siga]['campos'])} — curso omitido"
                ),
            })
            cursos_omitidos.add(id_siga)
            continue

        if catalogo in cursos_afectados:
            errores.append({
                "hoja": hojas["T1"], "fila": fila_num,
                "error": (
                    f"Curso {id_siga} ({catalogo}): usa indicadores con descripción o rúbrica distinta "
                    f"({', '.join(sorted(cursos_afectados[catalogo]))}) — curso omitido"
                ),
            })
            cursos_omitidos.add(id_siga)
            continue

        dept_nombre = limpiar_str(fila.get("Departamento que oferta el espacio académico", ""))
        dept_codigo = mapa_departamento.get(dept_nombre, "")
        if not dept_codigo:
            errores.append({
                "hoja": hojas["T1"], "fila": fila_num,
                "error": (
                    f"Departamento '{dept_nombre or '(vacío)'}' no está en la Tabla de equivalencias "
                    f"— curso {id_siga} ({catalogo}) omitido"
                ),
            })
            cursos_omitidos.add(id_siga)
            continue

        try:
            registro = construir_registro(
                fila, df_t2, df_t3, df_t5, mapa_tipo_registro, dept_nombre, dept_codigo,
                mapa_programa, ids_omitidos, hojas, errores,
                mapa_clasificadores.get(id_siga, []),
            )
            resultado["data"][registro["idCursoSiga"]] = registro
        except KeyError as exc:
            # Error real: columna no encontrada
            errores.append({
                "hoja": hojas["T1"], "fila": fila_num,
                "error": f"Columna no encontrada: {exc}",
                "tipo": "COLUMNA_FALTANTE",
            })
        except ValueError as exc:
            # Error real: dato inválido
            errores.append({
                "hoja": hojas["T1"], "fila": fila_num,
                "error": f"Dato inválido: {exc}",
                "tipo": "DATO_INVALIDO",
            })
        except Exception as exc:
            # Error inesperado
            errores.append({
                "hoja": hojas["T1"], "fila": fila_num,
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
            "procesados": len(resultado["data"]),
            "totalErrores": len(errores),
            "t1Errores": sum(1 for e in errores if e["hoja"] == hojas["T1"]),
            "t2Errores": sum(1 for e in errores if e["hoja"] == hojas["T2"]),
            "t3Errores": sum(1 for e in errores if e["hoja"] == hojas["T3"]),
            "t5Errores": sum(1 for e in errores if e["hoja"] == hojas["T5"]),
            "totalFilasT1": len(df_t1),
            "cursosUnicosT1": len(cursos_vistos),
            "cursosOmitidos": len(cursos_omitidos),
            "indicadoresOmitidos": len(ids_omitidos),
            "elapsedMs": round(elapsed_ms, 1),
        },
        "audit": {
            "usuario": usuario,
            "equipo": equipo,
            "fecha": fecha_gen,
            "archivoFuente": filename,
        },
    }


def previsualizar(main_bytes: bytes) -> dict:
    """Revisión rápida del archivo antes de procesar: hojas, filas e indicadores en conflicto."""
    sheets = leer_hojas(main_bytes)
    hojas, faltantes = resolver_hojas(sheets)
    filas = {nombre: len(quitar_encabezados_repetidos(sheets[nombre])) for nombre in hojas.values()}
    indicadores = 0
    cursos = 0
    cursos_afectados = 0
    conflictos: list[dict] = []
    conflictos_cursos: list[dict] = []
    if "T1" in hojas:
        df_t1 = quitar_encabezados_repetidos(sheets[hojas["T1"]])
        if "ID SIGA" in df_t1.columns:
            cursos = int(df_t1["ID SIGA"].dropna().nunique())
            for id_siga, info in analizar_cursos(df_t1).items():
                fila0 = info["filas"][0] - 2
                conflictos_cursos.append({
                    "idSiga": id_siga,
                    "catalogo": limpiar_str(df_t1.loc[fila0, "Número de catálogo"]) if fila0 in df_t1.index else "",
                    "campos": list(info["campos"]),
                    "filas": info["filas"],
                })
    if "T2" in hojas:
        df_t2 = quitar_encabezados_repetidos(sheets[hojas["T2"]])
        if COL_ID_INDICADOR in df_t2.columns:
            indicadores = len({
                i for i in (id_indicador_a_str(v) for v in df_t2[COL_ID_INDICADOR]) if i
            })
        analisis = analizar_indicadores(df_t2)
        afectados = cursos_con_indicadores_en_conflicto(df_t2, analisis)
        catalogos_t1 = set()
        if "T1" in hojas:
            catalogos_t1 = {limpiar_str(v) for v in quitar_encabezados_repetidos(sheets[hojas["T1"]])[COL_CATALOGO]}
        cursos_por_id: dict[str, list[str]] = {}
        for cat, ids in afectados.items():
            if cat in catalogos_t1:
                for i in ids:
                    cursos_por_id.setdefault(i, []).append(cat)
        cursos_afectados = len([c for c in afectados if c in catalogos_t1])
        conflictos = [
            {"id": id_ind, "campos": info["campos"], "filas": info["filas"],
             "cursos": sorted(cursos_por_id.get(id_ind, []))}
            for id_ind, info in analisis.items()
        ]
    return {
        "hojas": [str(h) for h in sheets.keys()],
        "faltantes": faltantes,
        "filasPorHoja": filas,
        "indicadores": indicadores,
        "conflictos": conflictos,
        "cursos": cursos,
        "conflictosCursos": conflictos_cursos,
        "cursosConIndicadorEnConflicto": cursos_afectados,
    }
