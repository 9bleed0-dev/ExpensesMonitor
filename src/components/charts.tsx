import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatEur, formatEurShort } from '../lib/format'
import { useTheme, type Theme } from '../lib/theme'

/** Colori dei grafici per tema: superficie, assi e serie (passi della stessa rampa blu validati per ciascuna superficie) */
const CHART: Record<Theme, { surface: string; axis: string; cursor: string; empty: string; series: string; seriesHi: string; ghost: string; ref: string }> = {
  dark: { surface: '#15151f', axis: '#8b8ba0', cursor: '#ffffff40', empty: '#ffffff14', series: '#3987e5', seriesHi: '#6da7ec', ghost: '#4a4a55', ref: '#ffffff55' },
  light: { surface: '#ffffff', axis: '#5f6478', cursor: '#1e1b4b33', empty: '#1e1b4b14', series: '#2a78d6', seriesHi: '#184f95', ghost: '#c9c9d1', ref: '#1e1b4b66' },
}

export const useChartColors = () => CHART[useTheme().theme]

function TooltipBox({ title, value, extra }: { title: string; value: number; extra?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-fg/10 bg-surface/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="text-muted capitalize">{title}</div>
      <div className="tabular text-sm font-bold text-ink">{formatEur(value)}</div>
      {extra}
    </div>
  )
}

export interface Slice {
  key: string
  name: string
  color: string
  amount: number
}

export function Donut({ data, total }: { data: Slice[]; total: number }) {
  const c = useChartColors()
  const empty = [{ key: 'empty', name: '', color: c.empty, amount: 1 }]
  return (
    <div className="relative h-52 w-52 shrink-0" data-noswipe>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data.length ? data : empty}
            dataKey="amount"
            nameKey="name"
            innerRadius="68%"
            outerRadius="100%"
            paddingAngle={data.length > 1 ? 2 : 0}
            cornerRadius={4}
            stroke={c.surface}
            strokeWidth={2}
            animationDuration={900}
            animationEasing="ease-out"
            isAnimationActive
          >
            {(data.length ? data : empty).map((d) => (
              <Cell key={d.key} fill={d.color} />
            ))}
          </Pie>
          {data.length > 0 && (
            <Tooltip
              cursor={false}
              content={({ active, payload }) =>
                active && payload?.[0] ? <TooltipBox title={String(payload[0].name)} value={Number(payload[0].value)} /> : null
              }
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[11px] tracking-wide text-muted uppercase">Totale</div>
          <div className="tabular text-lg font-bold">{formatEurShort(total)}</div>
        </div>
      </div>
    </div>
  )
}

/** Andamento cumulativo; `projection` (opzionale) prolunga la linea tratteggiata fino a fine mese */
export function CumulativeArea({ data, budget }: { data: { day: number; total?: number; projected?: number; label: string }[]; budget?: number }) {
  const c = useChartColors()
  return (
    <div data-noswipe>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.series} stopOpacity={0.4} />
              <stop offset="100%" stopColor={c.series} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" tick={{ fill: c.axis, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis hide domain={[0, (max: number) => Math.max(max, budget ?? 0) * 1.05]} />
          {!!budget && <ReferenceLine y={budget} stroke={c.ref} strokeDasharray="2 4" label={{ value: 'Budget', position: 'insideTopLeft', fill: c.axis, fontSize: 10 }} />}
          <Tooltip
            cursor={{ stroke: c.cursor, strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as (typeof data)[number] | undefined
              if (!active || !p) return null
              return p.total != null ? (
                <TooltipBox title={`Fino al ${p.label}`} value={p.total} />
              ) : (
                <TooltipBox title={`Stima al ${p.label}`} value={p.projected ?? 0} />
              )
            }}
          />
          <Area type="monotone" dataKey="projected" stroke={c.series} strokeOpacity={0.7} strokeWidth={2} strokeDasharray="4 4" fill="none" animationDuration={1000} activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }} connectNulls />
          <Area type="monotone" dataKey="total" stroke={c.series} strokeWidth={2} fill="url(#areaFill)" animationDuration={1000} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Barre per mese, con l'anno precedente come barra "fantasma" grigia accanto per il confronto */
export function MonthBars({ data, highlight, onSelect, prevLabel, curLabel }: { data: { label: string; total: number; prev: number; month: number }[]; highlight?: number; onSelect?: (month: number) => void; prevLabel: string; curLabel: string }) {
  const c = useChartColors()
  const showPrev = data.some((d) => d.prev > 0)
  return (
    <div data-noswipe>
      {showPrev && (
        <div className="mb-3 flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.series }} /> {curLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.ghost }} /> {prevLabel}
          </span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap="18%" barGap={2}>
          <XAxis dataKey="label" tick={{ fill: c.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: c.empty, radius: 8 }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as (typeof data)[number] | undefined
              if (!active || !p) return null
              const diff = p.prev > 0 ? Math.round(((p.total - p.prev) / p.prev) * 100) : null
              return (
                <TooltipBox
                  title={p.label}
                  value={p.total}
                  extra={
                    showPrev && (
                      <div className="tabular mt-0.5 text-muted">
                        {prevLabel}: {formatEur(p.prev)}
                        {diff !== null && ` (${diff > 0 ? '+' : ''}${diff}%)`}
                      </div>
                    )
                  }
                />
              )
            }}
          />
          {showPrev && <Bar dataKey="prev" fill={c.ghost} radius={[4, 4, 0, 0]} animationDuration={700} />}
          <Bar dataKey="total" radius={[4, 4, 0, 0]} animationDuration={900} onClick={(d) => onSelect?.((d as unknown as { month: number }).month)} className="cursor-pointer">
            {data.map((d) => (
              <Cell key={d.month} fill={d.month === highlight ? c.seriesHi : c.series} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
