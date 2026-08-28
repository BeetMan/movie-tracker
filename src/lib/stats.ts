import type { MovieRecord } from '@/types/movie'
import { formatCategory } from '@/types/movie'

export function overallStats(records: MovieRecord[]) {
  const total = records.length
  const films = new Set(records.map(r => r.title)).size
  const cinemas = new Set(records.map(r => r.cinema).filter(Boolean)).size
  return { total, films, cinemas }
}

/** 按币种分组的花费与均价（缺省币种视为 CNY） */
export function spendByCurrency(records: MovieRecord[]) {
  const map = new Map<string, { spend: number; count: number }>()
  for (const r of records) {
    if (r.price === null || r.price === undefined) continue
    const cur = r.currency || 'CNY'
    const e = map.get(cur) ?? { spend: 0, count: 0 }
    e.spend += r.price
    e.count += 1
    map.set(cur, e)
  }
  return [...map.entries()]
    .sort((a, b) => b[1].spend - a[1].spend)
    .map(([currency, v]) => ({ currency, spend: v.spend, count: v.count, avg: v.spend / v.count }))
}

/** 花费趋势只统计人民币票价，避免不同币种直接相加 */
const cnySpend = (r: MovieRecord) => ((r.currency || 'CNY') === 'CNY' ? r.price ?? 0 : 0)

export function byYear(records: MovieRecord[]) {
  const map = new Map<number, { count: number; spend: number }>()
  for (const r of records) {
    const e = map.get(r.year) ?? { count: 0, spend: 0 }
    e.count += 1
    e.spend += cnySpend(r)
    map.set(r.year, e)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, v]) => ({ year: String(year), 场次: v.count, 花费: Math.round(v.spend) }))
}

export function byFormat(records: MovieRecord[]) {
  const map = new Map<string, number>()
  for (const r of records) {
    const c = formatCategory(r)
    map.set(c, (map.get(c) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export function topCinemas(records: MovieRecord[], n = 10) {
  const map = new Map<string, number>()
  for (const r of records) {
    if (!r.cinema) continue
    map.set(r.cinema, (map.get(r.cinema) ?? 0) + 1)
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, value]) => ({ name: shortCinema(name), full: name, value }))
}

function shortCinema(name: string) {
  const m = /^(.+?影城|.+?戲院|.+?戏院)/.exec(name)
  let s = m ? m[1] : name
  const inner = /（(.+?)）/.exec(name)
  if (inner) s += `（${inner[1].replace(/IMAX|杜比巨幕|激光/g, '').slice(0, 6)}）`
  return s.length > 16 ? s.slice(0, 15) + '…' : s
}

export function byMonth(records: MovieRecord[]) {
  const counts = Array(12).fill(0) as number[]
  const spends = Array(12).fill(0) as number[]
  for (const r of records) {
    const m = /^\d{4}\.(\d{2})/.exec(r.date)
    if (m) {
      counts[parseInt(m[1], 10) - 1] += 1
      spends[parseInt(m[1], 10) - 1] += cnySpend(r)
    }
  }
  return counts.map((v, i) => ({ month: `${i + 1}月`, 场次: v, 花费: Math.round(spends[i]) }))
}

/** 某一年每天（月-日）的观影场次，用于日历热力图；日期不完整的记录（如 2024.05.?）跳过 */
export function dayCounts(records: MovieRecord[], year: number): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of records) {
    const m = /^(\d{4})\.(\d{2})\.(\d{2})/.exec(r.date)
    if (!m || Number(m[1]) !== year) continue
    const key = `${Number(m[2])}-${Number(m[3])}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

export function topRewatched(records: MovieRecord[], n = 8) {
  const map = new Map<string, number>()
  for (const r of records) map.set(r.title, (map.get(r.title) ?? 0) + 1)
  return [...map.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, value]) => ({ name, value }))
}
