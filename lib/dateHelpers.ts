export type Preset = 'week' | '14days' | 'month' | '3months' | 'custom';

export function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function presetRange(preset: Preset, customFrom: string, customTo: string): { from: string; to: string } {
  if (preset === 'custom') return { from: customFrom, to: customTo };
  const today = new Date();
  const to = fmt(today);
  if (preset === 'week') {
    const day = today.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday = 0
    const mon = new Date(today);
    mon.setDate(today.getDate() - diff);
    return { from: fmt(mon), to };
  }
  if (preset === '14days') {
    const start = new Date(today);
    start.setDate(today.getDate() - 13);
    return { from: fmt(start), to };
  }
  if (preset === 'month') {
    return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  }
  // 3months
  const start = new Date(today);
  start.setMonth(today.getMonth() - 3);
  return { from: fmt(start), to };
}

export const PERIOD_PRESETS: { key: Preset; label: string }[] = [
  { key: 'week', label: 'Deze week' },
  { key: '14days', label: '14 dagen' },
  { key: 'month', label: 'Deze maand' },
  { key: '3months', label: '3 maanden' },
  { key: 'custom', label: 'Aangepast' },
];

// Vorige periode van dezelfde duur, direct voorafgaand aan [from, to].
export function previousPeriod(from: string, to: string): { prevFrom: string; prevTo: string } {
  const fromD = new Date(from + 'T00:00:00');
  const toD = new Date(to + 'T00:00:00');
  const dur = toD.getTime() - fromD.getTime();
  const pTo = new Date(fromD.getTime() - 86_400_000);
  const pFrom = new Date(pTo.getTime() - dur);
  return { prevFrom: fmt(pFrom), prevTo: fmt(pTo) };
}
