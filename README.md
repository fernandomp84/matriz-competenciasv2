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

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

## 📦 Deployment

### Frontend (Vercel)
1. Conectar repositorio a Vercel
2. Build command: `npm run build`
3. Output directory: `dist`

### Backend (Railway)
1. Conectar repositorio a Railway
2. Select Python service
3. Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

## 📝 Licencia

Universidad de La Sabana © 2024
