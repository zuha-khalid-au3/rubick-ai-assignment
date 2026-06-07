function randomPriceVariance(base, variance = 0.08) {
  return parseFloat((base * (1 + (Math.random() - 0.5) * variance * 2)).toFixed(2));
}

async function invalidatePriceCaches(redis, productId) {
  await redis.del('cache:/api/prices/latest');
  await redis.del(`cache:/api/products/${productId}`);

  const historyKeys = await redis.keys(`cache:/api/prices/${productId}/history:*`);
  if (historyKeys.length > 0) {
    await redis.del(...historyKeys);
  }
}

async function recordPriceChange(db, redis, { productId, platform, newPrice, title, source = 'manual', availability, fetchMethod }) {
  const productResult = await db.query(
    'SELECT product_id, title, platforms FROM products WHERE product_id = $1',
    [productId]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Product not found');
  }

  const product = productResult.rows[0];
  const platforms = product.platforms || [];
  const platformEntry = platforms.find(p => p.name === platform);

  if (!platformEntry) {
    throw new Error(`Platform ${platform} not found on product`);
  }

  const originalPrice = parseFloat(platformEntry.price?.original || platformEntry.price?.current || newPrice);
  const currentPrice = parseFloat(newPrice);
  const discountPct = originalPrice > currentPrice
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : 0;

  platformEntry.price = {
    ...platformEntry.price,
    current: currentPrice,
    original: originalPrice,
    discount_pct: discountPct,
    currency: 'INR'
  };
  platformEntry.last_crawled_at = new Date().toISOString();
  platformEntry.availability = availability || (Math.random() > 0.05 ? 'in_stock' : 'out_of_stock');

  await db.query(
    `INSERT INTO price_history (product_id, platform, price, original_price, currency, availability)
     VALUES ($1, $2, $3, $4, 'INR', $5)`,
    [productId, platform, currentPrice, originalPrice, platformEntry.availability]
  );

  await db.query(
    'UPDATE products SET platforms = $1, updated_at = NOW() WHERE product_id = $2',
    [JSON.stringify(platforms), productId]
  );

  await invalidatePriceCaches(redis, productId);

  const event = {
    type: 'PRICE_CHANGE',
    productId,
    platform,
    newPrice: currentPrice,
    title: title || product.title,
    source,
    fetchMethod,
    timestamp: new Date().toISOString()
  };

  await redis.publish('price:alerts', JSON.stringify(event));
  return event;
}

module.exports = { recordPriceChange, randomPriceVariance, invalidatePriceCaches };
