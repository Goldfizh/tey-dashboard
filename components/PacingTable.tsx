'use client';

import type { CampaignRow, Platform } from '@/types/campaign';

interface Props {
  /** Full unfiltered dataset – used to derive start/end dates and total spend per campaign */
  allRows: CampaignRow[];
  /** Date-filtered + campaign-filtered rows – used for "spend in this period" */
  filteredRows: CampaignRow[];
  /** Selected end of the date range – treated as "today" for runtime pacing */
  dateTo: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const PLATFORM_COLOR: Record<Platform, string> = {
  linkedin: '#0077B5',
  meta:     '#1877F2',
  google:   '#F59E0B',
};
const PLATFORM_LABEL: Record<Platform, string> = {
  linkedin: 'LinkedIn',
  meta:     'Meta',
  google:   'Google',
};

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'short', year: '2-digit',
  });

const fmtEur = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

// ── sub-components ────────────────────────────────────────────────────────────

function PacingBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.min(Math.max(pct, 0), 1);
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: '6px', background: '#F0F4F8', minWidth: '60px' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${(clamped * 100).toFixed(1)}%`, background: color }}
        />
      </div>
      <span className="text-xs tabular-nums font-semibold w-9 text-right shrink-0" style={{ color }}>
        {Math.round(clamped * 100)}%
      </span>
    </div>
  );
}

// ── skeleton ──────────────────────────────────────────────────────────────────

export function PacingTableSkeleton() {
  return (
    <div
      className="bg-white overflow-hidden animate-pulse"
      style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}
    >
      <div className="px-5 py-4" style={{ borderBottom: '1px solid #DCE0E6' }}>
        <div className="h-2.5 bg-gray-200 rounded w-1/3" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="px-5 py-4 flex gap-6 items-center" style={{ borderBottom: '1px solid #F0F4F8' }}>
          <div className="h-4 bg-gray-200 rounded flex-1" />
          <div className="h-4 bg-gray-100 rounded w-16" />
          <div className="h-4 bg-gray-100 rounded w-20" />
          <div className="h-4 bg-gray-100 rounded w-20" />
          <div className="h-4 bg-gray-100 rounded w-32" />
          <div className="h-4 bg-gray-100 rounded w-32" />
        </div>
      ))}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function PacingTable({ allRows, filteredRows, dateTo }: Props) {
  // Social only — Google Ads has daily budgets without a fixed campaign lifetime, so pacing doesn't apply.
  const socialFiltered = filteredRows.filter((r) => r.platform !== 'google');
  const socialAll      = allRows.filter((r) => r.platform !== 'google');

  // 1) Period spend per campaign (from date-filtered + campaign-filtered rows)
  const periodSpendMap = new Map<string, number>();
  const periodImprMap  = new Map<string, number>();
  for (const r of socialFiltered) {
    const key = `${r.platform}::${r.campaign_name}`;
    periodSpendMap.set(key, (periodSpendMap.get(key) ?? 0) + r.spend);
    periodImprMap.set(key,  (periodImprMap.get(key)  ?? 0) + r.impressions);
  }

  // 2) All-time data per campaign (min/max date, total spend)
  const allMap = new Map<string, {
    platform:   Platform;
    minDate:    string;
    maxDate:    string;
    totalSpend: number;
  }>();
  for (const r of socialAll) {
    const key = `${r.platform}::${r.campaign_name}`;
    const cur = allMap.get(key);
    if (!cur) {
      allMap.set(key, { platform: r.platform, minDate: r.date, maxDate: r.date, totalSpend: r.spend });
    } else {
      if (r.date < cur.minDate) cur.minDate = r.date;
      if (r.date > cur.maxDate) cur.maxDate = r.date;
      cur.totalSpend += r.spend;
    }
  }

  // 3) Build pacing rows – only for campaigns visible in the current period
  const todayMs = new Date(dateTo + 'T00:00:00').getTime();

  const rows = Array.from(periodSpendMap.entries())
    .map(([key, periodSpend]) => {
      const sepIdx      = key.indexOf('::');
      const campaign_name = key.slice(sepIdx + 2);
      const all         = allMap.get(key);
      if (!all) return null;

      const startMs   = new Date(all.minDate + 'T00:00:00').getTime();
      const endMs     = new Date(all.maxDate + 'T00:00:00').getTime();
      const totalDays = (endMs - startMs) / 86_400_000;
      // Clamp elapsed to the campaign's known data range — "today" may be beyond last data point.
      const elapsed   = Math.max(0, Math.min(todayMs - startMs, endMs - startMs) / 86_400_000);

      // Runtime pacing: how far through the campaign's lifetime are we (based on selected end date)
      const runtimePct = totalDays > 0 ? Math.min(elapsed / totalDays, 1) : 1;

      // Spend missing: campaign had impressions but €0 spend (data not exported from source)
      const periodImpr    = periodImprMap.get(key) ?? 0;
      const spendMissing  = all.totalSpend === 0 && periodImpr > 0;

      // Budget pacing: spend in current period vs. all-time spend for this campaign
      const budgetPct = all.totalSpend > 0 ? Math.min(periodSpend / all.totalSpend, 1) : 0;

      return {
        key,
        campaign_name,
        platform:    all.platform,
        startDate:   all.minDate,
        endDate:     all.maxDate,
        periodSpend,
        totalSpend:  all.totalSpend,
        runtimePct,
        budgetPct,
        spendMissing,
        totalDays:   Math.round(totalDays),
        elapsedDays: Math.round(elapsed),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.periodSpend - a.periodSpend);

  if (rows.length === 0) {
    return (
      <div
        className="bg-white p-8 text-center text-sm"
        style={{ border: '1px solid #DCE0E6', borderRadius: '8px', color: '#8C9BAF' }}
      >
        Geen pacing data beschikbaar voor de geselecteerde periode
      </div>
    );
  }

  return (
    <div
      className="bg-white overflow-hidden"
      style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}
    >
      <div className="px-5 py-4 flex items-baseline gap-3 flex-wrap" style={{ borderBottom: '1px solid #DCE0E6' }}>
        <span className="gf-eyebrow">Campagne pacing</span>
        <span className="text-xs" style={{ color: '#BCC4CF' }}>LinkedIn &amp; Meta — Google Ads heeft geen vaste looptijd</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: '#F0F4F8' }}>
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#8C9BAF' }}>
                Campagne
              </th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF' }}>
                Platform
              </th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF' }}>
                Begindatum
              </th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF' }}>
                Einddatum
              </th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF', minWidth: '180px' }}>
                Looptijd pacing
              </th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#8C9BAF', minWidth: '180px' }}>
                Budget pacing
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const platformColor = PLATFORM_COLOR[c.platform];

              // Budget pacing colour: green ≈ on-track, amber = underspending, red = overspending
              const ratio = c.runtimePct > 0 ? c.budgetPct / c.runtimePct : 0;
              const budgetColor = c.spendMissing ? '#F59E0B'
                : ratio >= 0.85 && ratio <= 1.15 ? '#16A34A'
                : ratio < 0.85               ? '#F59E0B'
                :                              '#DC2626';

              return (
                <tr
                  key={c.key}
                  className="transition-colors hover:bg-[#F0F4F8]/60"
                  style={{ borderBottom: '1px solid #F0F4F8' }}
                >
                  {/* Campaign name */}
                  <td
                    className="px-5 py-3.5 font-medium max-w-xs truncate"
                    title={c.campaign_name}
                    style={{ color: '#0B1020' }}
                  >
                    {c.campaign_name}
                  </td>

                  {/* Platform badge */}
                  <td className="px-5 py-3.5">
                    <span
                      className="inline-block px-2 py-0.5 text-xs font-bold whitespace-nowrap"
                      style={{
                        background:   platformColor,
                        borderRadius: '4px',
                        color:        c.platform === 'google' ? '#0B1020' : '#ffffff',
                      }}
                    >
                      {PLATFORM_LABEL[c.platform]}
                    </span>
                  </td>

                  {/* Start date */}
                  <td className="px-5 py-3.5 text-xs whitespace-nowrap" style={{ color: '#555E6C' }}>
                    {fmtDate(c.startDate)}
                  </td>

                  {/* End date */}
                  <td className="px-5 py-3.5 text-xs whitespace-nowrap" style={{ color: '#555E6C' }}>
                    {fmtDate(c.endDate)}
                  </td>

                  {/* Runtime pacing */}
                  <td className="px-5 py-3.5" style={{ minWidth: '180px' }}>
                    <PacingBar pct={c.runtimePct} color="#1E3A8A" />
                    <p className="text-xs mt-1" style={{ color: '#BCC4CF' }}>
                      dag {c.elapsedDays} van {c.totalDays}
                    </p>
                  </td>

                  {/* Budget pacing */}
                  <td className="px-5 py-3.5" style={{ minWidth: '180px' }}>
                    {c.spendMissing ? (
                      <p className="text-xs font-semibold" style={{ color: '#F59E0B' }}>spend ontbreekt in bron</p>
                    ) : (
                      <>
                        <PacingBar pct={c.budgetPct} color={budgetColor} />
                        <p className="text-xs mt-1" style={{ color: '#BCC4CF' }}>
                          {fmtEur(c.periodSpend)} / {fmtEur(c.totalSpend)} totaal
                        </p>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div
        className="px-5 py-3 flex items-center gap-5 flex-wrap"
        style={{ borderTop: '1px solid #F0F4F8', background: '#F8FAFC' }}
      >
        <span className="text-xs font-semibold" style={{ color: '#8C9BAF' }}>Budget pacing:</span>
        {[
          { color: '#16A34A', label: 'Op schema (85–115%)' },
          { color: '#F59E0B', label: 'Onderpacing (<85%)' },
          { color: '#DC2626', label: 'Overpacing (>115%)' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs" style={{ color: '#555E6C' }}>
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
        <span className="text-xs ml-auto" style={{ color: '#BCC4CF' }}>
          Budget pacing = aandeel spend in gekozen periode t.o.v. totale campagne-spend
        </span>
      </div>
    </div>
  );
}
