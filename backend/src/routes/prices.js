const { createPool } = require('../services/db');
const { createRedisClient, CACHE_TTL, ttlWithJitter } = require('../services/redis');
const { recordPriceChange } = require('../services/priceUpdate');

const redis = createRedisClient();

async function priceRoutes(fastify) {
  const db = createPool();

  // GET /api/prices/:productId/history?days=90
  fastify.get('/:productId/history', async (req, reply) => {
    const { productId } = req.params;
    const days = parseInt(req.query.days) || 90;
    const cacheKey = `cache:/api/prices/${productId}/history:${days}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      reply.header('X-Cache', 'HIT');
      return reply.send(JSON.parse(cached));
    }

    const result = await db.query(
      `SELECT product_id, platform, price, original_price, currency, availability, recorded_at
       FROM price_history
       WHERE product_id = $1
         AND recorded_at >= NOW() - INTERVAL '${days} days'
       ORDER BY recorded_at ASC`,
      [productId]
    );

    const response = { data: result.rows, count: result.rows.length, days };
    await redis.setex(cacheKey, ttlWithJitter(CACHE_TTL.PRICES), JSON.stringify(response));
    reply.header('X-Cache', 'MISS');
    return reply.send(response);
  });

  // GET /api/prices/latest — get latest prices for all products
  fastify.get('/latest', async (req, reply) => {
    const cacheKey = 'cache:/api/prices/latest';

    const cached = await redis.get(cacheKey);
    if (cached) {
      reply.header('X-Cache', 'HIT');
      return reply.send(JSON.parse(cached));
    }

    const result = await db.query(`
      SELECT DISTINCT ON (product_id, platform)
        product_id, platform, price, original_price, availability, recorded_at
      FROM price_history
      ORDER BY product_id, platform, recorded_at DESC
      LIMIT 100
    `);

    const response = { data: result.rows };
    await redis.setex(cacheKey, ttlWithJitter(CACHE_TTL.PRICES), JSON.stringify(response));
    reply.header('X-Cache', 'MISS');
    return reply.send(response);
  });

  // POST /api/prices/simulate — simulate a price change (for SSE demo)
  fastify.post('/simulate', async (req, reply) => {
    const { productId, platform, newPrice } = req.body || {};

    if (!productId || !platform || !newPrice) {
      return reply.status(400).send({ error: 'productId, platform, and newPrice are required' });
    }

    try {
      const event = await recordPriceChange(db, redis, {
        productId,
        platform,
        newPrice,
        source: 'manual'
      });
      return reply.send({ success: true, event });
    } catch (err) {
      return reply.status(404).send({ error: err.message });
    }
  });
}

module.exports = priceRoutes;
