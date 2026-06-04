from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import re
from rapidfuzz import fuzz

router = APIRouter()

# ─── Size Conversion Tables ───────────────────────────────────────────────────
EU_TO_US = {36: 4, 37: 5, 38: 6, 39: 7, 40: 7.5, 41: 8, 42: 8.5, 43: 9.5, 44: 10, 45: 11, 46: 12}
US_TO_EU = {v: k for k, v in EU_TO_US.items()}

CLOTHING_SIZE_MAP = {
    'xs': 1, 'extra small': 1,
    's': 2, 'small': 2,
    'm': 3, 'medium': 3,
    'l': 4, 'large': 4,
    'xl': 5, 'extra large': 5, 'x-large': 5,
    'xxl': 6, '2xl': 6,
    'xxxl': 7, '3xl': 7
}

# ─── Title Cleaning ───────────────────────────────────────────────────────────
STOPWORDS = {
    'buy', 'online', 'india', 'men', 'women', 'man', 'woman', 'boys', 'girls',
    'shoes', 'shoe', 'for', 'the', 'and', 'with', 'in', 'at', 'of', 'a', 'an',
    'new', 'latest', 'best', 'top', 'premium', 'original', 'genuine', 'official'
}

ABBREVIATIONS = {
    'blk': 'black', 'wht': 'white', 'blu': 'blue', 'grn': 'green', 'red': 'red',
    'sz': 'size', 'clr': 'color', 'col': 'color', 'qty': 'quantity',
    'airmax': 'air max', 'airforce': 'air force', 'ultraboost': 'ultra boost'
}


def clean_title(title: str) -> str:
    """Stage 3: Lowercase, remove stopwords, expand abbreviations."""
    t = title.lower().strip()
    # Expand abbreviations
    for abbr, full in ABBREVIATIONS.items():
        t = re.sub(r'\b' + abbr + r'\b', full, t)
    # Remove punctuation except spaces
    t = re.sub(r'[^\w\s]', ' ', t)
    # Remove stopwords
    tokens = [w for w in t.split() if w not in STOPWORDS]
    return ' '.join(tokens)


def normalize_size(title: str, category: Optional[str] = None) -> str:
    """Stage 2: Convert sizes to canonical units."""
    t = title.lower()

    # Footwear: EU size detection
    eu_match = re.search(r'\b(3[6-9]|4[0-6])\b', t)
    if eu_match:
        eu = int(eu_match.group())
        us = EU_TO_US.get(eu, eu)
        t = t.replace(eu_match.group(), f'us{us}')

    # US size detection
    us_match = re.search(r'\bsize\s*([\d.]+)\b', t)
    if us_match:
        us = float(us_match.group(1))
        t = t.replace(us_match.group(), f'us{us}')

    # Clothing size normalization
    for size_label, size_num in CLOTHING_SIZE_MAP.items():
        t = re.sub(r'\b' + size_label + r'\b', f'size{size_num}', t)

    return t


# ─── Dedup Pipeline ───────────────────────────────────────────────────────────

class DedupRequest(BaseModel):
    title1: str
    title2: str
    brand: Optional[str] = None
    category: Optional[str] = None


class DedupResponse(BaseModel):
    is_match: bool
    confidence: float
    method: str
    stage_reached: int
    details: dict


@router.post("/check", response_model=DedupResponse)
def check_duplicate(req: DedupRequest):
    """
    6-Stage Deduplication Pipeline:
    1. Pre-filter (brand/category)
    2. Size normalisation
    3. Title cleaning
    4. Fuzzy match (rapidfuzz token_sort_ratio)
    5. Embedding similarity (sentence-transformers)
    6. Human review queue (score 55-65%)
    """
    # Stage 1: Pre-filter — same brand check
    if req.brand:
        b1 = req.brand.lower()
        t1_brand = req.title1.lower()
        t2_brand = req.title2.lower()
        if b1 not in t1_brand and b1 not in t2_brand:
            return DedupResponse(
                is_match=False,
                confidence=0.0,
                method="pre_filter",
                stage_reached=1,
                details={"reason": "Brand mismatch in pre-filter"}
            )

    # Stage 2: Size normalisation
    t1_sized = normalize_size(req.title1, req.category)
    t2_sized = normalize_size(req.title2, req.category)

    # Stage 3: Title cleaning
    t1_clean = clean_title(t1_sized)
    t2_clean = clean_title(t2_sized)

    # Stage 4: Fuzzy match using token_sort_ratio
    fuzzy_score = fuzz.token_sort_ratio(t1_clean, t2_clean) / 100.0

    if fuzzy_score >= 0.85:
        return DedupResponse(
            is_match=True,
            confidence=round(fuzzy_score, 3),
            method="fuzzy",
            stage_reached=4,
            details={
                "cleaned_title1": t1_clean,
                "cleaned_title2": t2_clean,
                "fuzzy_score": round(fuzzy_score, 3)
            }
        )

    # Stage 5: Embedding similarity (only for borderline cases 65-84%)
    if fuzzy_score >= 0.65:
        try:
            from sentence_transformers import SentenceTransformer
            from sklearn.metrics.pairwise import cosine_similarity
            import numpy as np

            model = SentenceTransformer('all-MiniLM-L6-v2')
            embeddings = model.encode([t1_clean, t2_clean])
            cos_sim = float(cosine_similarity([embeddings[0]], [embeddings[1]])[0][0])

            if cos_sim >= 0.88:
                return DedupResponse(
                    is_match=True,
                    confidence=round(cos_sim, 3),
                    method="embedding",
                    stage_reached=5,
                    details={
                        "fuzzy_score": round(fuzzy_score, 3),
                        "cosine_similarity": round(cos_sim, 3)
                    }
                )
            elif cos_sim >= 0.55:
                return DedupResponse(
                    is_match=False,
                    confidence=round(cos_sim, 3),
                    method="human_review_queue",
                    stage_reached=6,
                    details={
                        "fuzzy_score": round(fuzzy_score, 3),
                        "cosine_similarity": round(cos_sim, 3),
                        "action": "Queued for human review"
                    }
                )
        except ImportError:
            pass  # sentence-transformers not available, fall through

    return DedupResponse(
        is_match=False,
        confidence=round(fuzzy_score, 3),
        method="fuzzy",
        stage_reached=4,
        details={
            "cleaned_title1": t1_clean,
            "cleaned_title2": t2_clean,
            "fuzzy_score": round(fuzzy_score, 3)
        }
    )
