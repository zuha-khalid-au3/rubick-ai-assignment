const { extractJsonLdPrices, extractMetaPrice, extractRegexPrices, pickBestPrice } = require('./parse');

function extractAsin(url) {
  const m = url.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}

function normalizeAmazonUrl(url) {
  const asin = extractAsin(url);
  if (!asin) return url;
  return `https://www.amazon.in/dp/${asin}`;
}

function parseAmazonHtml(html) {
  const candidates = [
    ...extractJsonLdPrices(html),
    extractMetaPrice(html),
    extractRegexPrices(html, [
      /"priceAmount"\s*:\s*([\d.]+)/,
      /"price"\s*:\s*\{\s*"value"\s*:\s*([\d.]+)/,
      /class="a-price-whole"[^>]*>([\d,]+)/,
      /₹\s*([\d,]+(?:\.\d{2})?)/
    ])
  ];

  const price = pickBestPrice(candidates);
  if (!price) {
    throw new Error('Could not parse Amazon price from HTML');
  }

  const listPrice = extractRegexPrices(html, [
    /"basisPrice"\s*:\s*\{\s*"amount"\s*:\s*([\d.]+)/,
    /class="a-text-price"[^>]*>₹\s*([\d,]+)/
  ]);

  return {
    price,
    originalPrice: listPrice && listPrice > price ? listPrice : price,
    availability: html.includes('Currently unavailable') ? 'out_of_stock' : 'in_stock',
    method: 'http_amazon'
  };
}

module.exports = { parseAmazonHtml, normalizeAmazonUrl, extractAsin };
