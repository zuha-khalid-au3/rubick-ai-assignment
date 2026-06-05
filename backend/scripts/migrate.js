const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://rubick:rubick_secret@localhost:5433/rubick_catalog'
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');

    await client.query('BEGIN');

    // Enable pg_trgm extension for fuzzy search
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

    // Products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id                BIGSERIAL PRIMARY KEY,
        product_id        VARCHAR(32) NOT NULL UNIQUE,
        title             TEXT NOT NULL,
        brand             VARCHAR(120) NOT NULL,
        category          JSONB NOT NULL DEFAULT '{}'::jsonb,
        attributes        JSONB NOT NULL DEFAULT '{}'::jsonb,
        platforms         JSONB NOT NULL DEFAULT '[]'::jsonb,
        variants          JSONB DEFAULT '[]'::jsonb,
        images            TEXT[] DEFAULT '{}',
        enrichment_status VARCHAR(20) DEFAULT 'pending',
        confidence_scores JSONB DEFAULT '{}'::jsonb,
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Indexes for products
    await client.query(`CREATE INDEX IF NOT EXISTS idx_title_trgm ON products USING GIN (title gin_trgm_ops)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_category ON products USING GIN (category jsonb_path_ops)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_platforms ON products USING GIN (platforms jsonb_path_ops)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_brand ON products (brand)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_enrichment_status ON products (enrichment_status) WHERE enrichment_status != 'complete'`);

    // Price history table (partitioned by month)
    await client.query(`
      CREATE TABLE IF NOT EXISTS price_history (
        id             BIGSERIAL,
        product_id     VARCHAR(32) NOT NULL,
        platform       VARCHAR(32),
        price          NUMERIC(10,2) NOT NULL,
        original_price NUMERIC(10,2),
        currency       CHAR(3) DEFAULT 'INR',
        availability   VARCHAR(20),
        recorded_at    TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (id, recorded_at)
      ) PARTITION BY RANGE (recorded_at)
    `);

    // Create monthly partitions for the last 6 months and next 2 months
    const now = new Date();
    for (let i = -6; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const start = d.toISOString().slice(0, 10);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10);
      const partName = `price_history_${start.slice(0, 7).replace('-', '_')}`;
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${partName}
        PARTITION OF price_history
        FOR VALUES FROM ('${start}') TO ('${end}')
      `);
    }

    // Index on price_history
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_price_history_product_platform
      ON price_history (product_id, platform, recorded_at DESC)
    `);

    // Product mappings table for dedup cross-platform links
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_mappings (
        id           BIGSERIAL PRIMARY KEY,
        master_id    VARCHAR(32) NOT NULL,
        platform     VARCHAR(32) NOT NULL,
        platform_sku VARCHAR(64),
        match_method VARCHAR(32),
        confidence   NUMERIC(4,3),
        reviewed     BOOLEAN DEFAULT FALSE,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query('COMMIT');
    console.log('✅ Migrations completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
