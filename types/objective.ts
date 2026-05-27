export type Objective = 'impressies' | 'verkeer' | 'video' | 'conversies' | 'leads';

export const OBJECTIVE_LABELS: Record<Objective, string> = {
  impressies: 'Impressies / bereik',
  verkeer:    'Verkeer',
  video:      'Videoviews',
  conversies: 'Conversies',
  leads:      'Leads',
};

// ── Auto-detection keyword lists ──────────────────────────────────────────────

const VIDEO_KW       = ['video', 'employer branding', 'employer brand', 'branding', ' eb ', '-eb-', '_eb_'];
const IMPRESSIES_KW  = ['awareness', 'bereik', 'reach', 'impressie'];
const VERKEER_KW     = ['traffic', 'verkeer'];
const LEADS_KW       = ['lead', 'formulier', 'form'];

function classify(name: string): Objective {
  const n = name.toLowerCase();
  if (VIDEO_KW.some((k) => n.includes(k)))       return 'video';
  if (IMPRESSIES_KW.some((k) => n.includes(k)))  return 'impressies';
  if (VERKEER_KW.some((k) => n.includes(k)))     return 'verkeer';
  if (LEADS_KW.some((k) => n.includes(k)))       return 'leads';
  return 'conversies';
}

export function autoDetectObjective(campaignNames: string[]): Objective {
  if (campaignNames.length === 0) return 'conversies';
  const counts: Record<Objective, number> = { impressies: 0, verkeer: 0, video: 0, conversies: 0, leads: 0 };
  for (const name of campaignNames) counts[classify(name)]++;
  return (Object.entries(counts) as [Objective, number][])
    .reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}
