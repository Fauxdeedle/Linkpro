function amountFromEnv(defaultAmount, ...keys) {
  for (const key of keys) {
    if (process.env[key] === undefined || process.env[key] === '') {
      continue;
    }

    const amount = Number(process.env[key]);
    if (Number.isFinite(amount) && amount > 0) {
      return amount;
    }
  }

  return defaultAmount;
}

const products = {
  'pelvis-1': {
    id: 'pelvis-1',
    name: 'Pelvis 1.0',
    amount: amountFromEnv(100, 'FLUTE_AMOUNT_PELVIS_1'),
    successUrl: '/pelvis-1-course.html',
  },
  llip: {
    id: 'llip',
    name: 'Lower Limb Injury Prevention',
    amount: amountFromEnv(199, 'FLUTE_AMOUNT_LLIP'),
    successUrl: '/courses.html#online',
  },
  'seminar-upper-limb': {
    id: 'seminar-upper-limb',
    name: 'Fascia & 2TLS — Upper Limb',
    amount: amountFromEnv(
      1500,
      'FLUTE_AMOUNT_SEMINAR_UPPER_LIMB',
      'FLUTE_AMOUNT_SEMINAR'
    ),
    successUrl: '/courses.html#seminars',
  },
  'seminar-lower-limb': {
    id: 'seminar-lower-limb',
    name: 'Fascia & 2TLS — Lower Limb',
    amount: amountFromEnv(1500, 'FLUTE_AMOUNT_SEMINAR_LOWER_LIMB'),
    successUrl: '/courses.html#seminars',
  },
  'seminar-trunk-pelvis': {
    id: 'seminar-trunk-pelvis',
    name: 'Fascia & 2TLS — Trunk & Pelvis',
    amount: amountFromEnv(1500, 'FLUTE_AMOUNT_SEMINAR_TRUNK_PELVIS'),
    successUrl: '/courses.html#seminars',
  },
  'seminar-bundle': {
    id: 'seminar-bundle',
    name: 'Fascia & 2TLS — Three-Seminar Bundle',
    amount: amountFromEnv(3750, 'FLUTE_AMOUNT_SEMINAR_BUNDLE'),
    successUrl: '/courses.html#seminars',
  },
  'retreat-shared-bunk': {
    id: 'retreat-shared-bunk',
    name: 'Nicolette David Retreat — Shared Bunk Room',
    amount: amountFromEnv(1350, 'FLUTE_AMOUNT_RETREAT_SHARED_BUNK'),
    successUrl: '/nicolette-david-retreat.html',
  },
  'retreat-king-single': {
    id: 'retreat-king-single',
    name: 'Nicolette David Retreat — One-Person King',
    amount: amountFromEnv(2350, 'FLUTE_AMOUNT_RETREAT_KING_SINGLE'),
    successUrl: '/nicolette-david-retreat.html',
  },
  'retreat-king-double': {
    id: 'retreat-king-double',
    name: 'Nicolette David Retreat — Two-Person King',
    amount: amountFromEnv(3150, 'FLUTE_AMOUNT_RETREAT_KING_DOUBLE'),
    successUrl: '/nicolette-david-retreat.html',
  },
};

function getProduct(id) {
  const product = products[id];
  if (!product || !product.amount || Number.isNaN(product.amount)) {
    return null;
  }
  return product;
}

module.exports = { amountFromEnv, products, getProduct };
