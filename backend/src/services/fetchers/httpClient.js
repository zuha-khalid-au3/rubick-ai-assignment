const axios = require('axios');

const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36';

function buildRequestUrl(targetUrl) {
  const scraperKey = process.env.SCRAPERAPI_KEY;
  if (scraperKey) {
    return {
      url: 'http://api.scraperapi.com',
      params: { api_key: scraperKey, url: targetUrl, country_code: 'in' }
    };
  }

  const proxyUrl = process.env.CRAWL_PROXY_URL;
  if (proxyUrl) {
    return { url: targetUrl, proxy: false, proxyConfig: parseProxy(proxyUrl) };
  }

  return { url: targetUrl };
}

function parseProxy(proxyUrl) {
  try {
    const u = new URL(proxyUrl);
    return {
      protocol: u.protocol.replace(':', ''),
      host: u.hostname,
      port: parseInt(u.port, 10) || 8080,
      auth: u.username ? { username: u.username, password: u.password } : undefined
    };
  } catch {
    return undefined;
  }
}

async function fetchHtml(targetUrl, options = {}) {
  const { url, params, proxyConfig } = buildRequestUrl(targetUrl);
  const timeout = parseInt(process.env.CRAWL_HTTP_TIMEOUT_MS || '25000', 10);

  const response = await axios.get(url, {
    params,
    timeout,
    maxRedirects: 5,
    proxy: proxyConfig,
    headers: {
      'User-Agent': options.mobile ? MOBILE_UA : DESKTOP_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Cache-Control': 'no-cache',
      ...(options.headers || {})
    },
    validateStatus: status => status < 500
  });

  if (response.status >= 400) {
    const err = new Error(`HTTP ${response.status} for ${targetUrl}`);
    err.statusCode = response.status;
    if (targetUrl.includes('amazon.') && response.status === 404) {
      err.blocked = true;
      err.message = 'Amazon blocked automated access (set SCRAPERAPI_KEY in .env for proxy)';
    }
    throw err;
  }

  const html = typeof response.data === 'string' ? response.data : String(response.data);

  if (html.includes('api-services-support@amazon.com') && html.length < 8000) {
    const err = new Error('Amazon blocked automated access (use SCRAPERAPI_KEY or residential IP)');
    err.blocked = true;
    throw err;
  }

  return { html, finalUrl: response.request?.res?.responseUrl || targetUrl, status: response.status };
}

module.exports = { fetchHtml, DESKTOP_UA, MOBILE_UA };
