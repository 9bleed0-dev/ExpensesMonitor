import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatEur, formatEurShort } from '../lib/format'

const SURFACE = '#15151f'
const AXIS = { fill: '#8b8ba0', fontSize: 11 }

function TooltipBox({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#13131f]/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="text-slate-400 capitalize">{title}</div>
      <div className="tabular text-sm font-bold text-white">{formatEur(value)}</div>
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
  return (
    <div className="relative h-52 w-52 shrink-0">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data.length ? data : [{ key: 'empty', name: '', color: '#ffffff14', amount: 1 }]}
            dataKey="amount"
            nameKey="name"
            innerRadius="68%"
            outerRadius="100%"
            paddingAngle={data.length > 1 ? 2 : 0}
            cornerRadius={4}
            stroke={SURFACE}
            strokeWidth={2}
            animationDuration={900}
            animationEasing="ease-out"
            isAnimationActive
          >
            {(data.length ? data : [{ key: 'empty', color: '#ffffff14' }]).map((d) => (
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
          <div className="text-[11px] tracking-wide text-slate-400 uppercase">Totale</div>
          <div className="tabular text-lg font-bold">{formatEurShort(total)}</div>
        </div>
      </div>
    </div>
  )
}

export function CumulativeArea({ data }: { data: { day: number; total: number; label: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3987e5" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#3987e5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis hide domain={[0, 'auto']} />
        <Tooltip
          cursor={{ stroke: '#ffffff40', strokeWidth: 1 }}
          content={({ active, payload }) =>
            active && payload?.[0] ? <TooltipBox title={`Fino al ${payload[0].payload.label}`} value={Number(payload[0].value)} /> : null
          }
        />
        <Area type="monotone" dataKey="total" stroke="#3987e5" strokeWidth={2} fill="url(#areaFill)" animationDuration={1000} activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function MonthBars({ data, highlight, onSelect }: { data: { label: string; total: number; month: number }[]; highlight?: number; onSelect?: (month: number) => void }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap="18%">
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          cursor={{ fill: '#ffffff0d', radius: 8 }}
          content={({ active, payload }) => (active && payload?.[0] ? <TooltipBox title={String(payload[0].payload.label)} value={Number(payload[0].value)} /> : null)}
        />
        <Bar dataKey="total" radius={[4, 4, 0, 0]} animationDuration={900} onClick={(d) => onSelect?.((d as unknown as { month: number }).month)} className="cursor-pointer">
          {data.map((d) => (
            <Cell key={d.month} fill={d.month === highlight ? '#6da7ec' : '#256abf'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
