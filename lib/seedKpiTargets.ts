// KPI-targets (en, voor Meta, een handmatig opgehaalde achieved-snapshot) uit het Q4-mediaplan,
// per kanaal en campagne. Campagnenaam is overal het korte label (EB video/Extra video/Skill
// video/Persoonlijke verhalen) — bewust niet de volle naam zoals in Meta Ads Manager of LinkedIn
// Campaign Manager (zie de *_SOURCE-mappings hieronder voor die koppeling). Alleen Meta heeft een
// "Persoonlijke verhalen"-campagne; LinkedIn en YouTube niet.
//
// `spend`/`cpm`/`cpc`/`cpcv`/`frequency` = de KPI-targets uit het mediaplan (kolom "Mediaspend"
// e.v.), niet de realisatiecijfers uit de "Uitgegeven"/"Nieuw budget"-kolommen.
//
// Geen automatische koppeling met de Sheets-feed (/api/campaigns): die bevat ALLE actieve Meta/
// LinkedIn-campagnes van Teylingereind, niet alleen deze 10 — automatisch mergen gaf dubbele/
// extra rijen. Achieved wordt daarom per kanaal handmatig bijgewerkt totdat er een nette 1-op-1
// koppeling per kanaal is gebouwd.

import type { Platform } from '@/types/campaign';
import { PLATFORM_LABEL, slugify } from '@/lib/resultsAdapter';
import type { ChannelResultRow } from '@/types/results';
import { emptyAchieved, type AchievedMetrics } from '@/types/results';

// Bron-koppeling per campagnelabel — voor traceerbaarheid en de volgende live-fetch, niet
// elders in code gebruikt.
const META_CAMPAIGN_SOURCE: Record<string, string> = {
  'EB video': 'Employer Branding 2026 | Interactie | Employer brand video | Always on (id 120243062630350642)',
  'Skill video': 'Employer Branding 2026 | Interactie | Skill Ad | Always on (id 120243066967440642)',
  'Extra video': "Employer Branding 2026 | Interactie | Extra video's | Always on (id 120243077768790642)",
  'Persoonlijke verhalen': 'Employer Branding 2026 | Verkeer | Medewerkersverhalen | Always on (id 120251198804710642)',
};
const LINKEDIN_CAMPAIGN_SOURCE: Record<string, string> = {
  'EB video': 'Wervingscampagne 2026 - Interactie - Employer brand merkvideo (klikken) — LinkedIn account 757030574',
  'Skill video': 'Wervingscampagne 2026 - Interactie - Skill Ads (klikken) — LinkedIn account 757030574',
  'Extra video': "Wervingscampagne 2026 - Interactie - Extra video's (klikken) — LinkedIn account 757030574",
};
void META_CAMPAIGN_SOURCE;
void LINKEDIN_CAMPAIGN_SOURCE;

// Meta-achieved: live opgehaald op 2026-10-02 via de Meta Ads-connector (account
// act_913728597234821, "Forensisch Centrum Teylingereind"), gescopet op 2026-10-01 t/m
// 2026-11-30 — dekt nu de eerste 2 dagen van de flight (1-2 oktober).
// `completedViews` is Meta's "video_view"-actie (3+ sec) — de dichtstbijzijnde beschikbare proxy
// voor "voltooide view", geen exacte thruplay-telling. `conversions` staat op 0: er kwam nog geen
// lead/sollicitatie-actie door.
const META_ACHIEVED: Record<string, AchievedMetrics> = {
  'EB video':               { spend: 20.04, volumes: { impressions: 2726, reach: 2330, clicks: 10, completedViews: 855,  conversions: 0 } },
  'Skill video':            { spend: 19.76, volumes: { impressions: 3515, reach: 3449, clicks: 17, completedViews: 911,  conversions: 0 } },
  'Extra video':            { spend: 21.78, volumes: { impressions: 5259, reach: 5087, clicks: 89, completedViews: 2299, conversions: 0 } },
  'Persoonlijke verhalen':  { spend: 17.72, volumes: { impressions: 1920, reach: 1756, clicks: 73,                      conversions: 0 } },
};

// LinkedIn: geen achieved op te halen — de LinkedIn Ads-koppeling van de connector heeft nog geen
// geldige authenticatie (zelfde blokkade als eerder gemeld: ontbrekende/verlopen token, vereist
// een nieuwe app + goedkeuring in het LinkedIn Developer Portal). Blijft dus op 0 tot dat opgelost
// is. YouTube: koppeling moet nog gebouwd worden (geen databron bekend), ook op 0.

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
  { platform: 'linkedin', campagne: 'Extra video', spend: 900,  cpm: 18.07, frequency: 4, cpc: 5.27 },
  { platform: 'meta',     campagne: 'Extra video', spend: 1050, cpm: 5.05,  frequency: 4, cpcv: 0.19 },
  { platform: 'youtube',  campagne: 'Extra video', spend: 590,  cpm: 4.37,  frequency: 4, cpcv: 0.007 },

  { platform: 'linkedin', campagne: 'Skill video', spend: 1040, cpm: 16.83, frequency: 4, cpc: 4.91 },
  { platform: 'meta',     campagne: 'Skill video', spend: 950,  cpm: 5.64,  frequency: 4, cpcv: 0.22 },
  { platform: 'youtube',  campagne: 'Skill video', spend: 450,  cpm: 2.19,  frequency: 0, cpcv: 0.13 }, // YouTube Shorts — frequentie niet opgegeven in het mediaplan

  // ── Verkeer ── (alleen Meta heeft hier een campagne)
  { platform: 'meta', campagne: 'Persoonlijke verhalen', spend: 845, cpm: 9.00, frequency: 4, cpc: 0.45 },
];

export function buildSeedKpiRows(): ChannelResultRow[] {
  return SEED_KPI_ROWS.map((r) => {
    const costs: Record<string, number> = { impressions: r.cpm };
    const activePairKeys: string[] = [];
    if (r.cpc !== undefined) { costs.clicks = r.cpc; activePairKeys.push('clicks'); }
    if (r.cpcv !== undefined) { costs.completedViews = r.cpcv; activePairKeys.push('completedViews'); }
    const achieved = r.platform === 'meta' ? META_ACHIEVED[r.campagne] : undefined;
    return {
      id: `${r.platform}__${slugify(r.campagne)}`,
      kanaal: PLATFORM_LABEL[r.platform],
      campagne: r.campagne,
      achieved: achieved ?? emptyAchieved(),
      kpi: { spend: r.spend, costs, frequency: r.frequency },
      activePairKeys,
      comments: [],
    };
  });
}
