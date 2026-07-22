'use client';

import { useMemo } from 'react';
import type { CampaignRow, Platform } from '@/types/campaign';
import type { Objective } from '@/types/objective';
import { classifyObjective } from '@/types/objective';

interface Props {
  /** Current period, campaign-filtered rows. */
  rows:     CampaignRow[];
  /** Previous period (same length), campaign-filtered rows — for deterioration signals. */
  prevRows: CampaignRow[];
  /** Optional worst funnel drop-off vacancy (from GA4). */
  vacancyDropoff?: { jobTitle: string; starts: number; completed: number } | null;
}

const PLATFORM_COLOR: Record<Platform, string> = {
  linkedin: '#0077B5', meta: '#1877F2', google: '#F59E0B',
};
const PLATFORM_LABEL: Record<Platform, string> = {
  linkedin: 'LinkedIn', meta: 'Meta', google: 'Google Ads',
};

const fmtEur  = (n: number) => n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtEur2 = (n: number) => n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const fmtNum  = (n: number) => n.toLocaleString('nl-NL');

interface Sum {
  name: string; platform: Platform; objective: Objective;
  spend: number; conv: number; clicks: number; impressions: number; thruplays: number;
}

function aggregate(rows: CampaignRow[]): Map<string, Sum> {
  const m = new Map<string, Sum>();
  for (const r of rows) {
    const key = `${r.platform}::${r.campaign_name}`;
    const cur = m.get(key) ?? {
      name: r.campaign_name, platform: r.platform, objective: classifyObjective(r.campaign_name),
      spend: 0, conv: 0, clicks: 0, impressions: 0, thruplays: 0,
    };
    cur.spend += r.spend; cur.conv += r.conversions; cur.clicks += r.clicks;
    cur.impressions += r.impressions; cur.thruplays += r.thruplays ?? 0;
    m.set(key, cur);
  }
  return m;
}

// Per-campaign metric definition based on its own objective. Returns null when the metric
// isn't computable OR the channel structurally doesn't report it (e.g. Google has no video data).
function metricInfo(s: Sum) {
  const isVideo = s.objective === 'video';
  const isReach = s.objective === 'impressies' || s.objective === 'verkeer';
  // Google Ads in this dataset has no video-view (thruplay) reporting — never judge it on video.
  const videoUntracked = isVideo && s.platform === 'google';

  const label  = isVideo ? 'CPCV' : isReach ? 'CPM' : s.objective === 'leads' ? 'CPL' : 'kosten/soll.';
  const result = isVideo ? 'video views' : isReach ? 'clicks' : s.objective === 'leads' ? 'leads' : 'sollicitanten';
  const volume = isVideo ? s.thruplays : isReach ? s.clicks : s.conv;
  const metric: number | null =
    videoUntracked || volume <= 0 ? null
    : isReach ? (s.impressions > 0 ? s.spend / s.impressions * 1000 : null)
    : s.spend / volume;

  return { label, result, volume, metric, videoUntracked };
}

type Severity = 'high' | 'medium';
interface Issue {
  key: string; severity: Severity; icon: string;
  title: string; campaign: string; platform: Platform; detail: string;
}

export default function AttentionPanel({ rows, prevRows, vacancyDropoff }: Props) {
  const issues = useMemo<Issue[]>(() => {
    const cur  = aggregate(rows);
    const prev = aggregate(prevRows);
    const all  = [...cur.values()];

    const totalSpend     = all.reduce((a, s) => a + s.spend, 0);
    const spendThreshold = Math.max(50, totalSpend * 0.05);

    // Account averages computed per objective group (so a CPM isn't compared against a CPA).
    const avgByObjective = new Map<Objective, number | null>();
    const groups = new Map<Objective, Sum[]>();
    for (const s of all) {
      const g = groups.get(s.objective) ?? [];
      g.push(s); groups.set(s.objective, g);
    }
    for (const [obj, list] of groups) {
      const isReach = obj === 'impressies' || obj === 'verkeer';
      const spendSum = list.reduce((a, s) => a + s.spend, 0);
      if (isReach) {
        const imp = list.reduce((a, s) => a + s.impressions, 0);
        avgByObjective.set(obj, imp > 0 ? spendSum / imp * 1000 : null);
      } else {
        const vol = list.reduce((a, s) => a + metricInfo(s).volume, 0);
        avgByObjective.set(obj, vol > 0 ? spendSum / vol : null);
      }
    }

    const found = new Map<string, Issue>();
    const add = (key: string, issue: Issue) => { if (!found.has(key)) found.set(key, issue); };

    // 1. Budget zonder resultaat (skip metrics a channel can't report)
    for (const [key, s] of cur) {
      const info = metricInfo(s);
      if (info.videoUntracked) continue; // can't judge Google on video views
      if (s.spend >= spendThreshold && info.volume === 0) {
        add(key, {
          key, severity: 'high', icon: '🚨',
          title: `Budget zonder ${info.result}`,
          campaign: s.name, platform: s.platform,
          detail: `${fmtEur(s.spend)} uitgegeven, 0 ${info.result} in deze periode`,
        });
      }
    }

    // 2. Verslechtering vs vorige periode
    const deteriorations: { key: string; s: Sum; from: number; to: number; pct: number; label: string }[] = [];
    for (const [key, s] of cur) {
      const p = prev.get(key);
      if (!p) continue;
      const mNow = metricInfo(s).metric, mPrev = metricInfo(p).metric;
      if (mNow === null || mPrev === null || mPrev === 0) continue;
      const pct = (mNow - mPrev) / mPrev;
      if (pct >= 0.15) deteriorations.push({ key, s, from: mPrev, to: mNow, pct, label: metricInfo(s).label });
    }
    deteriorations.sort((a, b) => b.pct - a.pct);
    for (const d of deteriorations) {
      add(d.key, {
        key: d.key, severity: d.pct >= 0.4 ? 'high' : 'medium', icon: '📈',
        title: `${d.label} gestegen +${Math.round(d.pct * 100)}%`,
        campaign: d.s.name, platform: d.s.platform,
        detail: `${fmtEur2(d.from)} → ${fmtEur2(d.to)} t.o.v. vorige periode`,
      });
    }

    // 3. Boven gemiddelde kosten (binnen dezelfde doelstelling)
    const expensive = all
      .map((s) => ({ s, info: metricInfo(s), avg: avgByObjective.get(s.objective) ?? null }))
      .filter((x) => x.info.metric !== null && x.avg !== null && x.info.metric >= x.avg * 1.5 && x.s.spend >= spendThreshold)
      .sort((a, b) => b.info.metric! - a.info.metric!);
    for (const x of expensive) {
      const key = `${x.s.platform}::${x.s.name}`;
      add(key, {
        key, severity: 'medium', icon: '💸',
        title: `${x.info.label} ${(x.info.metric! / x.avg!).toFixed(1)}× boven gemiddelde`,
        campaign: x.s.name, platform: x.s.platform,
        detail: `${fmtEur2(x.info.metric!)} vs. ${fmtEur2(x.avg!)} gemiddeld`,
      });
    }

    return [...found.values()]
      .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1))
      .slice(0, 6);
  }, [rows, prevRows]);

  // Best performer — strongest conversion campaign (primary recruitment goal).
  const best = useMemo(() => {
    const cur = aggregate(rows);
    const candidates = [...cur.values()]
      .filter((s) => (s.objective === 'conversies' || s.objective === 'leads') && s.conv >= 2)
      .map((s) => ({ s, cpa: s.spend / s.conv }))
      .sort((a, b) => a.cpa - b.cpa);
    if (candidates.length === 0) return null;
    const w = candidates[0];
    return { name: w.s.name, cpa: w.cpa, label: w.s.objective === 'leads' ? 'CPL' : 'kosten/soll.' };
  }, [rows]);

  const dropoffRate = vacancyDropoff && vacancyDropoff.starts > 0
    ? 1 - vacancyDropoff.completed / vacancyDropoff.starts
    : null;

  const nothing = issues.length === 0 && !(dropoffRate !== null && dropoffRate >= 0.4);

  return (
    <div className="bg-white overflow-hidden" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}>
      <div className="px-5 py-4 flex items-baseline justify-between gap-3" style={{ borderBottom: '1px solid #DCE0E6' }}>
        <span className="gf-eyebrow">Wat vraagt aandacht</span>
        <span className="text-xs" style={{ color: '#BCC4CF' }}>signalen om bij te sturen</span>
      </div>

      <div className="divide-y" style={{ borderColor: '#F0F4F8' }}>
        {nothing && (
          <div className="px-5 py-6 text-sm flex items-center gap-2" style={{ color: '#16A34A' }}>
            <span>✓</span> Geen opvallende problemen in deze periode — niets dat directe bijsturing vraagt.
          </div>
        )}

        {issues.map((it) => {
          const color = it.severity === 'high' ? '#DC2626' : '#F59E0B';
          const bg    = it.severity === 'high' ? '#FEF2F2' : '#FFFBEB';
          return (
            <div key={it.key} className="px-5 py-3.5 flex items-start gap-3" style={{ background: bg }}>
              <span className="text-base leading-none mt-0.5">{it.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold" style={{ color }}>{it.title}</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded text-white" style={{ background: PLATFORM_COLOR[it.platform] }}>
                    {PLATFORM_LABEL[it.platform]}
                  </span>
                </div>
                <p className="text-sm font-medium mt-0.5 truncate" title={it.campaign} style={{ color: '#0B1020' }}>
                  {it.campaign}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#8C9BAF' }}>{it.detail}</p>
              </div>
            </div>
          );
        })}

        {/* Funnel drop-off (vacancy) */}
        {dropoffRate !== null && dropoffRate >= 0.4 && vacancyDropoff && (
          <div className="px-5 py-3.5 flex items-start gap-3" style={{ background: '#FFFBEB' }}>
            <span className="text-base leading-none mt-0.5">🕳️</span>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>
                Hoge uitval in sollicitatieformulier — {Math.round(dropoffRate * 100)}%
              </span>
              <p className="text-sm font-medium mt-0.5 truncate" title={vacancyDropoff.jobTitle} style={{ color: '#0B1020' }}>
                {vacancyDropoff.jobTitle}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#8C9BAF' }}>
                {fmtNum(vacancyDropoff.starts)} gestart, {fmtNum(vacancyDropoff.completed)} voltooid — kans om het formulier/de pagina te verbeteren
              </p>
            </div>
          </div>
        )}

        {/* Positive context */}
        {best && (
          <div className="px-5 py-3 flex items-center gap-3" style={{ background: '#F0FDF4' }}>
            <span className="text-base leading-none">🏆</span>
            <p className="text-xs" style={{ color: '#555E6C' }}>
              Sterkste deze periode: <span className="font-semibold" style={{ color: '#0B1020' }}>{best.name}</span>
              {' '}— {best.label} {fmtEur2(best.cpa)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
