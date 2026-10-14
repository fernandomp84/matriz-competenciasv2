from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import config, processing
from .services import config_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    config_service.load_default()
    yield


app = FastAPI(
    title="Sistema Matriz Competencias v2 - API",
    description="API para procesar la Megamatriz de Electivas — Universidad de La Sabana",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(processing.router, prefix="/api")
app.include_router(config.router, prefix="/api")


@app.get("/")
def root():
    return {"status": "ok", "message": "Sistema Matriz Competencias API v2.0"}


@app.get("/health")
def health():
    return {"status": "healthy", "equiv_configured": config_service.is_configured()}
