const { getCrawler } = require('../services/crawler');
const { fetchProductPrice } = require('../services/fetchers');

async function crawlerRoutes(fastify) {
  const crawler = getCrawler(fastify.db, fastify.redis);

  fastify.get('/status', async (req, reply) => {
    return reply.send(crawler.getStatus());
  });

  fastify.post('/pause', async (req, reply) => {
    crawler.pause();
    return reply.send({ success: true, paused: true });
  });

  fastify.post('/resume', async (req, reply) => {
    crawler.resume();
    return reply.send({ success: true, paused: false });
  });

  fastify.post('/tick', async (req, reply) => {
    await crawler.runTick();
    return reply.send({ success: true, status: crawler.getStatus() });
  });

  fastify.post('/test-fetch', async (req, reply) => {
    const { platform, url } = req.body || {};
    if (!platform || !url) {
      return reply.status(400).send({ error: 'platform and url are required' });
    }
    try {
      const result = await fetchProductPrice(platform, url);
      return reply.send({ success: true, result });
    } catch (err) {
      return reply.status(502).send({ success: false, error: err.message, blocked: Boolean(err.blocked) });
    }
  });
}

module.exports = crawlerRoutes;
