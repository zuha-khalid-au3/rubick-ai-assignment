const { createPool } = require('../services/db');
const { createRedisClient } = require('../services/redis');

async function healthRoutes(fastify) {
  fastify.get('/', async (req, reply) => {
    const db = createPool();
    const redis = createRedisClient();

    const checks = { postgres: 'unknown', redis: 'unknown' };

    try {
      await db.query('SELECT 1');
      checks.postgres = 'healthy';
    } catch (e) {
      checks.postgres = 'unhealthy';
    }

    try {
      await redis.ping();
      checks.redis = 'healthy';
    } catch (e) {
      checks.redis = 'unhealthy';
    }

    const allHealthy = Object.values(checks).every(s => s === 'healthy');
    return reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'ok' : 'degraded',
      services: checks,
      timestamp: new Date().toISOString()
    });
  });
}

module.exports = healthRoutes;
