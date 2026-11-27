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
  'Informatieavond': '906257954',      // Wervingscampagne 2026 - Verkeer - Informatieavond — toegevoegd op 2026-11-16
  'Doorgroeimogelijkheden': '911314884', // Verkeer — toegevoegd op 2026-11-27
};

// Meta-advertentieaccount van Teylingereind: 913728597234821 ("Forensisch Centrum
// Teylingereind", env var META_AD_ACCOUNT_ID). label -> Meta campaign-ID. Gebruikt door
// app/api/meta/campaigns/route.ts en app/api/meta/breakdown/route.ts (via lib/meta.ts) om precies
// déze campagnes op te halen, rechtstreeks via de Graph API — niet meer via de handmatige
// chat-connector-snapshot.
export const META_CAMPAIGNS: Record<string, string> = {
  'EB video': '120243062630350642',              // Employer Branding 2026 | Interactie | Employer brand video | Always on
  'Skill video': '120243066967440642',           // Employer Branding 2026 | Interactie | Skill Ad | Always on
  'Extra video': '120243077768790642',           // Employer Branding 2026 | Interactie | Extra video's | Always on
  'Persoonlijke verhalen': '120251198804710642', // Employer Branding 2026 | Verkeer | Medewerkersverhalen | Always on
  'Vacatures': '120241528532830642',             // Teylingereind | Vacatures | Always on
  'Informatieavond': '120223179012160642',       // Teylingereind | Informatieavond | Always on
  'Doorgroeimogelijkheden': '120252186575610642', // Employer Branding 2026 | Verkeer | Doorgroeimogelijkheden | Always on — toegevoegd op 2026-11-27
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
  cpc?: number;  // zet 'clicks' actief naast eventueel 'completedViews'/'cpa' — een rij mag er meerdere tegelijk hebben
  cpcv?: number;
  cpa?: number;  // cost per lead — zet 'conversions' actief
}

// De 3 Meta-videocampagnes (EB video/Extra video/Skill video) hebben naast hun CPCV-doel óók een
// CPC-doel ontvangen (2026-10-09) — zonder die target bleven hun échte clicks buiten de Clicks/
// CPC-kolommen en dus buiten de opgetelde Totaalresultaten vallen, wat dat totaalbeeld vertekende.
//
// Budgetten op 2026-11-27 opgehoogd: de flight loopt nu ook door in december (zie FLIGHT_END in
// app/page.tsx en de /api/*-routes), en alle bestaande campagnes kregen daarvoor een extra stuk
// budget bovenop hun bestaande KPI-target (geen vervanging, dus hieronder al opgeteld).

const SEED_KPI_ROWS: SeedKpiRow[] = [
  // ── Naamsbekendheid ──
  { platform: 'linkedin', campagne: 'EB video', spend: 1163, cpm: 18.07, frequency: 4, cpc: 5.27 },
  { platform: 'meta',     campagne: 'EB video', spend: 1448, cpm: 5.50,  frequency: 4, cpcv: 0.15, cpc: 5.45 },
  { platform: 'youtube',  campagne: 'EB video', spend: 975,  cpm: 4.64,  frequency: 4, cpcv: 0.009 },

  // ── Interactie ──
  { platform: 'linkedin', campagne: 'Extra video', spend: 1240, cpm: 18.07, frequency: 4, cpc: 5.27 },
  { platform: 'meta',     campagne: 'Extra video', spend: 1570, cpm: 5.05,  frequency: 4, cpcv: 0.19, cpc: 2.69 },
  { platform: 'youtube',  campagne: 'Extra video', spend: 885,  cpm: 4.37,  frequency: 4, cpcv: 0.007 },

  { platform: 'linkedin', campagne: 'Skill video', spend: 1515, cpm: 16.83, frequency: 4, cpc: 4.91 },
  { platform: 'meta',     campagne: 'Skill video', spend: 1470, cpm: 5.64,  frequency: 4, cpcv: 0.22, cpc: 4.88 },
  { platform: 'youtube',  campagne: 'Skill video', spend: 675,  cpm: 2.19,  frequency: 0, cpcv: 0.13 }, // YouTube Shorts — frequentie niet opgegeven in het mediaplan

  // ── Verkeer ──
  { platform: 'meta', campagne: 'Persoonlijke verhalen', spend: 1311, cpm: 9.00, frequency: 4, cpc: 0.45 },
  // LinkedIn "Persoonlijke verhalen" (Medewerkers verhalen, id 901424154) — KPI-target ontvangen op 2026-10-09.
  { platform: 'linkedin', campagne: 'Persoonlijke verhalen', spend: 1245, cpm: 20.00, frequency: 4, cpc: 4.50 },
  // LinkedIn "Informatieavond" (Wervingscampagne 2026 - Verkeer - Informatieavond, id 906257954)
  // — toegevoegd op 2026-11-16. Zelfde cpm/cpc als de andere Verkeer-campagne op LinkedIn
  // (Persoonlijke verhalen hierboven) — geen eigen KPI's opgegeven, alleen budget.
  { platform: 'linkedin', campagne: 'Informatieavond', spend: 728, cpm: 20.00, frequency: 4, cpc: 4.50 },
  // "Doorgroeimogelijkheden" — nieuwe Verkeer-campagne op beide kanalen, toegevoegd op 2026-11-27
  // (zie LINKEDIN_CAMPAIGNS/META_CAMPAIGNS). Eigen cpm/cpc, geen cpcv/cpa opgegeven.
  { platform: 'linkedin', campagne: 'Doorgroeimogelijkheden', spend: 500, cpm: 29.87, frequency: 4, cpc: 7.45 },
  { platform: 'meta',     campagne: 'Doorgroeimogelijkheden', spend: 566, cpm: 9.00,  frequency: 4, cpc: 0.45 },

  // ── Leads (always-on wervingscampagnes, los van het Q4-mediaplan hierboven) ──
  // Toegevoegd op 2026-10-23. Beide zijn Meta OUTCOME_LEADS-campagnes; "Cost per lead" is het
  // juiste custom-conversion-event per campagne (zie LEAD_EVENT_BY_CAMPAIGN in lib/meta.ts).
  // Frequentie niet opgegeven — blijft op 0 (Bereik dus niet afgeleid).
  { platform: 'meta', campagne: 'Informatieavond', spend: 7500, cpm: 12.49, frequency: 0, cpc: 1.16, cpa: 206.17 },
  { platform: 'meta', campagne: 'Vacatures',       spend: 1500, cpm: 11.21, frequency: 0, cpc: 1.21, cpa: 83.38 },
];

export function buildSeedKpiRows(): ChannelResultRow[] {
  return SEED_KPI_ROWS.map((r) => {
    const costs: Record<string, number> = { impressions: r.cpm };
    const activePairKeys: string[] = [];
    if (r.cpc !== undefined) { costs.clicks = r.cpc; activePairKeys.push('clicks'); }
    if (r.cpcv !== undefined) { costs.completedViews = r.cpcv; activePairKeys.push('completedViews'); }
    if (r.cpa !== undefined) { costs.conversions = r.cpa; activePairKeys.push('conversions'); }
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
