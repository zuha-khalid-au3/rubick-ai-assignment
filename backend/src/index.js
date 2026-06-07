const Fastify = require('fastify');
const cors = require('@fastify/cors');
const rateLimit = require('@fastify/rate-limit');
const { createRedisClient } = require('./services/redis');
const { createPool } = require('./services/db');
const productRoutes = require('./routes/products');
const priceRoutes = require('./routes/prices');
const dedupRoutes = require('./routes/dedup');
const crawlerRoutes = require('./routes/crawler');
const healthRoutes = require('./routes/health');
const { getCrawler } = require('./services/crawler');

const app = Fastify({ logger: true });

async function start() {
  // Register plugins
  await app.register(cors, { origin: '*' });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: createRedisClient()
  });

  // Attach DB and Redis to app instance
  app.decorate('db', createPool());
  app.decorate('redis', createRedisClient());

  // Register routes
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(productRoutes, { prefix: '/api/products' });
  await app.register(priceRoutes, { prefix: '/api/prices' });
  await app.register(dedupRoutes, { prefix: '/api/dedup' });
  await app.register(crawlerRoutes, { prefix: '/api/crawler' });

  // SSE endpoint for live price updates
  app.get('/api/stream/prices', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const redis = createRedisClient();
    await redis.subscribe('price:alerts');

    redis.on('message', (channel, message) => {
      reply.raw.write(`data: ${message}\n\n`);
    });

    req.raw.on('close', () => {
      redis.unsubscribe();
      redis.quit();
    });
  });

  const port = process.env.PORT || 3001;
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Backend running on port ${port}`);

  if (process.env.CRAWLER_ENABLED !== 'false') {
    getCrawler(app.db, app.redis).start();
  } else {
    console.log('Crawler disabled (CRAWLER_ENABLED=false)');
  }
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});
