from fastapi import APIRouter
from datetime import datetime
import os

router = APIRouter()

@router.get("")
def health():
    return {
        "status": "ok",
        "service": "rubick-ml-service",
        "timestamp": datetime.utcnow().isoformat(),
        "llm_available": bool(os.getenv("OPENAI_API_KEY")),
        "mode": "rule_based+llm_fallback" if os.getenv("OPENAI_API_KEY") else "rule_based_only"
    }
