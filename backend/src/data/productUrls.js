/**
 * Real product page URLs for HTTP crawling.
 * Keys: "Brand|Product Title" (must match seed.js PRODUCTS entries)
 */
const PRODUCT_URLS = {
  'Nike|Air Max 270 React Black': {
    amazon: 'https://www.amazon.in/dp/B0BZTM9SPL',
    flipkart: 'https://www.flipkart.com/nike-wmns-air-max-excee-sneakers-women/p/itmae27412d7cfe2',
    myntra: 'https://www.myntra.com/casual-shoes/nike/nike-air-max-270-womens-shoes/32285756/buy'
  },
  'Adidas|Ultraboost 22 Core Black': {
    amazon: 'https://www.amazon.in/dp/B09MVMYTLL',
    myntra: 'https://www.myntra.com/sports-shoes/adidas/adidas-men-woven-design-ultraboost-10-running-shoes/20071628/buy'
  },
  'Puma|RS-X Reinvention White': {
    amazon: 'https://www.amazon.in/dp/B07S6MJB3V',
    myntra: 'https://www.myntra.com/casual-shoes/puma/puma-rs-x-toys-unisex-lace-ups-sneakers/32386303/buy'
  },
  'Sony|WH-1000XM5 Wireless Headphones Black': {
    amazon: 'https://www.amazon.in/dp/B0BZWXCB25',
    flipkart: 'https://www.flipkart.com/sony-wf1000xm5-pzin-bluetooth/p/itme74df706a3a75',
    myntra: 'https://www.myntra.com/headphones/sony/sony-wh-1000xm5-wireless-industry-leading-noise-cancelling-bluetooth-headphones/27528156/buy'
  },
  'Apple|AirPods Pro 2nd Gen USB-C': {
    amazon: 'https://www.amazon.in/dp/B0CHWRXHHT',
    flipkart: 'https://www.flipkart.com/apple-airpods-pro-2nd-generation-magsafe-case-usb-c-bluetooth/p/itm60c8f5a308352',
    myntra: 'https://www.myntra.com/headphones/apple/apple-2nd-gen-bluetooth-headset-with-charging-case-airpods-/9803279/buy'
  },
  'Samsung|Galaxy S24 Ultra 256GB Titanium Black': {
    amazon: 'https://www.amazon.in/dp/B0CS5XW6TN',
    flipkart: 'https://www.flipkart.com/samsung-galaxy-s24-5g-snapdragon-marble-gray-256-gb/p/itmc60e0c4fb63b7'
  },
  'Apple|iPhone 15 Pro 128GB Natural Titanium': {
    amazon: 'https://www.amazon.in/dp/B0CHX6NQMD',
    flipkart: 'https://www.flipkart.com/apple-iphone-15-pro-natural-titanium-128-gb/p/itm6e8e8e8e8e8e8'
  },
  'Levi\'s|511 Slim Fit Jeans Dark Blue': {
    amazon: 'https://www.amazon.in/dp/B0018KGDM4',
    myntra: 'https://www.myntra.com/jeans/levis/levis-men-511-slim-low-rise-light-fade-stretchable-jeans/25756832/buy'
  },
  'Nike|Dri-FIT Running T-Shirt Black': {
    myntra: 'https://www.myntra.com/tshirts/nike/nike-men-dri-fit-running-t-shirt/40884477/buy'
  },
  'Maybelline|Fit Me Matte Poreless Foundation 120': {
    amazon: 'https://www.amazon.in/dp/B006TT9EZG',
    myntra: 'https://www.myntra.com/foundation/maybelline/maybelline-fit-me-matteporeless-16h-oil-control-foundation-30-ml---shade-339/30374802/buy'
  },
  'Cetaphil|Moisturizing Cream 250g': {
    amazon: 'https://www.amazon.in/dp/B006C8LTRI',
    flipkart: 'https://www.flipkart.com/cetaphil-moisturising-lotion-250ml/p/itm37edaceb5a6c3',
    myntra: 'https://www.myntra.com/day-cream/cetaphil/cetaphil-set-of-2-moisturising-cream---250-g-each/19530910/buy'
  },
  'The Ordinary|Niacinamide 10% + Zinc 1% 30ml': {
    amazon: 'https://www.amazon.in/dp/B06VSJQWRH',
    myntra: 'https://www.myntra.com/bath-and-body/the-ordinary/the-ordinary-niacinamide-10-zinc-1-30ml/21848556/buy'
  },
  'Mamaearth|Onion Hair Oil 250ml': {
    amazon: 'https://www.amazon.in/dp/B07W4DKYY9',
    flipkart: 'https://www.flipkart.com/mamaearth-onion-hair-oil-250-ml/p/itm0e0e0e0e0e0e0',
    myntra: 'https://www.myntra.com/hair-oil/mamaearth/mamaearth-onion-hair-oil-with-onion-redensyl-for-hair-fall/21848556/buy'
  },
  'JBL|Flip 6 Portable Speaker Black': {
    amazon: 'https://www.amazon.in/dp/B09G3HFW94',
    flipkart: 'https://www.flipkart.com/jbl-flip-6-portable-bluetooth-speaker/p/itm6e6e6e6e6e6e6'
  },
  'Apple|MacBook Air M2 8GB 256GB Midnight': {
    amazon: 'https://www.amazon.in/dp/B0B3C2R8MP',
    flipkart: 'https://www.flipkart.com/apple-macbook-air-m2-midnight-256-gb/p/itm6e6e6e6e6e6e6'
  },
  'boAt|Rockerz 450 Bluetooth Headphones Blue': {
    amazon: 'https://www.amazon.in/dp/B07JQKR74S',
    flipkart: 'https://www.flipkart.com/boat-rockerz-450-bluetooth-on-ear-headphone/p/itm6e6e6e6e6e6e6'
  }
};

function productKey(brand, title) {
  return `${brand}|${title}`;
}

function getProductUrl(brand, title, platform) {
  const entry = PRODUCT_URLS[productKey(brand, title)];
  return entry?.[platform] || null;
}

function isHttpCrawlable(url) {
  if (!url) return false;
  if (/\.in\/dp\/[a-f0-9]{8}$/i.test(url)) return false;
  if (/itm[a-f0-9]{8}$/i.test(url) && /itm6[e0]{7}/i.test(url)) return false;
  if (/\/12345678\//.test(url)) return false;
  if (/itm1234567890ab/.test(url)) return false;
  return /^https:\/\/(www\.)?(amazon\.in|flipkart\.com|myntra\.com)/.test(url);
}

module.exports = { PRODUCT_URLS, getProductUrl, isHttpCrawlable, productKey };
