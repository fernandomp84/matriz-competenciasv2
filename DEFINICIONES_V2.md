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
2. **Departamento sin equivalencia** en la Tabla de equivalencias ⇒ el **curso se omite** y se reporta (hoja `T_1`).
3. Hojas requeridas: `T_1`, `T_2`, `T_3`, `T_5` (también se aceptan `T1`…`T5`). Si falta alguna, el proceso se detiene con error.

**JSON (`salida.json`)**
4. `indicadorDesempeno.codigo` = `ID Indicador` (numérico, como texto).
5. `indicadorDesempeno.tipo` = `"Principal"` y `codigoHomologado` = `"No Aplica"` **fijos** (se conservan para no romper consumidores).
6. Nuevo campo `indicadorDesempeno.clasificacion` = `Clasificación de Indicador`.
7. Se quitan `metaCompetencia.codigo` y `resultadoAprendizaje.codigo` (quedan `titulo` y `descripcion`).
8. Se quita `horas.Directas.Hyflex`.
9. `rubricaEvaluacion`: una entrada por `ID Indicador` dentro de cada curso (ya no se filtra por principal/homologado).
10. Ya no existe la clave `tm` en el resultado.

**Matriz (`Matriz_Competencias.csv`)**
11. Lista plana: una fila por `ID Indicador`, ordenada numéricamente. Sin jerarquía matriz → metacompetencia → RA.
12. Columnas `ID Indicador` y `Descripción` (texto plano), separadas por `;`, todos los valores entre comillas, UTF-8 con BOM.

**Textos**
13. Las letras al inicio de las descripciones (`A:`, `C:`, `G:`, `H:`) se dejan tal como vienen.

## Resultado con `Omnia.xlsx` del 2026-10-14 (12:55)

- 704 cursos en `T_1` → 700 procesados, 4 omitidos (departamento "Educación y Desarrollo Infantil").
- 939 IDs de indicador → 28 omitidos por conflicto → **896 filas** en la matriz.

## Pendientes (dependen de terceros)

- [ ] Código del departamento "Educación y Desarrollo Infantil" en la Tabla de equivalencias.
- [ ] Corregir en el Omnia los 28 IDs con descripción/rúbrica distinta.
- [ ] Confirmar si 704 cursos es la entrega completa (antes eran 1.613).
- [ ] Confirmar que la plataforma destino acepta el CSV de 2 columnas.

> Nota: `procesar_megamatriz.py` y `generar_matriz_competencias.py` en la raíz son los scripts originales de la v1 y **no** reflejan estas reglas; la lógica vigente está en `backend/services/`.
