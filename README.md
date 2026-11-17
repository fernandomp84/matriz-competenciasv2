# Sistema Matriz Competencias

Aplicación full-stack para procesar la Megamatriz de Electivas de la Universidad de La Sabana.

## 🚀 Características

- API FastAPI para procesar archivos Excel
- Frontend React con Vite y Tailwind CSS
- Interfaz intuitiva para configuración y procesamiento
- Generación de matrices de competencias en JSON y CSV

## 📁 Estructura del Proyecto

```
├── backend/           # API FastAPI
│   ├── main.py
│   ├── models/
│   ├── routers/
│   ├── services/
│   └── requirements.txt
├── frontend/          # React + Vite
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── Entrada/          # Input files
├── Salida/           # Output files
└── README.md
```

## 🛠️ Desarrollo Local

### Backend (desde la raíz del proyecto, o `start_backend.bat`)
```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### Frontend (o `start_frontend.bat`)
```bash
cd frontend
npm install
npm run dev
```

El frontend estará disponible en `http://localhost:5173` y usa el backend local
(`/api` → `http://localhost:8000` vía el proxy de Vite).

## 📦 Deployment

### Frontend (Vercel) — https://matriz-competenciasv2.vercel.app
1. Root Directory: `frontend`
2. Build command: `npm run build`
3. Output directory: `dist`
4. La URL del backend se toma de `frontend/.env.production` (`VITE_API_URL`).

### Backend (Render) — https://matriz-competenciasv2.onrender.com
1. Build command: `pip install -r backend/requirements.txt`
2. Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

## 📝 Licencia

Universidad de La Sabana © 2024
