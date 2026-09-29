export const fmtEur = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
export const fmtNum = (n: number) => n.toLocaleString('nl-NL', { maximumFractionDigits: 0 });
export const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;
export const fmtDecimal = (n: number) => n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
