const cheerio = require('cheerio');

function parseIndianPrice(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[₹,\s]/g, '').trim();
  const value = parseFloat(cleaned);
  if (!Number.isFinite(value) || value <= 0 || value > 50_000_000) return null;
  return parseFloat(value.toFixed(2));
}

function extractJsonLdPrices(html) {
  const prices = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        collectOfferPrices(node, prices);
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return prices;
}

function collectOfferPrices(node, prices) {
  if (!node || typeof node !== 'object') return;
  if (node.offers) {
    const offers = Array.isArray(node.offers) ? node.offers : [node.offers];
    for (const offer of offers) {
      const p = parseIndianPrice(offer.price ?? offer.lowPrice ?? offer.highPrice);
      if (p) prices.push(p);
    }
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') collectOfferPrices(value, prices);
  }
}

function extractRegexPrices(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const price = parseIndianPrice(match[1]);
      if (price) return price;
    }
  }
  return null;
}

function extractMetaPrice(html) {
  const $ = cheerio.load(html);
  const selectors = [
    'meta[property="product:price:amount"]',
    'meta[itemprop="price"]',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '.a-price .a-offscreen',
    'span.a-price-whole'
  ];
  for (const sel of selectors) {
    const el = $(sel).first();
    const content = el.attr('content') || el.text();
    const price = parseIndianPrice(content);
    if (price) return price;
  }
  return null;
}

function pickBestPrice(candidates) {
  const valid = [...new Set(candidates.filter(Boolean))];
  if (valid.length === 0) return null;
  // Prefer typical retail range — lowest non-outlier sale price
  valid.sort((a, b) => a - b);
  return valid[0];
}

module.exports = {
  parseIndianPrice,
  extractJsonLdPrices,
  extractRegexPrices,
  extractMetaPrice,
  pickBestPrice,
  cheerio
};
