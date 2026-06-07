const { Pool } = require('pg');
const crypto = require('crypto');
const { getProductUrl, isHttpCrawlable } = require('../src/data/productUrls');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://rubick:rubick_secret@localhost:5433/rubick_catalog'
});

function makeProductId(brand, title) {
  return crypto.createHash('sha256').update(`${brand}${title}`).digest('hex').slice(0, 12);
}

function randomPrice(base, variance = 0.15) {
  return parseFloat((base * (1 + (Math.random() - 0.5) * variance * 2)).toFixed(2));
}

function generatePriceHistory(productId, platforms, basePrice, months = 6) {
  const rows = [];
  const now = new Date();
  for (let m = months; m >= 0; m--) {
    for (const platform of platforms) {
      const date = new Date(now.getFullYear(), now.getMonth() - m, 1 + Math.floor(Math.random() * 28));
      // Simulate sale events (Big Billion Day in Oct, Great Indian Festival)
      const isSaleMonth = date.getMonth() === 9 || date.getMonth() === 10;
      const price = isSaleMonth ? randomPrice(basePrice * 0.75) : randomPrice(basePrice);
      const originalPrice = isSaleMonth ? randomPrice(basePrice) : price;
      rows.push({ productId, platform, price, originalPrice, date });
    }
  }
  return rows;
}

const PRODUCTS = [
  // Footwear
  { brand: 'Nike', title: 'Air Max 270 React Black', category: { l1: 'Footwear', l2: 'Sneakers', l3: 'Running' }, basePrice: 12995, platforms: ['amazon', 'flipkart', 'myntra'], attributes: { color: 'black', size_eu: 42, material: 'mesh' } },
  { brand: 'Nike', title: 'Air Force 1 White Low', category: { l1: 'Footwear', l2: 'Sneakers', l3: 'Casual' }, basePrice: 8495, platforms: ['amazon', 'flipkart'], attributes: { color: 'white', size_eu: 43, material: 'leather' } },
  { brand: 'Adidas', title: 'Ultraboost 22 Core Black', category: { l1: 'Footwear', l2: 'Sneakers', l3: 'Running' }, basePrice: 15999, platforms: ['amazon', 'flipkart', 'myntra'], attributes: { color: 'black', size_eu: 42, material: 'primeknit' } },
  { brand: 'Adidas', title: 'Stan Smith White Green', category: { l1: 'Footwear', l2: 'Sneakers', l3: 'Casual' }, basePrice: 7999, platforms: ['myntra', 'flipkart'], attributes: { color: 'white', size_eu: 41, material: 'leather' } },
  { brand: 'Puma', title: 'RS-X Reinvention White', category: { l1: 'Footwear', l2: 'Sneakers', l3: 'Lifestyle' }, basePrice: 9499, platforms: ['amazon', 'myntra'], attributes: { color: 'white', size_eu: 42, material: 'mesh' } },
  { brand: 'Reebok', title: 'Classic Leather White', category: { l1: 'Footwear', l2: 'Sneakers', l3: 'Casual' }, basePrice: 5999, platforms: ['amazon', 'flipkart'], attributes: { color: 'white', size_eu: 43, material: 'leather' } },
  { brand: 'New Balance', title: '574 Core Grey', category: { l1: 'Footwear', l2: 'Sneakers', l3: 'Lifestyle' }, basePrice: 8999, platforms: ['myntra', 'amazon'], attributes: { color: 'grey', size_eu: 42, material: 'suede' } },
  { brand: 'Skechers', title: 'Go Walk 6 Black', category: { l1: 'Footwear', l2: 'Walking', l3: 'Comfort' }, basePrice: 4499, platforms: ['amazon', 'flipkart', 'myntra'], attributes: { color: 'black', size_eu: 43, material: 'knit' } },
  { brand: 'Woodland', title: 'Camel Brown Leather Boots', category: { l1: 'Footwear', l2: 'Boots', l3: 'Casual' }, basePrice: 3999, platforms: ['amazon', 'flipkart'], attributes: { color: 'brown', size_eu: 42, material: 'leather' } },
  { brand: 'Bata', title: 'Comfit Black Oxford', category: { l1: 'Footwear', l2: 'Formal', l3: 'Oxford' }, basePrice: 2499, platforms: ['amazon', 'flipkart'], attributes: { color: 'black', size_eu: 42, material: 'leather' } },

  // Electronics
  { brand: 'Samsung', title: 'Galaxy S24 Ultra 256GB Titanium Black', category: { l1: 'Electronics', l2: 'Smartphones', l3: 'Android' }, basePrice: 129999, platforms: ['amazon', 'flipkart'], attributes: { storage: '256GB', color: 'titanium black', ram: '12GB' } },
  { brand: 'Apple', title: 'iPhone 15 Pro 128GB Natural Titanium', category: { l1: 'Electronics', l2: 'Smartphones', l3: 'iOS' }, basePrice: 134900, platforms: ['amazon', 'flipkart'], attributes: { storage: '128GB', color: 'natural titanium', ram: '8GB' } },
  { brand: 'OnePlus', title: '12 5G 256GB Flowy Emerald', category: { l1: 'Electronics', l2: 'Smartphones', l3: 'Android' }, basePrice: 64999, platforms: ['amazon', 'flipkart'], attributes: { storage: '256GB', color: 'emerald', ram: '12GB' } },
  { brand: 'Xiaomi', title: '14 Ultra 512GB Black', category: { l1: 'Electronics', l2: 'Smartphones', l3: 'Android' }, basePrice: 99999, platforms: ['amazon', 'flipkart'], attributes: { storage: '512GB', color: 'black', ram: '16GB' } },
  { brand: 'Sony', title: 'WH-1000XM5 Wireless Headphones Black', category: { l1: 'Electronics', l2: 'Audio', l3: 'Headphones' }, basePrice: 29990, platforms: ['amazon', 'flipkart'], attributes: { color: 'black', connectivity: 'bluetooth', noise_cancellation: true } },
  { brand: 'Apple', title: 'AirPods Pro 2nd Gen USB-C', category: { l1: 'Electronics', l2: 'Audio', l3: 'Earbuds' }, basePrice: 24900, platforms: ['amazon', 'flipkart'], attributes: { color: 'white', connectivity: 'bluetooth', noise_cancellation: true } },
  { brand: 'LG', title: '55 Inch OLED C3 4K Smart TV', category: { l1: 'Electronics', l2: 'TVs', l3: 'OLED' }, basePrice: 149999, platforms: ['amazon', 'flipkart'], attributes: { size_inch: 55, resolution: '4K', panel: 'OLED' } },
  { brand: 'Samsung', title: '65 Inch Neo QLED 4K QN90C', category: { l1: 'Electronics', l2: 'TVs', l3: 'QLED' }, basePrice: 179999, platforms: ['amazon', 'flipkart'], attributes: { size_inch: 65, resolution: '4K', panel: 'QLED' } },
  { brand: 'Dell', title: 'XPS 15 9530 Intel i7 16GB 512GB', category: { l1: 'Electronics', l2: 'Laptops', l3: 'Ultrabook' }, basePrice: 189990, platforms: ['amazon', 'flipkart'], attributes: { processor: 'Intel i7', ram: '16GB', storage: '512GB SSD' } },
  { brand: 'Apple', title: 'MacBook Air M2 8GB 256GB Midnight', category: { l1: 'Electronics', l2: 'Laptops', l3: 'Ultrabook' }, basePrice: 114900, platforms: ['amazon', 'flipkart'], attributes: { processor: 'Apple M2', ram: '8GB', storage: '256GB SSD', color: 'midnight' } },

  // Clothing
  { brand: 'Levi\'s', title: '511 Slim Fit Jeans Dark Blue', category: { l1: 'Clothing', l2: 'Jeans', l3: 'Slim Fit' }, basePrice: 3499, platforms: ['amazon', 'flipkart', 'myntra'], attributes: { color: 'dark blue', size: '32x32', material: 'denim' } },
  { brand: 'H&M', title: 'Slim Fit Oxford Shirt White', category: { l1: 'Clothing', l2: 'Shirts', l3: 'Formal' }, basePrice: 1499, platforms: ['myntra', 'amazon'], attributes: { color: 'white', size: 'M', material: 'cotton' } },
  { brand: 'Zara', title: 'Relaxed Fit Chinos Beige', category: { l1: 'Clothing', l2: 'Trousers', l3: 'Chinos' }, basePrice: 2990, platforms: ['myntra'], attributes: { color: 'beige', size: '32', material: 'cotton blend' } },
  { brand: 'Allen Solly', title: 'Regular Fit Formal Trousers Navy', category: { l1: 'Clothing', l2: 'Trousers', l3: 'Formal' }, basePrice: 1999, platforms: ['amazon', 'flipkart', 'myntra'], attributes: { color: 'navy', size: '32', material: 'polyester blend' } },
  { brand: 'Van Heusen', title: 'Slim Fit Formal Shirt Blue', category: { l1: 'Clothing', l2: 'Shirts', l3: 'Formal' }, basePrice: 1799, platforms: ['amazon', 'flipkart', 'myntra'], attributes: { color: 'blue', size: 'L', material: 'cotton' } },
  { brand: 'Adidas', title: 'Tiro 23 Track Pants Black', category: { l1: 'Clothing', l2: 'Sportswear', l3: 'Track Pants' }, basePrice: 2499, platforms: ['amazon', 'myntra'], attributes: { color: 'black', size: 'M', material: 'polyester' } },
  { brand: 'Nike', title: 'Dri-FIT Running T-Shirt Black', category: { l1: 'Clothing', l2: 'Sportswear', l3: 'T-Shirts' }, basePrice: 1999, platforms: ['amazon', 'flipkart', 'myntra'], attributes: { color: 'black', size: 'L', material: 'polyester' } },
  { brand: 'Puma', title: 'ESS Logo Hoodie Dark Grey', category: { l1: 'Clothing', l2: 'Sportswear', l3: 'Hoodies' }, basePrice: 2999, platforms: ['amazon', 'myntra'], attributes: { color: 'dark grey', size: 'M', material: 'cotton blend' } },
  { brand: 'Uniqlo', title: 'Ultra Light Down Jacket Black', category: { l1: 'Clothing', l2: 'Jackets', l3: 'Winter' }, basePrice: 5990, platforms: ['amazon'], attributes: { color: 'black', size: 'M', material: 'nylon' } },
  { brand: 'Fabindia', title: 'Kurta Pyjama Set Off White', category: { l1: 'Clothing', l2: 'Ethnic', l3: 'Kurta Set' }, basePrice: 3499, platforms: ['amazon', 'flipkart'], attributes: { color: 'off white', size: 'M', material: 'cotton' } },

  // Beauty
  { brand: 'Lakme', title: '9 to 5 Weightless Mousse Foundation Beige', category: { l1: 'Beauty', l2: 'Face', l3: 'Foundation' }, basePrice: 649, platforms: ['amazon', 'flipkart', 'myntra'], attributes: { shade: 'beige', finish: 'matte', spf: 8 } },
  { brand: 'Maybelline', title: 'Fit Me Matte Poreless Foundation 120', category: { l1: 'Beauty', l2: 'Face', l3: 'Foundation' }, basePrice: 499, platforms: ['amazon', 'flipkart', 'myntra'], attributes: { shade: '120 classic ivory', finish: 'matte' } },
  { brand: 'L\'Oreal', title: 'Revitalift Hyaluronic Acid Serum 30ml', category: { l1: 'Beauty', l2: 'Skincare', l3: 'Serum' }, basePrice: 999, platforms: ['amazon', 'flipkart'], attributes: { volume: '30ml', skin_type: 'all', key_ingredient: 'hyaluronic acid' } },
  { brand: 'The Ordinary', title: 'Niacinamide 10% + Zinc 1% 30ml', category: { l1: 'Beauty', l2: 'Skincare', l3: 'Serum' }, basePrice: 799, platforms: ['amazon', 'flipkart'], attributes: { volume: '30ml', skin_type: 'oily', key_ingredient: 'niacinamide' } },
  { brand: 'Cetaphil', title: 'Moisturizing Cream 250g', category: { l1: 'Beauty', l2: 'Skincare', l3: 'Moisturizer' }, basePrice: 549, platforms: ['amazon', 'flipkart'], attributes: { volume: '250g', skin_type: 'dry sensitive' } },
  { brand: 'Biotique', title: 'Bio Honey Gel Face Wash 100ml', category: { l1: 'Beauty', l2: 'Skincare', l3: 'Face Wash' }, basePrice: 199, platforms: ['amazon', 'flipkart', 'myntra'], attributes: { volume: '100ml', skin_type: 'normal to oily' } },
  { brand: 'Plum', title: 'Green Tea Renewed Clarity Night Gel 50g', category: { l1: 'Beauty', l2: 'Skincare', l3: 'Night Cream' }, basePrice: 449, platforms: ['amazon', 'flipkart'], attributes: { volume: '50g', skin_type: 'oily acne prone' } },
  { brand: 'Forest Essentials', title: 'Facial Tonic Mist Nargis 100ml', category: { l1: 'Beauty', l2: 'Skincare', l3: 'Toner' }, basePrice: 1295, platforms: ['amazon'], attributes: { volume: '100ml', skin_type: 'all' } },
  { brand: 'Mamaearth', title: 'Onion Hair Oil 250ml', category: { l1: 'Beauty', l2: 'Hair', l3: 'Hair Oil' }, basePrice: 349, platforms: ['amazon', 'flipkart', 'myntra'], attributes: { volume: '250ml', hair_type: 'all' } },
  { brand: 'WOW Skin Science', title: 'Apple Cider Vinegar Shampoo 300ml', category: { l1: 'Beauty', l2: 'Hair', l3: 'Shampoo' }, basePrice: 399, platforms: ['amazon', 'flipkart'], attributes: { volume: '300ml', hair_type: 'all' } },

  // More Electronics
  { brand: 'boAt', title: 'Rockerz 450 Bluetooth Headphones Blue', category: { l1: 'Electronics', l2: 'Audio', l3: 'Headphones' }, basePrice: 1499, platforms: ['amazon', 'flipkart'], attributes: { color: 'blue', connectivity: 'bluetooth' } },
  { brand: 'JBL', title: 'Flip 6 Portable Speaker Black', category: { l1: 'Electronics', l2: 'Audio', l3: 'Speakers' }, basePrice: 11999, platforms: ['amazon', 'flipkart'], attributes: { color: 'black', connectivity: 'bluetooth', waterproof: true } },
  { brand: 'Logitech', title: 'MX Master 3S Wireless Mouse Graphite', category: { l1: 'Electronics', l2: 'Peripherals', l3: 'Mouse' }, basePrice: 9995, platforms: ['amazon', 'flipkart'], attributes: { color: 'graphite', connectivity: 'wireless' } },
  { brand: 'Canon', title: 'EOS 200D II DSLR 24.1MP Black', category: { l1: 'Electronics', l2: 'Cameras', l3: 'DSLR' }, basePrice: 64990, platforms: ['amazon', 'flipkart'], attributes: { megapixels: '24.1MP', color: 'black', sensor: 'APS-C' } },
  { brand: 'Anker', title: 'PowerCore 20000mAh Power Bank Black', category: { l1: 'Electronics', l2: 'Accessories', l3: 'Power Bank' }, basePrice: 2999, platforms: ['amazon', 'flipkart'], attributes: { capacity: '20000mAh', color: 'black' } },
  { brand: 'Mi', title: 'Smart Band 8 Black', category: { l1: 'Electronics', l2: 'Wearables', l3: 'Fitness Band' }, basePrice: 3499, platforms: ['amazon', 'flipkart'], attributes: { color: 'black', connectivity: 'bluetooth' } },
  { brand: 'Apple', title: 'Watch Series 9 GPS 45mm Midnight', category: { l1: 'Electronics', l2: 'Wearables', l3: 'Smartwatch' }, basePrice: 44900, platforms: ['amazon', 'flipkart'], attributes: { size: '45mm', color: 'midnight', connectivity: 'GPS' } },
  { brand: 'Samsung', title: 'Galaxy Tab S9 FE 10.9 Inch 128GB Grey', category: { l1: 'Electronics', l2: 'Tablets', l3: 'Android' }, basePrice: 44999, platforms: ['amazon', 'flipkart'], attributes: { storage: '128GB', color: 'grey', screen_size: '10.9 inch' } },
  { brand: 'HP', title: 'LaserJet MFP M140we Wireless Printer', category: { l1: 'Electronics', l2: 'Printers', l3: 'Laser' }, basePrice: 12999, platforms: ['amazon', 'flipkart'], attributes: { type: 'laser', connectivity: 'wireless', functions: 'print scan copy' } },
  { brand: 'Philips', title: 'BT3221 Trimmer Black', category: { l1: 'Electronics', l2: 'Personal Care', l3: 'Trimmer' }, basePrice: 1299, platforms: ['amazon', 'flipkart'], attributes: { color: 'black', battery: 'rechargeable' } }
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database with 50 products...');
    await client.query('BEGIN');

    // Clear existing data
    await client.query('DELETE FROM price_history');
    await client.query('DELETE FROM product_mappings');
    await client.query('DELETE FROM products');

    for (const p of PRODUCTS) {
      const productId = makeProductId(p.brand, p.title);

      // Build platforms JSONB array with real URLs where available
      const platformsData = p.platforms.map(name => {
        const realUrl = getProductUrl(p.brand, p.title, name);
        const url = realUrl || (
          name === 'flipkart'
            ? `https://www.flipkart.com/p/itm${productId.slice(0, 8)}`
            : name === 'myntra'
              ? `https://www.myntra.com/p/${productId.slice(0, 8)}`
              : `https://www.amazon.in/dp/${productId.slice(0, 8)}`
        );
        return {
        name,
        external_id: `${name.toUpperCase().slice(0, 3)}_${productId.slice(0, 8)}`,
        url,
        http_crawlable: isHttpCrawlable(url),
        price: {
          current: randomPrice(p.basePrice),
          original: randomPrice(p.basePrice * 1.1),
          discount_pct: Math.floor(Math.random() * 20),
          currency: 'INR'
        },
        availability: Math.random() > 0.1 ? 'in_stock' : 'out_of_stock',
        rating: { score: parseFloat((3.5 + Math.random() * 1.5).toFixed(1)), count: Math.floor(Math.random() * 5000) + 100 },
        seller: name === 'amazon' ? 'Cloudtail India' : name === 'flipkart' ? 'RetailNet' : 'Myntra Fashion',
        last_crawled_at: new Date().toISOString()
      };
      });

      await client.query(
        `INSERT INTO products (product_id, title, brand, category, attributes, platforms, enrichment_status, confidence_scores)
         VALUES ($1, $2, $3, $4, $5, $6, 'complete', $7)
         ON CONFLICT (product_id) DO UPDATE
           SET title = EXCLUDED.title, updated_at = NOW()`,
        [
          productId,
          p.title,
          p.brand,
          JSON.stringify(p.category),
          JSON.stringify(p.attributes),
          JSON.stringify(platformsData),
          JSON.stringify({ enrichment: 0.95, dedup: 0.92 })
        ]
      );

      // Seed price history
      const priceRows = generatePriceHistory(productId, p.platforms, p.basePrice, 6);
      for (const row of priceRows) {
        await client.query(
          `INSERT INTO price_history (product_id, platform, price, original_price, currency, availability, recorded_at)
           VALUES ($1, $2, $3, $4, 'INR', 'in_stock', $5)`,
          [row.productId, row.platform, row.price, row.originalPrice, row.date]
        );
      }
    }

    // Seed some dedup mappings
    const products = await client.query('SELECT product_id, brand FROM products LIMIT 10');
    for (let i = 0; i < products.rows.length - 1; i++) {
      await client.query(
        `INSERT INTO product_mappings (master_id, platform, platform_sku, match_method, confidence, reviewed)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          products.rows[i].product_id,
          'flipkart',
          `FSN_${products.rows[i].product_id.slice(0, 8)}`,
          'fuzzy',
          parseFloat((0.85 + Math.random() * 0.14).toFixed(3)),
          Math.random() > 0.5
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`✅ Seeded ${PRODUCTS.length} products with 6 months of price history!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
