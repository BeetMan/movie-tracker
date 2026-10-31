/**
 * 观影记录的纯数据逻辑：外部数据（导入文件 / localStorage）清洗、合并去重。
 * 不碰 React 与浏览器 API，便于单元测试。
 */
import type { MovieRecord } from '@/types/movie'
import { CURRENCIES, dedupBase, learnRegionMap, normSeat, normalizeDate } from '@/types/movie'

export function deriveYear(date: string): number {
  const m = /^(\d{4})/.exec(date.trim())
  return m ? parseInt(m[1], 10) : new Date().getFullYear()
}

const str = (v: unknown): string =>
  typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : ''

const strOrNull = (v: unknown): string | null => str(v) || null

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * 把一条来路不明的数据清洗成合法 MovieRecord；片名为空的返回 null（丢弃）。
 * 缺失字段补默认值，类型不对的尽量转换（如字符串票价、数字座位），保证渲染层不会因脏数据崩溃。
 */
export function sanitizeRecord(raw: unknown, fallbackId: number): MovieRecord | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const title = str(r.title)
  if (!title) return null
  const date = normalizeDate(str(r.date))
  const currency = str(r.currency).toUpperCase()
  const id = num(r.id)
  const year = num(r.year)
  return {
    id: id !== null && Number.isInteger(id) && id > 0 ? id : fallbackId,
    title,
    date,
    format: str(r.format),
    cinema: str(r.cinema),
    hall: str(r.hall),
    seat: str(r.seat),
    price: num(r.price),
    currency: (CURRENCIES as readonly string[]).includes(currency) ? currency : 'CNY',
    note: strOrNull(r.note),
    special: strOrNull(r.special),
    region: str(r.region),
    year: year !== null && Number.isInteger(year) ? year : deriveYear(date),
  }
}

/**
 * 清洗一整个数组：丢弃无效条目，重复或缺失的 id 重新编号。
 * 不是数组时抛错。
 */
export function sanitizeRecords(raw: unknown): { records: MovieRecord[]; dropped: number } {
  if (!Array.isArray(raw)) throw new Error('NOT_ARRAY')
  const records: MovieRecord[] = []
  const used = new Set<number>()
  let dropped = 0
  for (const item of raw) {
    const r = sanitizeRecord(item, 0)
    if (!r) { dropped += 1; continue }
    records.push(r)
  }
  let maxId = Math.max(0, ...records.map(r => r.id))
  for (const r of records) {
    if (r.id === 0 || used.has(r.id)) r.id = ++maxId
    used.add(r.id)
  }
  return { records, dropped }
}

/**
 * 解析 localStorage 里的记录。
 * 返回 null 表示「没有存过 / 已损坏」，应回退到内置数据；空数组是合法状态（用户删光了）。
 */
export function parseStored(raw: string | null): MovieRecord[] | null {
  if (raw === null) return null
  try {
    return sanitizeRecords(JSON.parse(raw)).records
  } catch {
    return null
  }
}

/**
 * 合并导入：把 list 补充进 records，按「片名+日期+影院+座位」去重。
 * 座位一致或任一方座位为空（信息不全不敢放行）即视为重复；id 续编，地区沿用学习结果。
 */
export function mergeInto(records: MovieRecord[], list: MovieRecord[]) {
  const seen = records.map(r => ({ base: dedupBase(r), seat: normSeat(r.seat) }))
  const regionMap = learnRegionMap(records)
  let maxId = Math.max(0, ...records.map(r => r.id))
  const merged = [...records]
  let added = 0
  let skipped = 0
  for (const r of list) {
    const base = dedupBase(r)
    const seat = normSeat(r.seat)
    if (seen.some(e => e.base === base && (e.seat === seat || e.seat === '' || seat === ''))) {
      skipped += 1
      continue
    }
    seen.push({ base, seat })
    const region = r.region || regionMap.get(r.cinema) || ''
    merged.push({ ...r, id: ++maxId, region })
    added += 1
  }
  return { merged, added, skipped }
}

/** 整体替换：id 从 1 重新编号，缺地区的按文件内数据学习补全 */
export function replaceWith(list: MovieRecord[]): MovieRecord[] {
  const map = learnRegionMap(list)
  return list.map((r, i) => ({ ...r, id: i + 1, region: r.region || map.get(r.cinema) || '' }))
}
