// Lightweight formatting helpers.

export const pct = (v, d = 2) => {
  if (v === null || v === undefined || Number.isNaN(+v)) return '—';
  return (v * 100).toFixed(d) + '%';
};

export const num = (v, d = 4) => {
  if (v === null || v === undefined || Number.isNaN(+v)) return '—';
  return Number(v).toFixed(d);
};

export const dollar = (v, d = 0) => {
  if (v === null || v === undefined || Number.isNaN(+v)) return '—';
  return '$' + Number(v).toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
};

export const compactDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: '2-digit', month: 'short' });
};
