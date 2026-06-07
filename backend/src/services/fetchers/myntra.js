const { extractRegexPrices } = require('./parse');

function parseMyntraHtml(html) {
  const salePrice = extractRegexPrices(html, [
    /"discountedPrice"\s*:\s*(\d+)/,
    /"discounted"\s*:\s*(\d+)/
  ]);

  const mrp = extractRegexPrices(html, [/"mrp"\s*:\s*(\d{2,7})/]);
  const listPrice = extractRegexPrices(html, [/"price"\s*:\s*(\d{2,7})/]);

  const price = salePrice || listPrice;
  if (!price) {
    throw new Error('Could not parse Myntra price from HTML');
  }

  return {
    price,
    originalPrice: mrp && mrp > price ? mrp : price,
    availability: /"soldOut"\s*:\s*true|"inStock"\s*:\s*false|"available"\s*:\s*false/i.test(html)
      ? 'out_of_stock'
      : 'in_stock',
    method: 'http_myntra'
  };
}

module.exports = { parseMyntraHtml };
