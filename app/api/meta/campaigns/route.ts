import { NextRequest, NextResponse } from 'next/server';
import { getMetaCampaignResults, getMetaDailyRows } from '@/lib/meta';
import { META_CAMPAIGNS } from '@/lib/seedKpiTargets';

export const dynamic = 'force-dynamic'; // altijd verse cijfers, nooit de route zelf cachen

// Haalt achieved-cijfers op voor precies de 4 bekende Meta-campagnes (zie META_CAMPAIGNS),
// gescopet op startDate/endDate (default: de Q4-flight-periode). Geeft zowel het periode-totaal
// (`achieved`, voor Totaaloverzicht) als de dag-voor-dag-uitsplitsing (`daily`, als CampaignRow[]
// met campaign_name = het korte label) terug — zelfde vorm als app/api/linkedin/campaigns/route.ts.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const startDate = searchParams.get('startDate') ?? '2026-10-01';
    const endDate = searchParams.get('endDate') ?? '2026-11-30';
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);

    const idToLabel = new Map(Object.entries(META_CAMPAIGNS).map(([label, id]) => [id, label]));
    const campaignIds = Object.values(META_CAMPAIGNS);

    const [results, daily] = await Promise.all([
      getMetaCampaignResults(campaignIds, start, end),
      getMetaDailyRows(Object.fromEntries(idToLabel), start, end),
    ]);

    const achieved: Record<string, (typeof results)[number]['achieved']> = {};
    for (const r of results) {
      const label = idToLabel.get(r.campaignId);
      if (label) achieved[label] = r.achieved;
    }

    return NextResponse.json({ achieved, daily });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
