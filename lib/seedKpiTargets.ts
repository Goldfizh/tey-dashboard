// KPI-targets uit het Q4-mediaplan, per kanaal en campagne. Campagnenaam is overal het korte
// label (EB video/Extra video/Skill video/Persoonlijke verhalen) — bewust niet de volle naam
// zoals in Meta Ads Manager of LinkedIn Campaign Manager (zie de *_CAMPAIGNS-mappings hieronder
// voor die koppeling). Alleen Meta heeft een "Persoonlijke verhalen"-campagne; LinkedIn en
// YouTube niet.
//
// `spend`/`cpm`/`cpc`/`cpcv`/`frequency` = de KPI-targets uit het mediaplan (kolom "Mediaspend"
// e.v.), niet de realisatiecijfers uit de "Uitgegeven"/"Nieuw budget"-kolommen.
//
// Geen automatische koppeling met de Sheets-feed (/api/campaigns): die bevat ALLE actieve Meta/
// LinkedIn-campagnes van Teylingereind (en voor Meta bovendien alleen data van 3 april t/m 2 juni
// 2026 — niet de huidige Q4-periode), niet alleen deze 10 — automatisch mergen gaf dubbele/extra
// rijen. Achieved komt daarom per kanaal uit een eigen live API-koppeling (zie LINKEDIN_CAMPAIGNS/
// META_CAMPAIGNS hieronder), gescopet op precies deze campagne-ID's.

import type { Platform } from '@/types/campaign';
import { PLATFORM_LABEL, slugify } from '@/lib/resultsAdapter';
import type { ChannelResultRow } from '@/types/results';
import { emptyAchieved } from '@/types/results';

// LinkedIn-advertentieaccount van Teylingereind: 513737683 (urn:li:sponsoredAccount:513737683).
// 757030574 is GEEN account-ID maar de campagnegroep waaronder alle 3 onderstaande campagnes
// hangen. Elke rij hieronder is wat Teylingereind zelf "een campagne" noemt — in LinkedIn's eigen
// hiërarchie is dat een losse Campaign (niet een Campaign Group en niet een Creative).
//
// label -> LinkedIn campaign-ID. Gebruikt door app/api/linkedin/campaigns/route.ts (via
// lib/linkedin.ts) om precies déze 3 campagnes op te halen — niet alle LinkedIn-campagnes van het
// account (zie de module-comment bovenaan dit bestand over waarom niet automatisch alles mergen).
export const LINKEDIN_CAMPAIGNS: Record<string, string> = {
  'EB video': '585205134',             // Wervingscampagne 2026 - Interactie - Employer brand merkvideo (klikken)
  'Skill video': '583309154',          // Wervingscampagne 2026 - Interactie - Skill Ads (klikken)
  'Extra video': '584808854',          // Wervingscampagne 2026 - Interactie - Extra video's (klikken)
  'Persoonlijke verhalen': '901424154', // Medewerkers verhalen — 4e advertentieset onder campagnegroep "Employer branding klikken" (757030574)
};

// Meta-advertentieaccount van Teylingereind: 913728597234821 ("Forensisch Centrum
// Teylingereind", env var META_AD_ACCOUNT_ID). label -> Meta campaign-ID. Gebruikt door
// app/api/meta/campaigns/route.ts (via lib/meta.ts) om precies déze 4 campagnes op te halen,
// rechtstreeks via de Graph API — niet meer via de handmatige chat-connector-snapshot.
export const META_CAMPAIGNS: Record<string, string> = {
  'EB video': '120243062630350642',              // Employer Branding 2026 | Interactie | Employer brand video | Always on
  'Skill video': '120243066967440642',           // Employer Branding 2026 | Interactie | Skill Ad | Always on
  'Extra video': '120243077768790642',           // Employer Branding 2026 | Interactie | Extra video's | Always on
  'Persoonlijke verhalen': '120251198804710642', // Employer Branding 2026 | Verkeer | Medewerkersverhalen | Always on
};

// LinkedIn en Meta: beide live gekoppeld via hun eigen /api/*/campaigns-route (lib/linkedin.ts,
// lib/meta.ts), rechtstreeks de bijbehorende Marketing API — geen statische snapshot meer. De
// `achieved`-waarden in buildSeedKpiRows() blijven hieronder op 0 (placeholder bij eerste render);
// de echte cijfers komen er na het laden overheen via applyAchievedByLabel() in app/page.tsx.
// YouTube: koppeling moet nog gebouwd worden (geen databron bekend), blijft op 0.

interface SeedKpiRow {
  platform: Platform;
  campagne: string;
  spend: number;
  cpm: number;
  frequency: number;
  cpc?: number;  // zet 'clicks' actief naast eventueel 'completedViews' — een rij mag beide tegelijk hebben
  cpcv?: number;
}

// De 3 Meta-videocampagnes (EB video/Extra video/Skill video) hebben naast hun CPCV-doel óók een
// CPC-doel ontvangen (2026-10-09) — zonder die target bleven hun échte clicks buiten de Clicks/
// CPC-kolommen en dus buiten de opgetelde Totaalresultaten vallen, wat dat totaalbeeld vertekende.

const SEED_KPI_ROWS: SeedKpiRow[] = [
  // ── Naamsbekendheid ──
  { platform: 'linkedin', campagne: 'EB video', spend: 775, cpm: 18.07, frequency: 4, cpc: 5.27 },
  { platform: 'meta',     campagne: 'EB video', spend: 965, cpm: 5.50,  frequency: 4, cpcv: 0.15, cpc: 5.45 },
  { platform: 'youtube',  campagne: 'EB video', spend: 650, cpm: 4.64,  frequency: 4, cpcv: 0.009 },

  // ── Interactie ──
  { platform: 'linkedin', campagne: 'Extra video', spend: 900,  cpm: 18.07, frequency: 4, cpc: 5.27 },
  { platform: 'meta',     campagne: 'Extra video', spend: 1050, cpm: 5.05,  frequency: 4, cpcv: 0.19, cpc: 2.69 },
  { platform: 'youtube',  campagne: 'Extra video', spend: 590,  cpm: 4.37,  frequency: 4, cpcv: 0.007 },

  { platform: 'linkedin', campagne: 'Skill video', spend: 1040, cpm: 16.83, frequency: 4, cpc: 4.91 },
  { platform: 'meta',     campagne: 'Skill video', spend: 950,  cpm: 5.64,  frequency: 4, cpcv: 0.22, cpc: 4.88 },
  { platform: 'youtube',  campagne: 'Skill video', spend: 450,  cpm: 2.19,  frequency: 0, cpcv: 0.13 }, // YouTube Shorts — frequentie niet opgegeven in het mediaplan

  // ── Verkeer ──
  { platform: 'meta', campagne: 'Persoonlijke verhalen', spend: 845, cpm: 9.00, frequency: 4, cpc: 0.45 },
  // LinkedIn "Persoonlijke verhalen" (Medewerkers verhalen, id 901424154) — KPI-target ontvangen op 2026-10-09.
  { platform: 'linkedin', campagne: 'Persoonlijke verhalen', spend: 845, cpm: 20.00, frequency: 4, cpc: 4.50 },
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
      achieved: emptyAchieved(),
      kpi: { spend: r.spend, costs, frequency: r.frequency },
      activePairKeys,
      comments: [],
    };
  });
}
