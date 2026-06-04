const Redis = require('ioredis');

function createRedisClient() {
  const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true
  });

  client.on('error', (err) => {
    console.error('Redis error:', err.message);
  });

  return client;
}

// Cache TTL constants (in seconds)
const CACHE_TTL = {
  PRICES: 60,           // 60 seconds for price data
  PRODUCT_LIST: 300,    // 5 minutes for product listings
  PRODUCT_DETAIL: 300,  // 5 minutes for single product
  CATEGORIES: 3600      // 1 hour for category data
};

// Add jitter (+/- 10%) to prevent thundering herd
function ttlWithJitter(base) {
  const jitter = Math.floor(base * 0.1);
  return base + Math.floor(Math.random() * (2 * jitter + 1)) - jitter;
}

module.exports = { createRedisClient, CACHE_TTL, ttlWithJitter };
