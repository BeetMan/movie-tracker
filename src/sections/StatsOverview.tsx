import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, BarChart, LabelList,
} from 'recharts'
import { Clapperboard, Film, MapPin, Wallet, Ticket } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { MovieRecord } from '@/types/movie'
import { brandColor, formatPrice } from '@/types/movie'
import { overallStats, spendByCurrency, byYear, byFormat, topCinemas, byMonth, topRewatched, dayCounts } from '@/lib/stats'
import { chartPalette, useTheme } from '@/hooks/useTheme'

export default function StatsOverview({ records }: { records: MovieRecord[] }) {
  const [year, setYear] = useState('all')
  const isAll = year === 'all'
  const { isDark } = useTheme()
  const pal = chartPalette(isDark)

  const TT = {
    contentStyle: {
      backgroundColor: pal.tooltipBg,
      border: `1px solid ${pal.tooltipBorder}`,
      borderRadius: 8,
      fontSize: 12,
      color: pal.tooltipText,
    },
    itemStyle: { color: pal.tooltipText },
    labelStyle: { color: pal.tooltipText, marginBottom: 2 },
  } as const

  const years = useMemo(() => [...new Set(records.map(r => r.year))].sort((a, b) => b - a), [records])
  const filtered = useMemo(
    () => (isAll ? records : records.filter(r => r.year === Number(year))),
    [records, year, isAll]
  )

  const s = useMemo(() => overallStats(filtered), [filtered])
  const spending = useMemo(() => spendByCurrency(filtered), [filtered])
  const yearly = useMemo(() => byYear(records), [records])
  const monthly = useMemo(() => byMonth(filtered), [filtered])
  const formats = useMemo(() => byFormat(filtered), [filtered])
  const cinemas = useMemo(() => topCinemas(filtered), [filtered])
  const rewatched = useMemo(() => topRewatched(filtered), [filtered])
  const heat = useMemo(() => (isAll ? null : dayCounts(records, Number(year))), [records, year, isAll])
  const hasForeign = spending.some(c => c.currency !== 'CNY')

  const trendData = isAll ? yearly : monthly
  const trendKey = isAll ? 'year' : 'month'

  const multiLine = (lines: string[]) => (
    <span className="leading-tight">
      {lines.map((l, i) => (
        <span key={i} className={i > 0 ? 'block text-sm font-medium' : 'block'}>{l}</span>
      ))}
    </span>
  )

  const cards = [
    { icon: Ticket, label: '观影场次', value: String(s.total) },
    { icon: Film, label: '不同影片', value: String(s.films) },
    { icon: MapPin, label: '打卡影院', value: String(s.cinemas) },
    {
      icon: Wallet,
      label: '累计花费',
      value: spending.length
        ? multiLine(spending.map(c => formatPrice(c.spend, c.currency)))
        : '—',
    },
    {
      icon: Clapperboard,
      label: '平均票价',
      value: spending.length
        ? multiLine(spending.map(c => formatPrice(Math.round(c.avg * 10) / 10, c.currency)))
        : '—',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {isAll ? '全部年份的观影统计' : `${year} 年的观影统计`}
        </h2>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32 border-input bg-card text-foreground">
            <SelectValue placeholder="年份" />
          </SelectTrigger>
          <SelectContent className="border-input bg-popover text-popover-foreground">
            <SelectItem value="all">全部年份</SelectItem>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y} 年</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map(c => (
          <Card key={c.label} className="border-border bg-card">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-amber-400/10 p-2">
                <c.icon className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className="text-xl font-semibold text-foreground">{c.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="border-border bg-card lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              {isAll ? '每年场次与花费' : `${year} 年各月场次与花费`}
              {hasForeign && <span className="ml-2 text-xs font-normal text-muted-foreground">（花费曲线仅计人民币票价）</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} vertical={false} />
                <XAxis dataKey={trendKey} tick={{ fill: pal.tick, fontSize: 12 }} axisLine={{ stroke: pal.axis }} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fill: pal.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="r" orientation="right" tick={{ fill: pal.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip {...TT} cursor={{ fill: pal.cursor }} />
                <Bar yAxisId="l" dataKey="场次" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Line yAxisId="r" type="monotone" dataKey="花费" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">制式分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={formats} dataKey="value" nameKey="name" innerRadius={50} outerRadius={82} paddingAngle={2} strokeWidth={0}>
                    {formats.map(f => (
                      <Cell key={f.name} fill={brandColor(f.name)} />
                    ))}
                  </Pie>
                  <Tooltip {...TT} formatter={(v: number, name: string) => [`${v} 场`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 pb-2 pt-1">
              {formats.map(f => (
                <span key={f.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: brandColor(f.name) }} />
                  {f.name} {f.value}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">常去影院 TOP 10</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cinemas} layout="vertical" margin={{ top: 0, right: 32, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} horizontal={false} />
                <XAxis type="number" tick={{ fill: pal.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={170} tick={{ fill: pal.tickStrong, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TT} cursor={{ fill: pal.cursor }} formatter={(v: number, _n, item) => [`${v} 场`, (item as { payload?: { full?: string } })?.payload?.full ?? '']} />
                <Bar dataKey="value" fill="#38bdf8" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  <LabelList dataKey="value" position="right" fill={pal.tick} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {isAll ? (
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground">月份分布（历年合计）</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: pal.tick, fontSize: 12 }} axisLine={{ stroke: pal.axis }} tickLine={false} />
                  <YAxis tick={{ fill: pal.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip {...TT} cursor={{ fill: pal.cursor }} />
                  <Bar dataKey="场次" fill="#a78bfa" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground">{year} 年二刷的影片</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {rewatched.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rewatched} layout="vertical" margin={{ top: 0, right: 32, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={pal.grid} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: pal.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={170} tick={{ fill: pal.tickStrong, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...TT} cursor={{ fill: pal.cursor }} formatter={(v: number) => [`${v} 次`, '观看']} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={18}>
                      <LabelList dataKey="value" position="right" fill={pal.tick} fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  这一年没有二刷的影片
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {heat && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">{year} 年观影日历</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 overflow-x-auto pb-1">
              {Array.from({ length: 12 }, (_, mi) => {
                const month = mi + 1
                const dim = new Date(Number(year), month, 0).getDate()
                return (
                  <div key={month} className="flex items-center gap-1">
                    <span className="w-8 shrink-0 text-right text-[10px] text-muted-foreground">{month}月</span>
                    {Array.from({ length: 31 }, (_, di) => {
                      const day = di + 1
                      if (day > dim) return <span key={day} className="h-3 w-3 shrink-0" />
                      const c = heat.get(`${month}-${day}`) ?? 0
                      return (
                        <span
                          key={day}
                          title={`${month}月${day}日${c ? ` · ${c} 场` : ''}`}
                          className={`h-3 w-3 shrink-0 rounded-[2px] ${c ? '' : 'bg-muted/60'}`}
                          style={c ? { backgroundColor: `rgba(245,158,11,${c >= 3 ? 1 : c === 2 ? 0.7 : 0.4})` } : undefined}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
              少
              {[0.15, 0.4, 0.7, 1].map(a => (
                <span key={a} className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: `rgba(245,158,11,${a})` }} />
              ))}
              多
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
