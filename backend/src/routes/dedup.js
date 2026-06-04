const { createPool } = require('../services/db');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

async function dedupRoutes(fastify) {
  const db = createPool();

  // POST /api/dedup/check — check if two product titles are duplicates
  fastify.post('/check', async (req, reply) => {
    const { title1, title2, brand, category } = req.body || {};

    if (!title1 || !title2) {
      return reply.status(400).send({ error: 'title1 and title2 are required' });
    }

    try {
      const response = await fetch(`${ML_SERVICE_URL}/dedup/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title1, title2, brand, category })
      });

      const result = await response.json();
      return reply.send(result);
    } catch (err) {
      return reply.status(503).send({ error: 'ML service unavailable', message: err.message });
    }
  });

  // GET /api/dedup/mappings — get all confirmed dedup mappings
  fastify.get('/mappings', async (req, reply) => {
    const result = await db.query(`
      SELECT master_id, platform, platform_sku, match_method, confidence, reviewed, created_at
      FROM product_mappings
      ORDER BY confidence DESC
      LIMIT 100
    `);

    return reply.send({ data: result.rows, count: result.rows.length });
  });

  // POST /api/dedup/enrich — trigger enrichment for a product
  fastify.post('/enrich', async (req, reply) => {
    const { productId } = req.body || {};

    if (!productId) {
      return reply.status(400).send({ error: 'productId is required' });
    }

    const productResult = await db.query(
      'SELECT * FROM products WHERE product_id = $1',
      [productId]
    );

    if (productResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    try {
      const response = await fetch(`${ML_SERVICE_URL}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product })
      });

      const enriched = await response.json();

      // Update the product in the database
      await db.query(
        `UPDATE products SET attributes = $1, enrichment_status = 'complete', confidence_scores = $2, updated_at = NOW()
         WHERE product_id = $3`,
        [JSON.stringify(enriched.attributes), JSON.stringify(enriched.confidence_scores), productId]
      );

      return reply.send({ success: true, enriched });
    } catch (err) {
      return reply.status(503).send({ error: 'ML service unavailable', message: err.message });
    }
  });
}

module.exports = dedupRoutes;
