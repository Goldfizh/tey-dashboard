interface Props {
  platform: 'linkedin' | 'meta' | 'google';
  spend: number;
  applicants: number;
  clicks: number;
  impressions: number;
  thruplays?: number;
  isWinner: boolean;
  forceVideoMetrics?: boolean;
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

export default function ChannelCard({ platform, spend, applicants, clicks, impressions, thruplays = 0, isWinner, forceVideoMetrics = false }: Props) {
  const cfg = CONFIG[platform];
  const cpa = applicants > 0 ? spend / applicants : null;
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const cpv = thruplays > 0 ? spend / thruplays : null;

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
          Beste CPA
        </span>
      )}

      {/* Platform label */}
      <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: cfg.color }}>
        {cfg.label}
      </p>

      {/* CPA — hero metric */}
      <div className="mb-6">
        <p className="text-xs text-[#8C9BAF] uppercase tracking-widest mb-1">Kosten per sollicitant</p>
        <p className="gf-display text-4xl font-light text-[#12101F] tabular-nums">
          {cpa !== null ? fmtEur2(cpa) : '—'}
        </p>
      </div>

      {/* Supporting metrics */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-4 border-t border-[#DCE0E6]">
        <div>
          <p className="text-xs text-[#8C9BAF] mb-0.5">Budget gespendeerd</p>
          <p className="text-sm font-semibold text-[#12101F]">{fmtEur(spend)}</p>
        </div>
        <div>
          <p className="text-xs text-[#8C9BAF] mb-0.5">Sollicitanten</p>
          <p className="text-sm font-semibold text-[#12101F]">{fmtNum(applicants)}</p>
        </div>
        <div>
          <p className="text-xs text-[#8C9BAF] mb-0.5">CTR</p>
          <p className="text-sm font-semibold text-[#12101F]">{fmtPct(ctr)}</p>
        </div>
        <div>
          <p className="text-xs text-[#8C9BAF] mb-0.5">Kosten per klik</p>
          <p className="text-sm font-semibold text-[#12101F]">{cpc > 0 ? fmtEur2(cpc) : '—'}</p>
        </div>
        {(thruplays > 0 || forceVideoMetrics) && (
          <>
            <div>
              <p className="text-xs text-[#8C9BAF] mb-0.5">Voltooide video views</p>
              <p className="text-sm font-semibold text-[#12101F]">{fmtNum(thruplays)}</p>
            </div>
            <div>
              <p className="text-xs text-[#8C9BAF] mb-0.5">Kosten per video view</p>
              <p className="text-sm font-semibold text-[#12101F]">{cpv !== null ? fmtEur2(cpv) : '—'}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
