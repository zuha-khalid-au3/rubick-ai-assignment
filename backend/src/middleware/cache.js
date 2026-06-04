const { createRedisClient, ttlWithJitter } = require('../services/redis');

const redis = createRedisClient();

/**
 * Cache middleware factory
 * @param {number} ttl - TTL in seconds
 */
function cacheMiddleware(ttl) {
  return async (req, reply) => {
    const cacheKey = `cache:${req.routerPath}:${JSON.stringify(req.query)}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        reply.header('X-Cache', 'HIT');
        return reply.send(JSON.parse(cached));
      }
      reply.header('X-Cache', 'MISS');

      // Intercept the reply to cache it
      const originalSend = reply.send.bind(reply);
      reply.send = async (payload) => {
        if (reply.statusCode === 200) {
          await redis.setex(cacheKey, ttlWithJitter(ttl), JSON.stringify(payload));
        }
        return originalSend(payload);
      };
    } catch (err) {
      // Cache failure should NOT break the request
      console.error('Cache middleware error:', err.message);
    }
  };
}

module.exports = { cacheMiddleware };
