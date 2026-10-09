import { NextRequest, NextResponse } from 'next/server';
import { getLinkedInCampaignResults } from '@/lib/linkedin';
import { LINKEDIN_CAMPAIGNS } from '@/lib/seedKpiTargets';

export const dynamic = 'force-dynamic'; // altijd verse cijfers, nooit de route zelf cachen

// Haalt achieved-cijfers op voor precies de 3 bekende LinkedIn-campagnes (EB video/Skill video/
// Extra video — zie LINKEDIN_CAMPAIGNS), gescopet op startDate/endDate (default: de Q4-flight-
// periode). Geeft { [label]: AchievedMetrics } terug, zodat de dashboardcode 'm 1-op-1 kan
// matchen aan de bestaande resultRows zonder een naam-matching-stap nodig te hebben.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const startDate = searchParams.get('startDate') ?? '2026-10-01';
    const endDate = searchParams.get('endDate') ?? '2026-11-30';

    const idToLabel = new Map(Object.entries(LINKEDIN_CAMPAIGNS).map(([label, id]) => [id, label]));
    const campaignIds = Object.values(LINKEDIN_CAMPAIGNS);

    const results = await getLinkedInCampaignResults(
      campaignIds,
      new Date(`${startDate}T00:00:00Z`),
      new Date(`${endDate}T00:00:00Z`),
    );

    const byLabel: Record<string, (typeof results)[number]['achieved']> = {};
    for (const r of results) {
      const label = idToLabel.get(r.campaignId);
      if (label) byLabel[label] = r.achieved;
    }

    return NextResponse.json(byLabel);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
