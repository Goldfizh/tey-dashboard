// KPI-targets uit het Q4-mediaplan (Naamsbekendheid / Interactie / Verkeer), per kanaal en
// campagne. Campagnenaam = het eenvoudige contentlabel uit het mediaplan (EB video/Extra
// video's/Skill video's/Persoonlijke verhalen), gelijk over alle kanalen — bewust NIET de volle
// namen zoals ze in Meta Ads Manager staan (zie META_CAMPAIGN_IDS hieronder voor die koppeling).
// Alleen Meta heeft een "Persoonlijke verhalen"-campagne; LinkedIn en YouTube niet.
//
// `spend` = kolom "Mediaspend" (het nieuwe, geplande budget voor de flight). Bewust NIET
// "Uitgegeven" of "Nieuw budget" — dat zijn deels realisatiecijfers/lifetime-totalen, hier gaat
// het uitdrukkelijk alleen om het target voor déze flight.
// "Youtube shorts" uit het mediaplan is hier onder kanaal "YouTube" gezet (zelfde kanaal, andere
// contentvorm) — er bestaat geen apart "YouTube Shorts"-kanaal in het datamodel.
//
// Meta-achieved: live opgehaald op 2026-09-30 via de Meta Ads-connector voor account
// act_913728597234821 ("Forensisch Centrum Teylingereind"), gescopet op de flight-periode
// 2026-10-01 t/m 2026-11-30 (exact de Mediaspend-periode hierboven) — resultaat: 0 rijen. De
// flight begint pas 1 oktober, dus achieved is voor alle Meta-campagnes terecht nog €0, niet
// omdat de koppeling niet werkt. Ter info (NIET ingevuld, want een ander tijdvak dus niet
// vergelijkbaar met de Mediaspend-target hierboven): recente ~30-dagen-cijfers laten al wél
// spend zien op alle 4 (lifetime-to-date, ruwweg gelijk aan de "Uitgegeven"-kolom in het
// mediaplan) — zeg het als je die liever als achieved wil zien i.p.v. €0.
const META_CAMPAIGN_IDS: Record<string, string> = {
  'EB video': '120243062630350642', // "Employer Branding 2026 | Interactie | Employer brand video | Always on"
  "Extra video's": '120243077768790642', // "Employer Branding 2026 | Interactie | Extra video's | Always on"
  "Skill video's": '120243066967440642', // "Employer Branding 2026 | Interactie | Skill Ad | Always on"
  'Persoonlijke verhalen': '120251198804710642', // "Employer Branding 2026 | Verkeer | Medewerkersverhalen | Always on"
};
void META_CAMPAIGN_IDS; // bewaard voor de volgende live Meta-fetch, nog niet elders gebruikt

import type { Platform } from '@/types/campaign';
import { PLATFORM_LABEL, slugify } from '@/lib/resultsAdapter';
import type { ChannelResultRow } from '@/types/results';
import { emptyAchieved } from '@/types/results';

interface SeedKpiRow {
  platform: Platform;
  campagne: string;
  spend: number;
  cpm: number;
  frequency: number;
  cpc?: number;
  cpcv?: number;
}

const SEED_KPI_ROWS: SeedKpiRow[] = [
  // ── Naamsbekendheid ──
  { platform: 'linkedin', campagne: 'EB video', spend: 775, cpm: 18.07, frequency: 4, cpc: 5.27 },
  { platform: 'meta',     campagne: 'EB video', spend: 965, cpm: 5.50,  frequency: 4, cpcv: 0.15 },
  { platform: 'youtube',  campagne: 'EB video', spend: 650, cpm: 4.64,  frequency: 4, cpcv: 0.009 },

  // ── Interactie ──
  { platform: 'linkedin', campagne: "Extra video's", spend: 900,  cpm: 18.07, frequency: 4, cpc: 5.27 },
  { platform: 'meta',     campagne: "Extra video's", spend: 1050, cpm: 5.05,  frequency: 4, cpcv: 0.19 },
  { platform: 'youtube',  campagne: "Extra video's", spend: 590,  cpm: 4.37,  frequency: 4, cpcv: 0.007 },

  { platform: 'linkedin', campagne: "Skill video's", spend: 1040, cpm: 16.83, frequency: 4, cpc: 4.91 },
  { platform: 'meta',     campagne: "Skill video's", spend: 950,  cpm: 5.64,  frequency: 4, cpcv: 0.22 },
  { platform: 'youtube',  campagne: "Skill video's", spend: 450,  cpm: 2.19,  frequency: 0, cpcv: 0.13 }, // YouTube Shorts — frequentie niet opgegeven in het mediaplan

  // ── Verkeer ── (alleen Meta heeft hier een campagne)
  { platform: 'meta', campagne: 'Persoonlijke verhalen', spend: 845, cpm: 9.00, frequency: 4, cpc: 0.45 },
];

export function buildSeedKpiRows(): ChannelResultRow[] {
  return SEED_KPI_ROWS.map((r) => {
    const costs: Record<string, number> = { impressions: r.cpm };
    const activePairKeys: string[] = [];
    if (r.cpc !== undefined) { costs.clicks = r.cpc; activePairKeys.push('clicks'); }
    if (r.cpcv !== undefined) { costs.completedViews = r.cpcv; activePairKeys.push('completedViews'); }
    return {
      id: `${r.platform}__${slugify(r.campagne)}`,
      kanaal: PLATFORM_LABEL[r.platform],
      campagne: r.campagne,
      // Meta: live gecheckt (zie module-comment) — flight-scoped achieved is terecht 0.
      // LinkedIn/YouTube: geen live koppeling beschikbaar, dus ook leeg.
      achieved: emptyAchieved(),
      kpi: { spend: r.spend, costs, frequency: r.frequency },
      activePairKeys,
      comments: [],
    };
  });
}
