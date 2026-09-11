const products = {
  'pelvis-1': {
    id: 'pelvis-1',
    name: 'Pelvis 1.0',
    amount: Number(process.env.FLUTE_AMOUNT_PELVIS_1) || 100,
    successUrl: '/pelvis-1-course.html',
  },
  llip: {
    id: 'llip',
    name: 'Lower Limb Injury Prevention',
    amount: Number(process.env.FLUTE_AMOUNT_LLIP) || 199,
    successUrl: '/courses.html#online',
  },
  'seminar-upper-limb': {
    id: 'seminar-upper-limb',
    name: 'Fascia & 2TLS — Upper Limb',
    amount: Number(process.env.FLUTE_AMOUNT_SEMINAR) || 1500,
    successUrl: '/courses.html#seminars',
  },
};

function getProduct(id) {
  const product = products[id];
  if (!product || !product.amount || Number.isNaN(product.amount)) {
    return null;
  }
  return product;
}

module.exports = { products, getProduct };
