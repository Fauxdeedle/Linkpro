function formatUsd(amount) {
  return `$${Number(amount).toLocaleString('en-US')}`;
}

function pacificDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    return '';
  }
  return value;
}

function salePercent(sale) {
  const percent = Number(sale?.percent);
  if (!Number.isInteger(percent) || percent < 1 || percent > 99) return null;
  return percent;
}

function saleActive(sale, now = new Date()) {
  const percent = salePercent(sale);
  if (!percent) return false;
  if (sale.endsOn == null || sale.endsOn === '') return true;
  const endsOn = validDate(sale.endsOn);
  if (!endsOn) return false;
  return pacificDate(now) <= endsOn;
}

function discountedAmount(listPrice, percent) {
  if (!Number.isInteger(listPrice) || listPrice <= 0) return null;
  if (!Number.isInteger(percent) || percent < 1 || percent > 99) return null;
  const amount = Math.round((listPrice * (100 - percent)) / 100);
  if (!Number.isInteger(amount) || amount < 1 || amount >= listPrice) return null;
  return amount;
}

function activeSalePrice(listPrice, sale, now = new Date()) {
  if (!saleActive(sale, now)) return null;
  return discountedAmount(listPrice, sale.percent);
}

function saleIsOn(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
}

function readSale(input, listPrice) {
  if (!saleIsOn(input?.onSale)) return { sale: null };
  if (!Number.isInteger(listPrice) || listPrice <= 0) {
    return { error: 'Enter a price before marking the event on sale.' };
  }

  const raw = input.salePercent;
  const percent = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
  if (!Number.isInteger(percent) || percent < 1 || percent > 99) {
    return { error: 'Enter a whole percent from 1 to 99.' };
  }

  const endsRaw = String(input.saleEnds ?? '').trim();
  let endsOn = '';
  if (endsRaw) {
    endsOn = validDate(endsRaw);
    if (!endsOn) return { error: 'Enter a sale end date.' };
  }

  if (!discountedAmount(listPrice, percent)) {
    return { error: 'That discount does not leave a price.' };
  }

  return { sale: endsOn ? { percent, endsOn } : { percent } };
}

function presentSale(listPrice, sale, now = new Date()) {
  const salePrice = listPrice ? activeSalePrice(listPrice, sale, now) : null;
  if (!salePrice) {
    return {
      onSale: false,
      salePercent: '',
      saleEnds: '',
      salePrice: null,
      salePriceLabel: '',
    };
  }
  return {
    onSale: true,
    salePercent: sale.percent,
    saleEnds: typeof sale.endsOn === 'string' ? sale.endsOn : '',
    salePrice,
    salePriceLabel: formatUsd(salePrice),
  };
}

module.exports = {
  activeSalePrice,
  discountedAmount,
  formatUsd,
  pacificDate,
  presentSale,
  readSale,
  saleActive,
};
