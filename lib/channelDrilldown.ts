import type { SpendVolumes } from '@/types/results';

// Gedeelde vormen voor doelgroep-/advertentie-/dagniveau — gevuld met échte
// LinkedIn-data (zie app/api/linkedin/campaigns/route.ts + app/page.tsx),
// niet meer gegenereerd. Namen blijven staan zodat KanalenTab/AnalyseTab/
// PacingChart/ComparisonTool ongewijzigd kunnen blijven importeren.

export interface DrilldownEntity {
  name: string;
  metrics: SpendVolumes;
}

export interface DailyEntity {
  date: string;
  metrics: SpendVolumes;
}

export type GroupBy = 'dag' | 'doelgroep' | 'advertentie' | 'campagne' | 'kanaal';

export interface GroupedEntity {
  label: string;
  metrics: SpendVolumes;
}
