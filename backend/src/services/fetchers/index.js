const { fetchHtml } = require('./httpClient');
const { parseMyntraHtml } = require('./myntra');
const { parseAmazonHtml, normalizeAmazonUrl } = require('./amazon');
const { fetchFlipkartPrice } = require('./flipkart');

const lastFetchByDomain = new Map();

async function respectCrawlDelay(url) {
  const delayMs = parseInt(process.env.CRAWL_REQUEST_DELAY_MS || '2500', 10);
  if (delayMs <= 0) return;

  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return;
  }

  const last = lastFetchByDomain.get(host) || 0;
  const wait = delayMs - (Date.now() - last);
  if (wait > 0) {
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  lastFetchByDomain.set(host, Date.now());
}

async function fetchProductPrice(platform, url) {
  if (!url || !platform) {
    throw new Error('platform and url are required');
  }

  const normalizedPlatform = platform.toLowerCase();
  await respectCrawlDelay(url);

  if (normalizedPlatform === 'myntra') {
    const { html } = await fetchHtml(url, { mobile: false });
    return { ...parseMyntraHtml(html), url, fetchedAt: new Date().toISOString() };
  }

  if (normalizedPlatform === 'amazon') {
    const targetUrl = normalizeAmazonUrl(url);
    const { html } = await fetchHtml(targetUrl, { mobile: true });
    return { ...parseAmazonHtml(html), url: targetUrl, fetchedAt: new Date().toISOString() };
  }

  if (normalizedPlatform === 'flipkart') {
    const { html } = await fetchHtml(url, { mobile: true });
    const result = await fetchFlipkartPrice(url, html);
    return { ...result, url, fetchedAt: new Date().toISOString() };
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

module.exports = { fetchProductPrice, respectCrawlDelay };
