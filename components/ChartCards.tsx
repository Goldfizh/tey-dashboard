'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LabelList,
  ComposedChart,
  Line,
  ResponsiveContainer,
} from 'recharts';

// ── Shared card wrapper ──────────────────────────────────────────────────────

function CardShell({ title, children, height = 260 }: {
  title: string;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">{title}</p>
      <div style={{ height }}>
        {children}
      </div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-pulse">
      <div className="h-3 w-32 bg-gray-100 rounded mb-3" />
      <div className="bg-gray-100 rounded" style={{ height }} />
    </div>
  );
}

// ── BarCard ──────────────────────────────────────────────────────────────────

export interface BarCardProps {
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
  valueKey: string;
  color: string;
  format: (v: number) => string;
  showLabels?: boolean;
  height?: number;
  xAngle?: number;
}

export function BarCard({
  title,
  data,
  xKey,
  valueKey,
  color,
  format,
  showLabels = false,
  height = 260,
  xAngle,
}: BarCardProps) {
  const hasAngle = typeof xAngle === 'number';

  return (
    <CardShell title={title} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: showLabels ? 18 : 4, right: 8, bottom: hasAngle ? 40 : 4, left: 8 }}>
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 10 }}
            {...(hasAngle
              ? { angle: xAngle, textAnchor: 'end', height: 60 }
              : {})}
          />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={format} width={60} />
          <Tooltip formatter={(v: unknown) => format(v as number)} />
          <Bar dataKey={valueKey} fill={color} radius={[3, 3, 0, 0]}>
            {showLabels && (
              <LabelList
                dataKey={valueKey}
                position="top"
                formatter={(v: unknown) => format(v as number)}
                style={{ fontSize: 9 }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </CardShell>
  );
}

// ── ComboCard ────────────────────────────────────────────────────────────────

export interface ComboCardProps {
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
  barKey: string;
  lineKey: string;
  barLabel: string;
  lineLabel: string;
  barColor?: string;
  lineColor?: string;
  barFormat: (v: number) => string;
  lineFormat: (v: number) => string;
  height?: number;
  xAngle?: number;
}

export function ComboCard({
  title,
  data,
  xKey,
  barKey,
  lineKey,
  barLabel,
  lineLabel,
  barColor = '#2563EB',
  lineColor = '#9ca3af',
  barFormat,
  lineFormat,
  height = 260,
  xAngle,
}: ComboCardProps) {
  const hasAngle = typeof xAngle === 'number';

  return (
    <CardShell title={title} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: hasAngle ? 40 : 4, left: 8 }}>
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 10 }}
            {...(hasAngle
              ? { angle: xAngle, textAnchor: 'end', height: 60 }
              : {})}
          />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={barFormat} width={60} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={lineFormat} width={60} />
          <Tooltip
            formatter={(value: unknown, name: unknown) => {
              const v = value as number;
              if (name === barLabel) return [barFormat(v), barLabel];
              if (name === lineLabel) return [lineFormat(v), lineLabel];
              return [String(value), String(name)];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="left" dataKey={barKey} name={barLabel} fill={barColor} radius={[3, 3, 0, 0]} />
          <Line yAxisId="right" dataKey={lineKey} name={lineLabel} stroke={lineColor} dot={false} strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </CardShell>
  );
}
