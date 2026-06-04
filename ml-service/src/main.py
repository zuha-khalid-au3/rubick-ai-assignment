from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import dedup, enrichment, health

app = FastAPI(
    title="Rubick AI ML Service",
    description="Rule-based enrichment engine + deduplication pipeline",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(dedup.router, prefix="/dedup", tags=["Deduplication"])
app.include_router(enrichment.router, prefix="/enrich", tags=["Enrichment"])

@app.get("/")
def root():
    return {"service": "Rubick AI ML Service", "status": "running", "version": "1.0.0"}
