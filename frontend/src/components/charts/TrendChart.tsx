import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface Point {
  label: string
  value: number
  /** Optional second series on the same scale (e.g. a 7-day average). */
  value2?: number | null
}

const axis = { fontSize: 11, fill: 'var(--muted-foreground)' }
/** Compact tick labels so large values (e.g. 16 000 kg) fit the axis. */
const compact = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })}k` : v.toLocaleString('es-ES')

function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean
  payload?: { value: number; name?: string }[]
  label?: string
  format: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="tabular font-semibold text-foreground">
          {payload.length > 1 && <span className="mr-1 font-normal text-muted-foreground">{p.name}:</span>}
          {format(p.value)}
        </p>
      ))}
    </div>
  )
}

interface Props {
  data: Point[]
  format: (v: number) => string
  height?: number
  /** Accessible summary of what the chart shows. */
  ariaLabel: string
}

export function BarTrend({ data, format, height = 160, ariaLabel, reference }: Props & { reference?: { value: number; label: string } }) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} width={36} tickFormatter={compact} />
          <Tooltip cursor={{ fill: 'var(--muted)' }} content={<ChartTooltip format={format} />} />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          {reference && (
            <ReferenceLine
              y={reference.value}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{ value: reference.label, position: 'insideTopRight', fontSize: 11, fill: 'var(--muted-foreground)' }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function LineTrend({
  data,
  format,
  height = 160,
  ariaLabel,
  reference,
  domainPadding = 1,
  seriesNames,
}: Props & { reference?: { value: number; label: string }; domainPadding?: number; seriesNames?: [string, string] }) {
  return (
    <div>
      {seriesNames && (
        <div className="mb-2 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[var(--chart-1)]" />{seriesNames[0]}</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded border-t-2 border-dashed border-[var(--chart-2)]" />{seriesNames[1]}</span>
        </div>
      )}
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis
            tick={axis}
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={compact}
            domain={[(min: number) => Math.floor(min - domainPadding), (max: number) => Math.ceil(max + domainPadding)]}
          />
          <Tooltip cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }} content={<ChartTooltip format={format} />} />
          {reference && (
            <ReferenceLine
              y={reference.value}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{ value: reference.label, position: 'insideTopRight', fontSize: 11, fill: 'var(--muted-foreground)' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={data.length <= 14 ? { r: 3, fill: 'var(--chart-1)', strokeWidth: 0 } : false}
            activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }}
            name={seriesNames?.[0]}
          />
          {seriesNames && (
            <Line type="monotone" dataKey="value2" name={seriesNames[1]} stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
    </div>
  )
}
