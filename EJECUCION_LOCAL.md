# 🖥️ Guía de Ejecución Local - Matriz Competencias

Si el servidor en Render es muy lento o limitado, puedes ejecutar la aplicación **completamente en tu computadora local** de forma más eficiente.

## 📋 Requisitos Previos

- **Python 3.11+** instalado ([descargar](https://www.python.org/downloads/))
- **Node.js 16+** instalado ([descargar](https://nodejs.org/))
- **Git** instalado

## 🚀 Pasos para Ejecutar Localmente

### 1️⃣ Clonar el Repositorio (Si no lo tienes)

```bash
git clone https://github.com/fernandomp84/matriz-competenciasv2.git
cd matriz-competenciasv2
```

### 2️⃣ Configurar y Ejecutar Backend (FastAPI)

**Opción A: Terminal 1 - Backend**

```bash
# Navegar a carpeta backend
cd backend

# Crear ambiente virtual (opcional pero recomendado)
python -m venv venv

# Activar ambiente virtual
# En Windows:
venv\Scripts\activate
# En Mac/Linux:
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar servidor FastAPI
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**El backend estará disponible en:**
- 🔗 **API Local**: http://localhost:8000
- 📚 **Documentación Swagger**: http://localhost:8000/docs
- 📊 **API Interactiva**: http://localhost:8000/redoc

### 3️⃣ Configurar y Ejecutar Frontend (React)

**Opción B: Terminal 2 - Frontend**

```bash
# Navegar a carpeta frontend
cd frontend

# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo
npm run dev
```

**El frontend estará disponible en:**
- 🌐 **Aplicación**: http://localhost:5173 (o el puerto que indique Vite)

### 4️⃣ Usar la Aplicación

1. Abre en tu navegador: **http://localhost:5173**
2. La aplicación se conectará automáticamente al backend en **http://localhost:8000**
3. Procesa archivos Excel como normalmente lo harías

## 🎯 Flujo Completo Local

```
┌─────────────────────────────────────────────────────┐
│        TU COMPUTADORA (Servidor Local)              │
│                                                       │
│  ┌─────────────────────────────────────────────┐   │
│  │  Frontend React (puerto 5173)                │   │
│  │  - Interfaz web                             │   │
│  │  - Subida de archivos Excel                 │   │
│  └──────────────┬──────────────────────────────┘   │
│                 │ HTTP Request                       │
│  ┌──────────────▼──────────────────────────────┐   │
│  │  Backend FastAPI (puerto 8000)              │   │
│  │  - Procesa Excel                            │   │
│  │  - Genera JSON                              │   │
│  │  - Valida datos                             │   │
│  └──────────────┬──────────────────────────────┘   │
│                 │ JSON Response                      │
│  ┌──────────────▼──────────────────────────────┐   │
│  │  Tu Navegador                                │   │
│  │  - Muestra resultados                       │   │
│  │  - Descarga archivos                        │   │
│  └──────────────────────────────────────────────┘   │
│                                                       │
└─────────────────────────────────────────────────────┘
```

## 📂 Estructura de Archivos

```
matriz-competenciasv2/
├── frontend/                  # React + Vite (puerto 5173)
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                   # FastAPI (puerto 8000)
│   ├── main.py
│   ├── services/
│   ├── routers/
│   ├── requirements.txt
│   └── __init__.py
│
├── Entrada/                   # Carpeta de archivos Excel
│   └── *.xlsx
│
└── Salida/                    # Carpeta de resultados JSON
    └── *.json
```

## ⚡ Ventajas de Ejecutar Localmente

✅ **Sin límites de servidor** - Procesa archivos tan grandes como tu RAM permite
✅ **Más rápido** - Sin latencia de red ni cold starts
✅ **Sin dependencias de internet** - Funciona completamente offline
✅ **Control total** - Personaliza el código según necesites
✅ **Pruebas seguras** - Los archivos no suben a internet

## 🛠️ Solucionar Problemas

### Error: "Python no encontrado"
```bash
# Verifica que Python esté instalado
python --version
# Si no funciona, intenta:
python3 --version
```

### Error: "npm no encontrado"
```bash
# Verifica que Node.js esté instalado
node --version
npm --version
```

### Error: "Puerto 8000 ya está en uso"
```bash
# Usa otro puerto:
uvicorn main:app --reload --host 0.0.0.0 --port 8001
# Luego actualiza el frontend en src/services/api.ts
```

### Error: "Módulos no encontrados en backend"
```bash
# Reinstala dependencias:
pip install --upgrade -r requirements.txt
```

## 📱 Acceder desde Otra Computadora en la Red

Si quieres acceder a la aplicación desde otra computadora en tu red local:

1. **Averigua tu IP local:**
   ```bash
   ipconfig  # Windows
   ifconfig  # Mac/Linux
   ```

2. **Actualiza el backend URL en frontend** (`src/services/api.ts`):
   ```typescript
   const baseURL = 'http://TU_IP_LOCAL:8000/api'
   ```

3. **Accede desde otra computadora:**
   ```
   http://TU_IP_LOCAL:5173
   ```

## 🔄 Actualizar a Última Versión

```bash
# Obtener últimos cambios de GitHub
git pull origin main

# Actualizar dependencias si cambiaron
cd frontend && npm install
cd ../backend && pip install -r requirements.txt
```

## 📊 Monitoreo Local

- **Backend logs**: Aparecen en la terminal del backend (puerto 8000)
- **Frontend logs**: Aparecen en la terminal del frontend (puerto 5173)
- **Swagger API Docs**: http://localhost:8000/docs (prueba endpoints)

## ✅ Validación Final

Cuando todo esté corriendo:

```
✓ Frontend: http://localhost:5173 (debe cargar la interfaz)
✓ Backend: http://localhost:8000/docs (debe mostrar Swagger)
✓ Badge v5: Debe aparecer en esquina inferior derecha
```

---

**¿Problemas?** Revisa los logs en las terminales del frontend y backend para más detalles.
