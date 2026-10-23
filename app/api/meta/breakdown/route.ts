import { NextRequest, NextResponse } from 'next/server';
import { getMetaBreakdown } from '@/lib/meta';
import { META_CAMPAIGNS } from '@/lib/seedKpiTargets';

export const dynamic = 'force-dynamic'; // altijd verse cijfers, nooit de route zelf cachen

// Doelgroep- (adset, ?level=adset) en advertentieniveau (?level=ad), live — gescopet op exact de
// campagne(s) die de aanroeper meegeeft via ?campagnes=EB video,Skill video (korte labels, zoals
// in META_CAMPAIGNS). Geen campagnes meegegeven = alle bekende Meta-campagnes. Gebruikt door
// components/KanalenTab.tsx, dat hier alleen de op dat moment geselecteerde campagne(s) in meegeeft
// — zo blijft de doelgroep-/advertentietabel altijd exact gefilterd op de Kanalen-selectie.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const level = searchParams.get('level') === 'ad' ? 'ad' : 'adset';
    const campagneParam = searchParams.get('campagnes');
    const startDate = searchParams.get('startDate') ?? '2026-10-01';
    const endDate = searchParams.get('endDate') ?? '2026-11-30';
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);

    const labels = campagneParam ? campagneParam.split(',').filter(Boolean) : Object.keys(META_CAMPAIGNS);
    const campaignIds = labels.map((l) => META_CAMPAIGNS[l]).filter((id): id is string => Boolean(id));
    const idToLabel = new Map(Object.entries(META_CAMPAIGNS).map(([label, id]) => [id, label]));

    const rows = await getMetaBreakdown(campaignIds, start, end, level);
    const result = rows.map((r) => ({ ...r, campagne: idToLabel.get(r.campaignId) ?? r.campaignId }));

    return NextResponse.json({ rows: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
