// Doelgroep- (advertentieset-) en advertentieniveau voor Meta, per campagnelabel. Live opgehaald
// op 2026-10-03 via de Meta Ads-connector (account act_913728597234821), gescopet op 2026-10-01
// t/m 2026-11-30.
//
// BELANGRIJKE AANNAME: de Meta-connector geeft bij adset-/ad-niveau geen ID of naam terug, alleen
// kale cijfers. De namen hieronder zijn toegekend door aan te nemen dat de API de rijen teruggeeft
// in oplopende advertentieset-ID-volgorde (empirisch 2x gecheckt op dezelfde campagne — de
// volgorde was stabiel — maar dit is geen gedocumenteerd/gegarandeerd API-contract). Zodra er een
// databron is die wél ID's/namen bij de cijfers levert, moet dit vervangen worden.
//
// Doelgroepnamen (Prospect vs Lookalike/LAL) zijn afgeleid uit de "(LAL)"-prefix in de echte
// advertentienamen (meta_list_ads) — dat is wel een structureel, stabiel gegeven.
//
// Advertentieniveau: alleen opgenomen waar de toewijzing 100% zeker is, dat wil zeggen een
// advertentieset met precies 1 (actieve) advertentie — dan is er geen aparte ad-niveau-aanname
// nodig, de advertentieset-waarde IS de advertentie-waarde. Advertentiesets met 2+ advertenties
// tonen we gecombineerd (niet gegokt welke naam bij welk getal hoort).
//
// Extra video ontbreekt hieronder volledig: die campagne heeft 5 advertentiesets maar leverde
// maar 4 rijen op (1 advertentieset had in deze periode geen enkele impressie) — daardoor is niet
// vast te stellen welke advertentieset ontbreekt, dus geen van de 4 rijen is betrouwbaar toe te
// wijzen. Komt terug zodra alle 5 weer data hebben, of zodra er een naam-bevattende databron is.

import type { SpendVolumes } from '@/types/results';

export interface DrilldownRow {
  label: string;
  metrics: SpendVolumes;
}

export interface CampaignDrilldown {
  doelgroepen: DrilldownRow[];
  advertenties: DrilldownRow[];
}

function sv(spend: number, impressions: number, clicks: number, reach: number, completedViews?: number): SpendVolumes {
  const volumes: Record<string, number> = { impressions, reach, clicks };
  if (completedViews !== undefined) volumes.completedViews = completedViews;
  return { spend, volumes };
}

export const META_DRILLDOWN: Record<string, CampaignDrilldown> = {
  'EB video': {
    doelgroepen: [
      { label: 'Prospect', metrics: sv(5.00, 753, 2, 710, 237) },
      { label: 'Lookalike (LAL)', metrics: sv(18.75, 2488, 9, 1940, 769) },
    ],
    advertenties: [
      { label: 'Employer brand video — gecombineerd (2 advertenties)', metrics: sv(5.00, 753, 2, 710, 237) },
      { label: '(LAL) Employer brand video — gecombineerd (2 advertenties)', metrics: sv(18.75, 2488, 9, 1940, 769) },
    ],
  },
  'Skill video': {
    doelgroepen: [
      { label: 'Overwicht (Prospect)', metrics: sv(9.03, 1724, 8, 1711, 442) },
      { label: '(LAL) Overwicht', metrics: sv(13.48, 2364, 15, 2323, 622) },
      { label: 'Samenwerken (Prospect)', metrics: sv(0.16, 12, 0, 11, 5) },
      { label: '(LAL) Forensische scherpte', metrics: sv(0.40, 48, 0, 40, 11) },
      { label: 'Forensische scherpte (Prospect)', metrics: sv(0.26, 31, 0, 30, 10) },
    ],
    advertenties: [
      { label: 'Overwicht — gecombineerd (2 advertenties)', metrics: sv(9.03, 1724, 8, 1711, 442) },
      { label: '(LAL) Overwicht - copy 1', metrics: sv(13.48, 2364, 15, 2323, 622) },
      { label: 'Samenwerken - copy 2', metrics: sv(0.16, 12, 0, 11, 5) },
      { label: '(LAL) Forensische scherpte — gecombineerd (2 advertenties)', metrics: sv(0.40, 48, 0, 40, 11) },
      { label: 'Forensische scherpte — gecombineerd (2 advertenties)', metrics: sv(0.26, 31, 0, 30, 10) },
    ],
  },
  'Persoonlijke verhalen': {
    doelgroepen: [
      { label: 'Prospect', metrics: sv(9.44, 1038, 43, 992) },
      { label: 'Lookalike (LAL)', metrics: sv(10.36, 1098, 35, 1006) },
    ],
    advertenties: [
      { label: 'Verhalen medewerkers — gecombineerd (3 advertenties)', metrics: sv(9.44, 1038, 43, 992) },
      { label: '(LAL) Verhalen medewerkers — gecombineerd (3 advertenties)', metrics: sv(10.36, 1098, 35, 1006) },
    ],
  },
};
