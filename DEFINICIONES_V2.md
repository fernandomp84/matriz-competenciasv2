# Matriz Competencias v2 — Definiciones

Versión paralela del sistema para la **nueva estructura de entrega** (`Omnia.xlsx`).
La v1 (`matriz-competencias`) sigue funcionando sin cambios con la estructura anterior.

## URLs

| Componente | v2 | v1 (no se toca) |
|---|---|---|
| Repositorio | https://github.com/fernandomp84/matriz-competenciasv2 | https://github.com/fernandomp84/matriz-competencias |
| Backend (Render) | https://matriz-competenciasv2.onrender.com | https://matriz-competencias.onrender.com |
| API Docs | https://matriz-competenciasv2.onrender.com/docs | https://matriz-competencias.onrender.com/docs |
| Frontend (Vercel) | _pendiente_ | https://matriz-competencias-kappa.vercel.app |

## Despliegue

**Render (backend)** — Web Service, runtime Python
- Build Command: `pip install -r backend/requirements.txt`
- Start Command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- Root Directory: _(vacío)_

**Vercel (frontend)**
- Framework: Vite
- Root Directory: `frontend`
- La URL del backend se toma de `frontend/.env.production` (`VITE_API_URL`).

## Nueva estructura de entrada (`Entrada/Omnia.xlsx`)

| Antes | Ahora |
|---|---|
| Hojas `T1`, `T2`, `T3`, `T5`, `TM` | Hojas `T_1`, `T_2`, `T_3`, `T_4`, `T_5` — **sin `TM`** |
| `ID Indicador principal` + `ID Indicador equivalente` (códigos `IND###_RA###_M###_MATRIZ`) | `ID Indicador` (numérico, mismo ID para todos los programas) + `ID de Tributación` (vacía) |
| Rasgos `(AH)`, `(CE)`, `(CG)`, `(CI)` | Rasgos `(H)`, `(E)`, `(G)`, `(C)` |
| Columna `Hyflex` | Ya no viene (se toma como 0) |

## Definiciones acordadas

1. **Mismo ID ⇒ misma descripción y misma rúbrica** en todo el archivo. Las violaciones se deben corregir en el Excel
   (reporte: 28 IDs al 2026-10-14, ver `Salida/Inconsistencias_ID_Indicador.xlsx` en el proyecto v1).
2. **JSON:** ya no lleva `metaCompetencia.codigo` ni `resultadoAprendizaje.codigo`.
3. **Matriz CSV:** solo ID del indicador y su descripción (sin jerarquía matriz → metacompetencia → RA).
4. **Descripciones:** las letras al inicio (`A:`, `C:`, `H:`) se dejan tal como vienen.

## Pendientes por definir

- [ ] Quitar `tipo` y `codigoHomologado` del JSON (el análisis indica que la rúbrica no se afecta si se deduplica por ID).
- [ ] Formato exacto del CSV que acepta la plataforma destino: ¿2 columnas o las 5 actuales con `Número ID paterno` vacío?
- [ ] Qué hacer cuando un ID tiene descripción/rúbrica distinta: ¿reportar error y omitir, o tomar la primera?
- [ ] Código del departamento "Educación y Desarrollo Infantil" en la Tabla de equivalencias.
- [ ] Confirmar si 704 cursos es la entrega completa (antes eran 1.613).
- [ ] ¿Se mantiene `Hyflex` en el JSON (siempre 0) o se quita?
