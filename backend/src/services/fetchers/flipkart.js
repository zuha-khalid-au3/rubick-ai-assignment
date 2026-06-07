const axios = require('axios');
const { MOBILE_UA } = require('./httpClient');
const { extractJsonLdPrices, extractRegexPrices, pickBestPrice } = require('./parse');

function extractPageUri(url) {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    const m = url.match(/flipkart\.com(\/[^?#]+)/);
    return m ? m[1] : null;
  }
}

async function fetchFlipkartViaRomeApi(pageUri) {
  const endpoints = [
    'https://2.rome.api.flipkart.com/api/4/page/fetch',
    'https://1.rome.api.flipkart.com/api/4/page/fetch'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await axios.post(
        endpoint,
        { pageUri },
        {
          timeout: 20000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': MOBILE_UA,
            'X-User-Agent': 'Mozilla/5.0 (Linux; Android 13; FKUA/Retail/2307270924) FKUA/Retail/2307270924 Android/Mobile App FKUA/Retail/2307270924'
          }
        }
      );

      const body = JSON.stringify(response.data || {});
      if (body.length < 10) continue;

      const price = pickBestPrice([
        ...extractJsonLdPrices(body),
        extractRegexPrices(body, [
          /"sellingPrice"\s*:\s*(\d+)/,
          /"finalPrice"\s*:\s*(\d+)/,
          /"fsp"\s*:\s*(\d+)/,
          /"value"\s*:\s*(\d{2,7})/
        ])
      ]);

      if (price) {
        const mrp = extractRegexPrices(body, [/"mrp"\s*:\s*(\d+)/, /"strikeOff"\s*:\s*(\d+)/]);
        return {
          price,
          originalPrice: mrp && mrp > price ? mrp : price,
          availability: 'in_stock',
          method: 'http_flipkart_api'
        };
      }
    } catch {
      // try next endpoint
    }
  }

  return null;
}

function parseFlipkartHtml(html) {
  const candidates = [
    ...extractJsonLdPrices(html),
    extractRegexPrices(html, [
      /"sellingPrice"\s*:\s*(\d+)/,
      /"finalPrice"\s*:\s*(\d+)/,
      /class="_30jeq3"[^>]*>([^<]+)/,
      /₹\s*([\d,]+)/
    ])
  ];

  const price = pickBestPrice(candidates);
  if (!price) return null;

  const mrp = extractRegexPrices(html, [/"mrp"\s*:\s*(\d+)/, /class="_3I9_wc"[^>]*>([^<]+)/]);

  return {
    price,
    originalPrice: mrp && mrp > price ? mrp : price,
    availability: 'in_stock',
    method: 'http_flipkart'
  };
}

async function fetchFlipkartPrice(url, html) {
  const fromHtml = html ? parseFlipkartHtml(html) : null;
  if (fromHtml) return fromHtml;

  const pageUri = extractPageUri(url);
  if (!pageUri) {
    throw new Error('Invalid Flipkart URL');
  }

  const fromApi = await fetchFlipkartViaRomeApi(pageUri);
  if (fromApi) return fromApi;

  throw new Error('Could not parse Flipkart price (page is JS-rendered — try SCRAPERAPI_KEY)');
}

module.exports = { fetchFlipkartPrice, parseFlipkartHtml, extractPageUri };
