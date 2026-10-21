# Matriz Competencias v2 — Definiciones

Versión paralela del sistema para la **nueva estructura de entrega** (`Omnia.xlsx`).
La v1 (`matriz-competencias`) sigue funcionando sin cambios con la estructura anterior.

## URLs

| Componente | v2 | v1 (no se toca) |
|---|---|---|
| Repositorio | https://github.com/fernandomp84/matriz-competenciasv2 | https://github.com/fernandomp84/matriz-competencias |
| Backend (Render) | https://matriz-competenciasv2.onrender.com | https://matriz-competencias.onrender.com |
| API Docs | https://matriz-competenciasv2.onrender.com/docs | https://matriz-competencias.onrender.com/docs |
| Frontend (Vercel) | https://matriz-competenciasv2.vercel.app | https://matriz-competencias-kappa.vercel.app |

## Despliegue

**Render (backend)** — Web Service, runtime Python
- Build Command: `pip install -r backend/requirements.txt`
- Start Command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- Root Directory: _(vacío)_
- Plan: Free (Oregon). Servicio creado sin proyecto (Ungrouped Services).
- Al crear el servicio Render no lanzó el primer deploy; se lanzó con Manual Deploy.

**Vercel (frontend)**
- Framework: Vite
- Root Directory: `frontend`
- Equipo: Clinica Vitalia (Hobby).
- La URL del backend se toma de `frontend/.env.production` (`VITE_API_URL`).

## Nueva estructura de entrada (`Entrada/Omnia.xlsx`)

| Antes | Ahora |
|---|---|
| Hojas `T1`, `T2`, `T3`, `T5`, `TM` | Hojas `T_1`, `T_2`, `T_3`, `T_4`, `T_5` — **sin `TM`** |
| `ID Indicador principal` + `ID Indicador equivalente` (códigos `IND###_RA###_M###_MATRIZ`) | `ID Indicador` (numérico, mismo ID para todos los programas) + `ID de Tributación` (vacía) |
| Rasgos `(AH)`, `(CE)`, `(CG)`, `(CI)` | Se han entregado con `(H)`, `(E)`, `(G)`, `(C)` y con las siglas originales: **se aceptan ambas** |
| Columna `Hyflex` | Ya no viene |
| — | `Clasificación de Indicador` (Acción, Saber, Conexión Global, Actitud Humanizadora, Conexión con el Entorno, Cointeligencia) |
| — | A veces viene una fila que repite los encabezados: **se ignora** en todas las hojas |

## Definiciones acordadas (2026-10-14)

**Reglas de validación**
1. **Mismo ID ⇒ misma descripción y misma rúbrica** (Inicial, Progresivo, Avanzado, Excelente) en todo el archivo.
   Si no se cumple, el indicador **se omite** del JSON y de la matriz y se reporta una vez en el archivo de errores (hoja `T_2`).
1c. **Filas de `T_2` sin `ID Indicador`**: se reportan como **error** (una por fila, con curso, programa y nivel) y la fila se omite.
   El curso se sigue procesando sin esas competencias. (Definido 2026-10-21.)
1d. **Mismo texto de indicador con IDs distintos** (posible indicador duplicado): se reporta como **advertencia**, sin omitir nada.
   Indica rúbrica idéntica sí/no y resultado de aprendizaje idéntico sí/no. Se excluyen los IDs ya en conflicto (regla 1).
   Es informativo: el equipo académico decide si es el mismo indicador (unificar ID) o dos con el mismo texto (correcto). (Definido 2026-10-21.)
1b. **Los cursos que usan algún indicador en conflicto tampoco se procesan**: se omiten y se reportan (hoja `T_1`) con la lista
   de IDs en conflicto que usan. La matriz solo incluye indicadores de cursos procesados (definido 2026-10-15).
2. **Departamento sin equivalencia** en la Tabla de equivalencias ⇒ el **curso se omite** y se reporta (hoja `T_1`).
2b. **Un curso (ID SIGA) = una entrada.** `T_1` trae una fila por cada programa que dicta el curso; el curso se procesa una sola vez.
   Si sus filas tienen **datos distintos entre programas** en cualquier columna que va al JSON, el **curso se omite**
   y se reporta una vez con los valores y filas de cada variante. Excepción: `Clasificador de Módulo` (ver regla 6b).
   Las diferencias solo de mayúsculas ('No Aplica' / 'No aplica') no cuentan como conflicto. (Definido 2026-10-15.)
3. Hojas requeridas: `T_1`, `T_2`, `T_3`, `T_5` (también se aceptan `T1`…`T5`). Si falta alguna, el proceso se detiene con error.

**JSON (`salida.json`)**
4. `indicadorDesempeno.codigo` = `ID Indicador` **tal como viene en el Excel, con sus ceros a la izquierda** (ej. `00093`, `02957`). Se usa igual en el JSON, la rúbrica, la matriz y los errores.
5. `indicadorDesempeno.tipo` = `"Principal"` y `codigoHomologado` = `"No Aplica"` **fijos** (se conservan para no romper consumidores).
6. Nuevo campo `indicadorDesempeno.clasificacion` = `Clasificación de Indicador`.
6b. `UX.clasificador` es una **lista** (igual que `UX.rasgos`) con todos los valores distintos de `Clasificador de Módulo`
   en las filas del curso, en orden de aparición. Ej.: `["Titulación"]`, o `["Campo", "Área"]` si varía según el programa.
   Puede haber más de uno por curso (definido 2026-10-15).
7. Se quitan `metaCompetencia.codigo` y `resultadoAprendizaje.codigo` (quedan `titulo` y `descripcion`).
8. Se quita `horas.Directas.Hyflex`.
9. `rubricaEvaluacion`: una entrada por `ID Indicador` dentro de cada curso (ya no se filtra por principal/homologado).
10. Ya no existe la clave `tm` en el resultado.

**Matriz (`Matriz_Competencias.csv`)**
11. Lista plana: una fila por `ID Indicador` (con sus ceros), ordenada por valor numérico. Sin jerarquía matriz → metacompetencia → RA.
12. Columnas **`Short Code`** (= ID Indicador) y **`Description`** (= Indicador de desempeño), en ese orden, texto plano,
    separadas por `;`, todos los valores entre comillas, UTF-8 con BOM (nombres definidos 2026-10-19).

**Textos**
13. Las letras al inicio de las descripciones (`A:`, `C:`, `G:`, `H:`) se dejan tal como vienen.

## Resultado con `Omnia.xlsx` (2026-10-15 07:47) y equivalencias corregidas (2026-10-15 15:51)

- `T_1`: 704 filas (una por programa) = **273 cursos únicos**.
- 939 IDs de indicador → **28 en conflicto**, usados por **90 cursos** → **183 cursos procesados**, 90 omitidos.
- 9 cursos con más de un clasificador (p. ej. Cálculo Univariado → `["Campo", "Área"]`).
- Matriz: **662 indicadores** (solo de cursos procesados, sin los 28 en conflicto).
- Al corregir los 28 IDs en el Omnia se recuperan los 90 cursos.

## Limpieza de texto

Todos los textos de salida (JSON y CSV) se limpian de caracteres invisibles: espacios especiales (U+00A0, U+2007, U+202F, tab)
se convierten en espacio normal y los de anchura cero (U+200B, U+200C, U+200D, U+FEFF) se eliminan; saltos de línea → espacio;
espacios dobles → uno. Con el Omnia actual: 1.041 caracteres invisibles en el Excel → 0 en la salida.

## Generar los archivos en local

```
python scripts/generar_salidas.py "Entrada/Omnia2.xlsx"
```

Genera en `Salida/`: `salida.json`, `Matriz_Competencias.csv`, `Inconsistencias_ID_Indicador.xlsx` y `Errores_Megamatriz.xlsx`.

## Pendientes (dependen de terceros)

- [x] Código del departamento "Educación y Desarrollo Infantil" en la Tabla de equivalencias (corregido 2026-10-15).
- [ ] Corregir en el Omnia los 28 IDs con descripción/rúbrica distinta.
- [ ] Confirmar si 273 cursos únicos es la entrega completa.
- [x] Columnas del CSV para la plataforma destino: `Short Code`, `Description` (2026-10-19).

> Nota: `procesar_megamatriz.py` y `generar_matriz_competencias.py` en la raíz son los scripts originales de la v1 y **no** reflejan estas reglas; la lógica vigente está en `backend/services/`.
