const { createPool } = require('../services/db');
const { createRedisClient } = require('../services/redis');
const { getCrawler } = require('../services/crawler');

async function healthRoutes(fastify) {
  fastify.get('/', async (req, reply) => {
    const db = createPool();
    const redis = createRedisClient();

    const checks = { postgres: 'unknown', redis: 'unknown', crawler: 'unknown' };

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

    if (process.env.CRAWLER_ENABLED === 'false') {
      checks.crawler = 'disabled';
    } else {
      try {
        const crawler = getCrawler(db, redis);
        const status = crawler.getStatus();
        checks.crawler = status.paused ? 'paused' : 'healthy';
      } catch (e) {
        checks.crawler = 'unhealthy';
      }
    }

    const allHealthy = ['postgres', 'redis'].every(k => checks[k] === 'healthy');
    return reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'ok' : 'degraded',
      services: checks,
      timestamp: new Date().toISOString()
    });
  });
}

module.exports = healthRoutes;
