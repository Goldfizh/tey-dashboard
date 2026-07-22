interface KpiCardProps {
  title:          string;
  value:          string;
  subtitle?:      string;
  accent?:        boolean;    // highlight border with green
  delta?:         number | null; // fraction: 0.05 = +5%, -0.1 = -10%
  deltaInverted?: boolean;   // true = lower is better (e.g. CPA)
}

export function KpiCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-[#DCE0E6] p-5 animate-pulse" style={{ boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}>
      <div className="h-2.5 bg-gray-200 rounded w-2/3 mb-3" />
      <div className="h-9 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-2.5 bg-gray-100 rounded w-3/4" />
    </div>
  );
}

function DeltaBadge({ delta, inverted }: { delta: number; inverted: boolean }) {
  const positive = inverted ? delta < 0 : delta > 0;
  const pct = `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`;
  const arrow = delta > 0 ? '↑' : '↓';
  const color = positive ? '#16A34A' : '#DC2626';
  const bg    = positive ? '#F0FDF4' : '#FEF2F2';
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded"
      style={{ color, background: bg }}
    >
      {arrow} {pct}
    </span>
  );
}

export default function KpiCard({ title, value, subtitle, accent, delta, deltaInverted = false }: KpiCardProps) {
  return (
    <div
      className="bg-white rounded-lg p-5"
      style={{
        border: `1px solid ${accent ? '#16A34A' : '#DCE0E6'}`,
        boxShadow: '0 8px 24px rgba(18,16,34,0.08)',
      }}
    >
      <p className="gf-eyebrow mb-2">{title}</p>
      <p className="gf-display text-[2rem] font-light text-[#0B1020] tabular-nums">{value}</p>
      <div className="flex items-center gap-2 mt-1.5">
        {subtitle && <p className="text-xs text-[#8C9BAF]">{subtitle}</p>}
        {delta != null && <DeltaBadge delta={delta} inverted={deltaInverted} />}
      </div>
    </div>
  );
}
