const { z } = require('zod');
const { createPool } = require('../services/db');
const { createRedisClient, CACHE_TTL, ttlWithJitter } = require('../services/redis');

const redis = createRedisClient();

// Zod schemas for validation
const listQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  platform: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional()
});

const compareQuerySchema = z.object({
  ids: z.string().transform(s => s.split(',').slice(0, 5))
});

async function productRoutes(fastify) {
  const db = createPool();

  // GET /api/products — list with fuzzy search + cursor pagination
  fastify.get('/', async (req, reply) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query parameters', details: parsed.error.flatten() });
    }

    const { q, category, brand, platform, limit, cursor } = parsed.data;
    const cacheKey = `cache:/api/products:${JSON.stringify(parsed.data)}`;

    // Check Redis cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      reply.header('X-Cache', 'HIT');
      return reply.send(JSON.parse(cached));
    }

    // Build query with cursor-based pagination
    let conditions = [];
    let params = [];
    let paramIdx = 1;

    if (q) {
      conditions.push(`title ILIKE $${paramIdx} OR brand ILIKE $${paramIdx}`);
      params.push(`%${q}%`);
      paramIdx++;
    }
    if (category) {
      conditions.push(`category->>'l1' ILIKE $${paramIdx}`);
      params.push(`%${category}%`);
      paramIdx++;
    }
    if (brand) {
      conditions.push(`brand ILIKE $${paramIdx}`);
      params.push(`%${brand}%`);
      paramIdx++;
    }
    if (cursor) {
      const decodedCursor = Buffer.from(cursor, 'base64').toString('utf8');
      const [cursorId] = decodedCursor.split(':');
      conditions.push(`id > $${paramIdx}`);
      params.push(parseInt(cursorId));
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit + 1); // Fetch one extra to determine if there's a next page

    const queryText = `
      SELECT id, product_id, title, brand, category, platforms, enrichment_status, confidence_scores, updated_at
      FROM products
      ${whereClause}
      ORDER BY id ASC
      LIMIT $${paramIdx}
    `;

    const result = await db.query(queryText, params);
    const rows = result.rows;
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    const nextCursor = hasMore
      ? Buffer.from(`${data[data.length - 1].id}:${data[data.length - 1].updated_at}`).toString('base64')
      : null;

    const response = {
      data,
      pagination: {
        limit,
        hasMore,
        nextCursor
      },
      total: data.length
    };

    // Cache the response
    await redis.setex(cacheKey, ttlWithJitter(CACHE_TTL.PRODUCT_LIST), JSON.stringify(response));
    reply.header('X-Cache', 'MISS');
    return reply.send(response);
  });

  // GET /api/products/:id — single product detail
  fastify.get('/:id', async (req, reply) => {
    const { id } = req.params;
    const cacheKey = `cache:/api/products/${id}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      reply.header('X-Cache', 'HIT');
      return reply.send(JSON.parse(cached));
    }

    const result = await db.query(
      'SELECT * FROM products WHERE product_id = $1 OR id = $2',
      [id, parseInt(id) || 0]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Product not found' });
    }

    const product = result.rows[0];
    await redis.setex(cacheKey, ttlWithJitter(CACHE_TTL.PRODUCT_DETAIL), JSON.stringify(product));
    reply.header('X-Cache', 'MISS');
    return reply.send(product);
  });

  // GET /api/products/compare?ids=id1,id2,id3 — compare up to 5 products
  fastify.get('/compare', async (req, reply) => {
    const parsed = compareQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Provide comma-separated product IDs (max 5)' });
    }

    const { ids } = parsed.data;
    const cacheKey = `cache:/api/products/compare:${ids.sort().join(',')}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      reply.header('X-Cache', 'HIT');
      return reply.send(JSON.parse(cached));
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await db.query(
      `SELECT * FROM products WHERE product_id IN (${placeholders})`,
      ids
    );

    const response = { data: result.rows, count: result.rows.length };
    await redis.setex(cacheKey, ttlWithJitter(CACHE_TTL.PRODUCT_LIST), JSON.stringify(response));
    reply.header('X-Cache', 'MISS');
    return reply.send(response);
  });
}

module.exports = productRoutes;
