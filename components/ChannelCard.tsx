import type { Objective } from '@/types/objective';

interface Props {
  platform:    'linkedin' | 'meta' | 'google';
  spend:       number;
  applicants:  number;
  clicks:      number;
  impressions: number;
  thruplays?:  number;
  isWinner:    boolean;
  objective?:  Objective;
}

const fmtEur = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtEur2 = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const fmtNum = (n: number) => n.toLocaleString('nl-NL');
const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;

const CONFIG = {
  linkedin: { label: 'LinkedIn',       color: '#0077B5' },
  meta:     { label: 'Meta / Facebook', color: '#1877F2' },
  google:   { label: 'Google Ads',      color: '#F59E0B' },
};

export function ChannelCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-[#DCE0E6] p-6 animate-pulse" style={{ boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}>
      <div className="h-2.5 bg-gray-200 rounded w-1/3 mb-5" />
      <div className="h-10 bg-gray-200 rounded w-1/2 mb-6" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="h-2 bg-gray-100 rounded w-1/2 mb-1.5" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[#8C9BAF] mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-[#12101F]">{value}</p>
    </div>
  );
}

export default function ChannelCard({
  platform, spend, applicants, clicks, impressions,
  thruplays = 0, isWinner, objective,
}: Props) {
  const cfg = CONFIG[platform];

  // Computed metrics
  const cpa = applicants  > 0 ? spend / applicants  : null;
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const cpc = clicks      > 0 ? spend / clicks       : 0;
  const cpm = impressions > 0 ? spend / impressions * 1000 : null;
  const cpv = thruplays   > 0 ? spend / thruplays   : null;
  const vtr = impressions > 0 ? thruplays / impressions    : 0;

  // View-mode flags
  const isVideo      = objective === 'video';
  const isImpressies = objective === 'impressies' || objective === 'verkeer';
  const isLeads      = objective === 'leads';

  // Hero metric
  const heroLabel = isVideo      ? 'Kosten per video view (CPCV)'
                  : isImpressies ? 'Kosten per 1000 impressies (CPM)'
                  : isLeads      ? 'Kosten per lead (CPL)'
                  :                'Kosten per sollicitant';
  const heroValue = isVideo      ? (cpv !== null ? fmtEur2(cpv) : '—')
                  : isImpressies ? (cpm !== null ? fmtEur2(cpm) : '—')
                  : (cpa !== null ? fmtEur2(cpa) : '—');

  // Winner badge label
  const winLabel = isVideo      ? 'Laagste CPCV'
                 : isImpressies ? 'Laagste CPM'
                 : isLeads      ? 'Beste CPL'
                 :                'Beste CPA';

  return (
    <div
      className="bg-white rounded-lg p-6 relative"
      style={{
        border: `1px solid ${isWinner ? '#16A34A' : '#DCE0E6'}`,
        boxShadow: isWinner
          ? '0 8px 24px rgba(18,16,34,0.08), 0 0 0 1px #16A34A'
          : '0 8px 24px rgba(18,16,34,0.08)',
      }}
    >
      {isWinner && (
        <span
          className="absolute top-4 right-4 text-xs font-bold px-2 py-0.5 rounded"
          style={{ background: '#DCFCE7', color: '#16A34A' }}
        >
          {winLabel}
        </span>
      )}

      {/* Platform label */}
      <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: cfg.color }}>
        {cfg.label}
      </p>

      {/* Hero metric */}
      <div className="mb-6">
        <p className="text-xs text-[#8C9BAF] uppercase tracking-widest mb-1">{heroLabel}</p>
        <p className="gf-display text-4xl font-light text-[#12101F] tabular-nums">{heroValue}</p>
      </div>

      {/* Supporting metrics grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-4 border-t border-[#DCE0E6]">
        {isVideo ? (
          <>
            <Stat label="Budget gespendeerd"  value={fmtEur(spend)} />
            <Stat label="Completed views"     value={thruplays > 0 ? fmtNum(thruplays) : '—'} />
            <Stat label="Impressies"          value={fmtNum(impressions)} />
            <Stat label="VTR"                 value={vtr > 0 ? fmtPct(vtr) : '—'} />
          </>
        ) : isImpressies ? (
          <>
            <Stat label="Budget gespendeerd"  value={fmtEur(spend)} />
            <Stat label="Impressies"          value={fmtNum(impressions)} />
            <Stat label="Clicks"              value={fmtNum(clicks)} />
            <Stat label="CTR"                 value={fmtPct(ctr)} />
          </>
        ) : (
          <>
            <Stat label="Budget gespendeerd"  value={fmtEur(spend)} />
            <Stat label={isLeads ? 'Leads' : 'Sollicitanten'} value={fmtNum(applicants)} />
            <Stat label="CTR"                 value={fmtPct(ctr)} />
            <Stat label="Kosten per klik"     value={cpc > 0 ? fmtEur2(cpc) : '—'} />
          </>
        )}
      </div>
    </div>
  );
}
