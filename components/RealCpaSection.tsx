'use client';

import type { Channel } from '@/lib/channel';
import { CHANNEL_COLOR, CHANNEL_LABEL } from '@/lib/channel';

interface Props {
  /** Paid ad spend per channel for the selected period (all campaigns, not campaign-filtered). */
  spend:       Record<'linkedin' | 'meta' | 'google', number>;
  /** Completed applications (Recruitee, via GA4) per channel for the selected period. */
  completions: Record<Channel, number>;
  /** Channels whose spend is missing in the source (not "spent nothing"). */
  missing?:    Record<'linkedin' | 'meta' | 'google', boolean>;
  loading:     boolean;
  available:   boolean;
}

const fmtEur2 = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtEur0 = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtNum = (n: number) => n.toLocaleString('nl-NL');

const PAID: ('linkedin' | 'meta' | 'google')[] = ['linkedin', 'meta', 'google'];

export function RealCpaSectionSkeleton() {
  return (
    <div className="bg-white p-5 animate-pulse" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}>
      <div className="h-3 bg-gray-200 rounded w-1/3 mb-5" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded" />)}
      </div>
    </div>
  );
}

export default function RealCpaSection({ spend, completions, missing, loading, available }: Props) {
  const isMissing = (ch: 'linkedin' | 'meta' | 'google') => missing?.[ch] ?? false;
  if (loading) return <RealCpaSectionSkeleton />;

  if (!available) {
    return (
      <div className="bg-white p-6 text-sm" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', color: '#8C9BAF' }}>
        Echte sollicitatiedata (GA4/Recruitee) is niet beschikbaar voor deze periode.
      </div>
    );
  }

  const paidSpend = spend.linkedin + spend.meta + spend.google;

  // A cost-per-application is only meaningful when there is BOTH spend and completions in the
  // window. Channels with completions but €0 spend are an attribution-window mismatch (GA4 credits
  // a conversion now to a click whose spend fell outside the period) — showing €0 would read as
  // "free", so we suppress it and exclude those completions from the total denominator.
  const cpaFor = (ch: 'linkedin' | 'meta' | 'google') =>
    spend[ch] > 0 && completions[ch] > 0 ? spend[ch] / completions[ch] : null;

  // Total: only count completions from channels that actually had spend in the window.
  const attributableCompletions = PAID.reduce((a, ch) => a + (spend[ch] > 0 ? completions[ch] : 0), 0);
  const totalCpa = attributableCompletions > 0 ? paidSpend / attributableCompletions : null;

  // Channels that have applications but no spend in the window — surfaced as a caveat.
  // Exclude channels whose spend is missing entirely (different problem, shown elsewhere).
  const orphanChannels = PAID.filter((ch) => completions[ch] > 0 && spend[ch] === 0 && !isMissing(ch));

  // Cheapest qualifying channel (real spend AND completions) for highlighting.
  const cheapest = PAID
    .map((ch) => ({ ch, cpa: cpaFor(ch) }))
    .filter((c) => c.cpa !== null)
    .sort((a, b) => (a.cpa! - b.cpa!))[0]?.ch;

  return (
    <div className="bg-white overflow-hidden" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}>
      <div className="px-5 py-4 flex items-baseline justify-between gap-3 flex-wrap" style={{ borderBottom: '1px solid #DCE0E6' }}>
        <span className="gf-eyebrow">Echte kosten per sollicitatie</span>
        <span className="text-xs" style={{ color: '#BCC4CF' }}>
          Voltooide sollicitaties (Recruitee, via GA4) — niet de pixel-conversies van de platforms
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4">
        {/* Total */}
        <div className="p-5" style={{ borderRight: '1px solid #F0F4F8', borderBottom: '1px solid #F0F4F8', background: '#FAFBFF' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#1E3A8A' }}>Alle kanalen</p>
          <p className="gf-display text-[1.9rem] font-light tabular-nums" style={{ color: '#0B1020' }}>
            {totalCpa !== null ? fmtEur2(totalCpa) : '—'}
          </p>
          <p className="text-xs mt-1.5" style={{ color: '#8C9BAF' }}>
            {fmtEur0(paidSpend)} ÷ {fmtNum(attributableCompletions)} sollicitaties
          </p>
        </div>

        {/* Per channel */}
        {PAID.map((ch, idx) => {
          const cpa     = cpaFor(ch);
          const missingSpend = isMissing(ch);
          const noSpend = !missingSpend && completions[ch] > 0 && spend[ch] === 0;
          const isCheap = ch === cheapest && cpa !== null;
          return (
            <div
              key={ch}
              className="p-5"
              style={{
                borderRight: idx < 2 ? '1px solid #F0F4F8' : undefined,
                borderBottom: '1px solid #F0F4F8',
                background: isCheap ? 'rgba(22,163,74,0.04)' : undefined,
              }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: CHANNEL_COLOR[ch] }} />
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: CHANNEL_COLOR[ch] }}>
                  {CHANNEL_LABEL[ch]}
                </p>
                {isCheap && (
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#DCFCE7', color: '#16A34A' }}>
                    goedkoopst
                  </span>
                )}
              </div>
              <p className="gf-display text-[1.9rem] font-light tabular-nums" style={{ color: isCheap ? '#16A34A' : '#0B1020' }}>
                {missingSpend ? 'ontbreekt' : cpa !== null ? fmtEur2(cpa) : '—'}
              </p>
              <p className="text-xs mt-1.5" style={{ color: missingSpend || noSpend ? '#F59E0B' : '#8C9BAF' }}>
                {missingSpend
                  ? `spend ontbreekt in bron · ${fmtNum(completions[ch])} soll.`
                  : noSpend
                  ? `${fmtNum(completions[ch])} soll. zonder spend in periode`
                  : `${fmtEur0(spend[ch])} ÷ ${fmtNum(completions[ch])} soll.`}
              </p>
            </div>
          );
        })}
      </div>

      {/* Attribution-window caveat */}
      {orphanChannels.length > 0 && (
        <div className="px-5 py-3 flex items-start gap-2 text-xs" style={{ background: '#FFFBEB', color: '#8C5A00' }}>
          <span className="mt-0.5">⚠</span>
          <span>
            {orphanChannels.map((c) => CHANNEL_LABEL[c]).join(', ')} kreeg sollicitaties toegerekend maar had €0 spend in deze periode.
            Dat is meestal een attributievenster-mismatch (sollicitatie nu, klik/spend eerder) — daarom geen kosten per sollicitatie. Verbreed de periode voor een eerlijk beeld.
          </span>
        </div>
      )}

      {/* Organic / other context */}
      {completions.other > 0 && (
        <div className="px-5 py-3 flex items-center gap-2 text-xs" style={{ background: '#F8FAFC', color: '#8C9BAF' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: CHANNEL_COLOR.other }} />
          <span>
            <span className="font-semibold" style={{ color: '#555E6C' }}>{fmtNum(completions.other)}</span> sollicitaties kwamen via overige/organische bronnen (geen advertentiekosten toegerekend)
          </span>
        </div>
      )}

      <div className="px-5 py-3 text-xs" style={{ borderTop: '1px solid #F0F4F8', color: '#BCC4CF' }}>
        Toerekening op kanaalniveau (GA4 sessiebron). Onafhankelijk van je campagneselectie hierboven — het gaat om al het verkeer per kanaal in deze periode.
      </div>
    </div>
  );
}
