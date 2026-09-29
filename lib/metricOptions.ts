import type { MetricPairDef, SpendVolumes } from '@/types/results';
import { awarenessFromVolumes, costFor, ratio } from '@/types/results';
import { fmtDecimal, fmtEur, fmtNum, fmtPct } from '@/lib/format';

export type MetricUnit = 'currency' | 'count' | 'percent' | 'decimal';

export interface MetricOption {
  key: string;
  label: string;
  unit: MetricUnit;
  getValue: (sv: SpendVolumes) => number | null;
}

export const UNIT_FORMATTERS: Record<MetricUnit, (n: number) => string> = {
  currency: fmtEur,
  count: fmtNum,
  percent: fmtPct,
  decimal: fmtDecimal,
};

// Eén platte lijst van alle kies-bare metrics — Bekendheid (altijd) + elk actief
// doel-bundel-paar (cost/volume/rate). Gebruikt door de Analyse-tab om de
// metric-dropdowns te vullen én om waarden/eenheden consistent te formatteren
// met de rest van het dashboard (dezelfde awarenessFromVolumes/costFor/ratio).
export function buildMetricOptions(metricPairs: MetricPairDef[]): MetricOption[] {
  const options: MetricOption[] = [
    { key: 'spend', label: 'Amount spent', unit: 'currency', getValue: (sv) => sv.spend },
    { key: 'impressions', label: 'Impressies', unit: 'count', getValue: (sv) => awarenessFromVolumes(sv).impressions },
    { key: 'reach', label: 'Bereik', unit: 'count', getValue: (sv) => awarenessFromVolumes(sv).reach },
    { key: 'frequency', label: 'Frequentie', unit: 'decimal', getValue: (sv) => awarenessFromVolumes(sv).frequency },
    { key: 'cpm', label: 'CPM', unit: 'currency', getValue: (sv) => awarenessFromVolumes(sv).cpm },
  ];
  for (const p of metricPairs) {
    options.push({ key: `${p.key}__cost`, label: p.costLabel, unit: 'currency', getValue: (sv) => costFor(sv, p) });
    options.push({ key: `${p.key}__volume`, label: p.volumeLabel, unit: 'count', getValue: (sv) => sv.volumes[p.key] ?? 0 });
    if (p.rateLabel) {
      options.push({ key: `${p.key}__rate`, label: p.rateLabel, unit: 'percent', getValue: (sv) => ratio(sv, p.key, 'impressions') });
    }
  }
  return options;
}
