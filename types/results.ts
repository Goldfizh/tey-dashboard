// Datamodel voor "Totaaloverzicht" en de "Kanalen"-detailpagina's.
// Kanaalnamen zijn vrije tekst (ook "Youtube" e.d.), geen vaste enum.
//
// Kernidee: Achieved en KPI zijn twee verschillende soorten data, dus ook twee
// verschillende vormen:
//  - Achieved = wat er echt gebeurd is (later ingeladen vanuit campagnetooling):
//    budget + ruwe volumes (impressies/klikken/...). Kosten-per-x zijn hieruit
//    afgeleid, nooit los ingevoerd.
//  - KPI = het target dat je vooraf zet: budget + kosten-per-x-targets (CPM/CPC/...).
//    De verwachte volumes worden daaruit berekend (budget ÷ kosten-target).

export interface MetricPairDef {
  key: string;           // stabiele id, ook de sleutel in volumes-records
  costLabel: string;     // 'CPM', 'CPC', 'CPA', ...
  volumeLabel: string;   // 'Impressions', 'Clicks', 'Conversies', ...
  perThousand?: boolean; // true = kosten per 1.000 (CPM-stijl), anders per stuk
  rateLabel?: string;    // bv. 'CTR' — alleen bij vooraf gedefinieerde doel-bundels;
                         // berekend als dit-volume ÷ impressions. Aangepaste
                         // metrics krijgen geen rate: die staan op zichzelf.
  goalLabel?: string;    // 'Verkeer' / 'Views' / 'Leads' — naam in de metric-manager
}

// CPM ↔ Impressions is het fundament: staat altijd aan, niet uit te zetten.
export const BASE_METRIC: MetricPairDef = { key: 'impressions', costLabel: 'CPM', volumeLabel: 'Impressions', perThousand: true };

// Doel-bundels: kies je doel (verkeer/video/leads) en je krijgt kosten + volume
// + de bijpassende ratio (t.o.v. impressions) er automatisch bij.
export const GOAL_METRIC_PRESETS: MetricPairDef[] = [
  { key: 'clicks', goalLabel: 'Verkeer', costLabel: 'CPC', volumeLabel: 'Clicks', rateLabel: 'CTR' },
  // Let op: de achieved-cijfers voor dit paar komen (voor Meta) uit de "video_view"-actie — Meta's
  // 3-seconden-weergave, niet de "Videoweergaven 100%"/ThruPlay-metric die in Ads Manager te zien
  // is. De Meta Ads-connector geeft die ThruPlay-waarde niet terug, dus het label is hierop
  // aangepast zodat niemand "Weergaven (3s)" verwart met een 100%-completion-metric.
  { key: 'completedViews', goalLabel: 'Views', costLabel: 'CP3S', volumeLabel: 'Weergaven (3s)', rateLabel: 'VTR' },
  { key: 'conversions', goalLabel: 'Leads', costLabel: 'CPA', volumeLabel: 'Conversies', rateLabel: 'Conversie %' },
];

// De catalogus start met alle vaste doel-bundels — per campagne kies je hieruit
// welke meetellen (zie ChannelResultRow.activePairKeys). Aangepaste metrics komen
// er via MetricPairManager bij.
export const DEFAULT_METRIC_PAIRS: MetricPairDef[] = [...GOAL_METRIC_PRESETS];

export function slugify(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'metric';
}

export function uniqueKey(base: string, existing: MetricPairDef[]): string {
  let key = base;
  let i = 2;
  while (key === BASE_METRIC.key || existing.some((p) => p.key === key)) { key = `${base}_${i}`; i += 1; }
  return key;
}

// Wat er echt gebeurd is — vast/read-only in de UI (bron: campagnetooling).
// volumes bevat o.a. 'impressions' en 'reach' (voor de Bekendheid-bundel) plus
// eventuele actieve doel-bundels (clicks/completedViews/conversions/...).
export interface AchievedMetrics {
  spend: number;
  volumes: Record<string, number>;
}

// Het vooraf ingestelde target — budget + kosten-per-x, volumes zijn berekend.
// frequency is los van costs: het is geen €-kosten-target maar drijft Bereik
// (bereik = impressies ÷ frequentie).
export interface KpiMetrics {
  spend: number;
  costs: Record<string, number>;
  frequency: number;
}

export interface Comment {
  date: string; // YYYY-MM-DD, automatisch vastgelegd bij het toevoegen
  text: string;
}

export interface ChannelResultRow {
  id: string;
  kanaal: string;
  campagne: string;
  achieved: AchievedMetrics;
  kpi: KpiMetrics;
  comments: Comment[];
  // Welke doel-bundels (uit de metricPairs-catalogus) voor déze campagne meetellen.
  // Bekendheid (Impressies/Bereik/Frequentie/CPM) zit hier niet in — die staat altijd aan.
  activePairKeys: string[];
}

// Eén advertentie (LinkedIn-creative) — geen eigen KPI-target, hangt onder
// een doelgroep (ChannelResultRow.id) die wél een budget/target heeft.
export interface AdRow {
  id: string;
  name: string;
  doelgroepId: string;
  achieved: AchievedMetrics;
}

export function addComment(rows: ChannelResultRow[], rowId: string, text: string, today: Date): ChannelResultRow[] {
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return rows.map((r) => (r.id === rowId ? { ...r, comments: [...r.comments, { date, text }] } : r));
}

export interface Pacing {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export function emptyAchieved(): AchievedMetrics {
  return { spend: 0, volumes: {} };
}

export function emptyKpi(): KpiMetrics {
  return { spend: 0, costs: {}, frequency: 0 };
}

// Generieke vorm voor optellingen/afleidingen: budget + volumes.
export interface SpendVolumes {
  spend: number;
  volumes: Record<string, number>;
}

export function costFor(sv: SpendVolumes, pair: MetricPairDef): number | null {
  const vol = sv.volumes[pair.key] ?? 0;
  if (vol <= 0) return null;
  return pair.perThousand ? (sv.spend / vol) * 1000 : sv.spend / vol;
}

export function volumeFor(kpi: KpiMetrics, pair: MetricPairDef): number {
  const cost = kpi.costs[pair.key] ?? 0;
  if (cost <= 0) return 0;
  return pair.perThousand ? (kpi.spend / cost) * 1000 : kpi.spend / cost;
}

// Zet een KpiMetrics om naar SpendVolumes (volumes berekend uit de kosten-targets),
// zodat KPI-rijen met dezelfde functies opgeteld/afgeleid kunnen worden als Achieved.
export function kpiToSpendVolumes(kpi: KpiMetrics, pairs: MetricPairDef[]): SpendVolumes {
  const volumes: Record<string, number> = {};
  for (const p of pairs) volumes[p.key] = volumeFor(kpi, p);
  // Bereik wordt niet uit een kosten-target afgeleid maar uit de frequentie-target:
  // bereik = impressies ÷ frequentie. Zo telt "reach" vanzelf mee in elke optelling.
  if (volumes.impressions > 0 && kpi.frequency > 0) {
    volumes.reach = volumes.impressions / kpi.frequency;
  }
  return { spend: kpi.spend, volumes };
}

export function sumSpendVolumes(list: SpendVolumes[]): SpendVolumes {
  const spend = list.reduce((s, m) => s + m.spend, 0);
  const volumes: Record<string, number> = {};
  for (const m of list) {
    for (const [k, v] of Object.entries(m.volumes)) {
      volumes[k] = (volumes[k] ?? 0) + v;
    }
  }
  return { spend, volumes };
}

// CTR/VTR-achtige verhoudingen tussen twee volumes (bv. clicks/impressions).
export function ratio(sv: SpendVolumes, numeratorKey: string, denominatorKey: string): number | null {
  const num = sv.volumes[numeratorKey] ?? 0;
  const den = sv.volumes[denominatorKey] ?? 0;
  if (den <= 0) return null;
  return num / den;
}

export interface Awareness {
  impressions: number;
  reach: number;
  frequency: number | null;
  cpm: number | null;
}

// Bekendheid vanuit ruwe volumes — voor Achieved-rijen én elke opgetelde
// SpendVolumes (totalen, KPI-optellingen, doelgroep/ad/dag-opsplitsingen).
export function awarenessFromVolumes(sv: SpendVolumes): Awareness {
  return {
    impressions: sv.volumes.impressions ?? 0,
    reach: sv.volumes.reach ?? 0,
    frequency: ratio(sv, 'impressions', 'reach'),
    cpm: costFor(sv, BASE_METRIC),
  };
}

// Bekendheid vanuit een KPI-target (CPM + frequentie zijn de instelbare targets,
// impressies/bereik zijn daaruit berekend) — voor de per-rij KPI-weergave.
export function awarenessFromKpi(kpi: KpiMetrics): Awareness {
  const impressions = volumeFor(kpi, BASE_METRIC);
  const cpm = kpi.costs.impressions ?? 0;
  const frequency = kpi.frequency ?? 0;
  const reach = frequency > 0 ? impressions / frequency : 0;
  return { impressions, reach, frequency: frequency > 0 ? frequency : null, cpm: cpm > 0 ? cpm : null };
}
