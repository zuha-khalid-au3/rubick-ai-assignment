const { recordPriceChange, randomPriceVariance } = require('./priceUpdate');
const { fetchProductPrice } = require('./fetchers');
const { isHttpCrawlable } = require('../data/productUrls');

const PLATFORMS = ['amazon', 'flipkart', 'myntra'];
const CATEGORIES = ['Footwear', 'Electronics', 'Clothing', 'Beauty'];

const DEFAULT_JOBS = [
  { id: 'job_001', platform: 'amazon', category: 'Electronics', status: 'running', productsCrawled: 0 },
  { id: 'job_002', platform: 'flipkart', category: 'Footwear', status: 'running', productsCrawled: 0 },
  { id: 'job_003', platform: 'myntra', category: 'Clothing', status: 'running', productsCrawled: 0 },
  { id: 'job_004', platform: 'amazon', category: 'Beauty', status: 'idle', productsCrawled: 0 },
  { id: 'job_005', platform: 'flipkart', category: 'Electronics', status: 'running', productsCrawled: 0 }
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatRelativeTime(isoOrMs) {
  const ms = typeof isoOrMs === 'number' ? isoOrMs : new Date(isoOrMs).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}

function createCrawler(db, redis) {
  const intervalMs = parseInt(process.env.CRAWL_INTERVAL_MS || '15000', 10);
  const batchSize = parseInt(process.env.CRAWL_BATCH_SIZE || '2', 10);
  const httpEnabled = process.env.CRAWL_HTTP_ENABLED !== 'false';
  const httpFallback = process.env.CRAWL_HTTP_FALLBACK !== 'false';

  let timer = null;
  let jobIndex = 0;
  let paused = false;
  let lastTickAt = null;
  let lastError = null;
  let recentEvents = [];
  const startedAt = Date.now();

  const jobs = DEFAULT_JOBS.map(job => ({
    ...job,
    startedAt: Date.now() - Math.floor(Math.random() * 300000)
  }));

  const platformStats = Object.fromEntries(
    PLATFORMS.map(name => [name, { successCount: 0, failCount: 0, totalLatencyMs: 0, lastCrawlAt: null }])
  );

  const httpStats = { success: 0, fallback: 0, failed: 0 };
  const latencies = [];
  let productsCrawledToday = 0;

  async function resolvePrice(job, platformEntry) {
    const canHttp = httpEnabled && (platformEntry.http_crawlable || isHttpCrawlable(platformEntry.url));

    if (canHttp) {
      try {
        const fetched = await fetchProductPrice(job.platform, platformEntry.url);
        httpStats.success += 1;
        return {
          newPrice: fetched.price,
          fetchMethod: fetched.method,
          source: 'http',
          availability: fetched.availability
        };
      } catch (err) {
        httpStats.failed += 1;
        if (!httpFallback) throw err;
        console.warn(`HTTP fetch failed (${job.platform} ${platformEntry.url}): ${err.message}`);
      }
    }

    httpStats.fallback += 1;
    const basePrice = parseFloat(platformEntry.price?.current || 1000);
    return {
      newPrice: randomPriceVariance(basePrice, 0.06),
      fetchMethod: 'simulated',
      source: 'fallback',
      availability: undefined
    };
  }

  async function crawlProduct(job, product) {
    const platformEntry = (product.platforms || []).find(p => p.name === job.platform);
    if (!platformEntry) return null;

    const start = Date.now();
    const stats = platformStats[job.platform];

    const resolved = await resolvePrice(job, platformEntry);

    const event = await recordPriceChange(db, redis, {
      productId: product.product_id,
      platform: job.platform,
      newPrice: resolved.newPrice,
      title: product.title,
      source: resolved.source === 'http' ? 'http_crawler' : 'crawler',
      fetchMethod: resolved.fetchMethod,
      availability: resolved.availability
    });

    const latencyMs = Date.now() - start;
    stats.successCount += 1;
    stats.totalLatencyMs += latencyMs;
    stats.lastCrawlAt = new Date().toISOString();
    latencies.push(latencyMs);
    if (latencies.length > 100) latencies.shift();

    job.productsCrawled += 1;
    productsCrawledToday += 1;

    recentEvents.unshift({
      productId: product.product_id,
      title: product.title,
      platform: job.platform,
      newPrice: resolved.newPrice,
      latencyMs,
      source: resolved.source,
      fetchMethod: resolved.fetchMethod,
      timestamp: event.timestamp
    });
    recentEvents = recentEvents.slice(0, 20);

    await redis.incr(`crawl:metrics:daily:${todayKey()}`);
    return event;
  }

  async function runTick() {
    if (paused) return;

    const activeJobs = jobs.filter(j => j.status === 'running');
    if (activeJobs.length === 0) return;

    const job = activeJobs[jobIndex % activeJobs.length];
    jobIndex += 1;
    lastTickAt = new Date().toISOString();

    const result = await db.query(
      `SELECT product_id, title, platforms, category
       FROM products
       WHERE category->>'l1' = $1
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(platforms) AS p
           WHERE p->>'name' = $2
         )
       ORDER BY RANDOM()
       LIMIT $3`,
      [job.category, job.platform, batchSize]
    );

    for (const product of result.rows) {
      try {
        await crawlProduct(job, product);
        lastError = null;
      } catch (err) {
        statsFail(job.platform);
        lastError = err.message;
        console.warn(`Crawl failed for ${product.product_id} on ${job.platform}:`, err.message);
      }
    }

    jobs.forEach(j => {
      if (j.status === 'idle' && Math.random() > 0.7) {
        j.status = 'running';
        j.startedAt = Date.now();
      }
    });
  }

  function statsFail(platform) {
    const stats = platformStats[platform];
    stats.failCount += 1;
    stats.lastCrawlAt = new Date().toISOString();
  }

  function getPlatformMetrics() {
    return PLATFORMS.map(name => {
      const stats = platformStats[name];
      const total = stats.successCount + stats.failCount;
      const successRate = total > 0 ? Math.round((stats.successCount / total) * 1000) / 10 : 100;
      const avgLatency = stats.successCount > 0
        ? Math.round((stats.totalLatencyMs / stats.successCount / 100)) / 10
        : 0;

      return {
        name,
        status: paused ? 'paused' : 'running',
        successRate,
        avgLatency,
        lastCrawlAt: stats.lastCrawlAt,
        crawlsTotal: total
      };
    });
  }

  function getMetrics() {
    const avgLatencyMs = latencies.length
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    return {
      productsCrawledToday,
      avgCrawlLatencySec: Math.round(avgLatencyMs / 10) / 100 || 0,
      crawlIntervalSec: intervalMs / 1000,
      batchSize,
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      lastTickAt,
      lastError,
      recentEvents,
      httpEnabled,
      httpFallback,
      httpStats
    };
  }

  function getStatus() {
    return {
      enabled: true,
      paused,
      startedAt: new Date(startedAt).toISOString(),
      jobs: jobs.map(job => ({
        ...job,
        started: formatRelativeTime(job.startedAt)
      })),
      platforms: getPlatformMetrics(),
      metrics: getMetrics()
    };
  }

  async function start() {
    if (timer) return;

    const dailyCount = await redis.get(`crawl:metrics:daily:${todayKey()}`);
    productsCrawledToday = parseInt(dailyCount || '0', 10);

    console.log(`Crawler started — interval ${intervalMs}ms, batch ${batchSize}, HTTP ${httpEnabled ? 'on' : 'off'}`);
    timer = setInterval(() => {
      runTick().catch(err => {
        lastError = err.message;
        console.error('Crawler tick error:', err.message);
      });
    }, intervalMs);

    setTimeout(() => {
      runTick().catch(err => console.error('Crawler initial tick error:', err.message));
    }, 3000);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function pause() {
    paused = true;
  }

  function resume() {
    paused = false;
  }

  return { start, stop, pause, resume, getStatus, runTick };
}

let crawlerInstance = null;

function getCrawler(db, redis) {
  if (!crawlerInstance) {
    crawlerInstance = createCrawler(db, redis);
  }
  return crawlerInstance;
}

module.exports = { getCrawler, createCrawler, PLATFORMS, CATEGORIES };
