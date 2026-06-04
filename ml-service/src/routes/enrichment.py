from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Any
import re
import os

router = APIRouter()

# ─── Rule-Based Enrichment Engine ────────────────────────────────────────────

COLOR_SYNONYMS = {
    'black': ['black', 'blk', 'noir', 'jet black', 'midnight black', 'matte black'],
    'white': ['white', 'wht', 'blanc', 'ivory', 'off white', 'pearl white', 'snow white'],
    'blue': ['blue', 'blu', 'navy', 'cobalt', 'royal blue', 'sky blue', 'midnight blue', 'teal'],
    'red': ['red', 'crimson', 'scarlet', 'maroon', 'burgundy', 'cherry red'],
    'green': ['green', 'grn', 'olive', 'forest green', 'emerald', 'mint'],
    'grey': ['grey', 'gray', 'charcoal', 'slate', 'silver grey', 'graphite'],
    'brown': ['brown', 'tan', 'camel', 'khaki', 'beige', 'sand'],
    'yellow': ['yellow', 'gold', 'mustard', 'lemon'],
    'pink': ['pink', 'rose', 'blush', 'coral', 'salmon'],
    'purple': ['purple', 'violet', 'lavender', 'plum'],
    'orange': ['orange', 'rust', 'copper', 'amber']
}

MATERIAL_KEYWORDS = {
    'leather': ['leather', 'genuine leather', 'faux leather', 'pu leather'],
    'cotton': ['cotton', '100% cotton', 'pure cotton', 'organic cotton'],
    'polyester': ['polyester', 'poly', 'synthetic'],
    'mesh': ['mesh', 'knit mesh', 'air mesh'],
    'denim': ['denim', 'jeans fabric'],
    'nylon': ['nylon', 'ripstop nylon'],
    'wool': ['wool', 'merino wool', 'cashmere'],
    'silk': ['silk', 'satin', 'charmeuse']
}

CATEGORY_KEYWORDS = {
    'Footwear': ['shoe', 'sneaker', 'boot', 'sandal', 'slipper', 'loafer', 'oxford', 'heel'],
    'Electronics': ['phone', 'laptop', 'tablet', 'headphone', 'speaker', 'camera', 'tv', 'monitor', 'keyboard', 'mouse'],
    'Clothing': ['shirt', 'trouser', 'jeans', 'jacket', 'hoodie', 'kurta', 'saree', 'dress', 'skirt', 'shorts'],
    'Beauty': ['serum', 'moisturizer', 'foundation', 'lipstick', 'shampoo', 'conditioner', 'face wash', 'toner', 'oil']
}


def extract_color(text: str) -> Optional[str]:
    """Extract normalized color from product title."""
    text_lower = text.lower()
    for canonical, synonyms in COLOR_SYNONYMS.items():
        for syn in synonyms:
            if syn in text_lower:
                return canonical
    return None


def extract_material(text: str) -> Optional[str]:
    """Extract material from product title or attributes."""
    text_lower = text.lower()
    for canonical, keywords in MATERIAL_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                return canonical
    return None


def classify_category(text: str) -> Optional[str]:
    """Classify product into L1 category based on title."""
    text_lower = text.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                return category
    return None


def extract_size(text: str) -> Optional[str]:
    """Extract size information from product title."""
    # EU shoe size
    eu_match = re.search(r'\b(3[6-9]|4[0-6])\b', text)
    if eu_match:
        return f"EU {eu_match.group()}"
    # Clothing size
    size_match = re.search(r'\b(XS|S|M|L|XL|XXL|XXXL|2XL|3XL)\b', text, re.IGNORECASE)
    if size_match:
        return size_match.group().upper()
    # Storage/RAM
    storage_match = re.search(r'\b(\d+)\s*(GB|TB|MB)\b', text, re.IGNORECASE)
    if storage_match:
        return f"{storage_match.group(1)}{storage_match.group(2).upper()}"
    return None


class EnrichRequest(BaseModel):
    product: dict


class EnrichResponse(BaseModel):
    product_id: str
    attributes: dict
    confidence_scores: dict
    method: str


@router.post("", response_model=EnrichResponse)
async def enrich_product(req: EnrichRequest):
    """
    Rule-based enrichment engine (PRIMARY — zero cost).
    Falls back to LLM only if OPENAI_API_KEY is set and rule coverage < 80%.
    """
    product = req.product
    title = product.get('title', '')
    existing_attrs = product.get('attributes', {})

    # Run rule-based extraction
    enriched = dict(existing_attrs)
    confidence = {}

    color = extract_color(title)
    if color:
        enriched['color'] = color
        confidence['color'] = 0.95

    material = extract_material(title)
    if material:
        enriched['material'] = material
        confidence['material'] = 0.90

    size = extract_size(title)
    if size:
        enriched['size'] = size
        confidence['size'] = 0.88

    category = classify_category(title)
    if category:
        enriched['detected_category'] = category
        confidence['category'] = 0.92

    # Calculate rule coverage
    expected_fields = ['color', 'material', 'size', 'detected_category']
    filled = sum(1 for f in expected_fields if f in enriched)
    coverage = filled / len(expected_fields)

    method = "rule_based"

    # LLM fallback only if coverage < 80% and API key is available
    if coverage < 0.8 and os.getenv('OPENAI_API_KEY'):
        try:
            from openai import OpenAI
            client = OpenAI()
            prompt = f"""Extract structured attributes from this product title: "{title}"
Return JSON with keys: color, material, size, brand, category.
Only include keys you are confident about. Return valid JSON only."""

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0
            )
            import json
            llm_attrs = json.loads(response.choices[0].message.content)
            for k, v in llm_attrs.items():
                if k not in enriched:
                    enriched[k] = v
                    confidence[k] = 0.80
            method = "rule_based+llm_fallback"
        except Exception:
            pass  # LLM failed, rule-based is sufficient

    return EnrichResponse(
        product_id=product.get('product_id', ''),
        attributes=enriched,
        confidence_scores=confidence,
        method=method
    )
