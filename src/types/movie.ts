export interface MovieRecord {
  id: number
  title: string
  date: string // YYYY.MM.DD，未知日可用 ?
  format: string
  cinema: string
  hall: string
  seat: string
  price: number | null
  /** 票价币种代码（CNY/HKD/…），缺省视为 CNY */
  currency?: string
  note: string | null
  special: string | null
  region: string
  year: number
}

/** 支持的币种与显示符号 */
export const CURRENCIES = ['CNY', 'HKD', 'MOP', 'TWD', 'USD', 'EUR', 'JPY', 'KRW'] as const

export const CURRENCY_NAMES: Record<string, string> = {
  CNY: '人民币 ¥',
  HKD: '港币 HK$',
  MOP: '澳门币 MOP$',
  TWD: '新台币 NT$',
  USD: '美元 US$',
  EUR: '欧元 €',
  JPY: '日元 JP¥',
  KRW: '韩元 ₩',
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥', HKD: 'HK$', MOP: 'MOP$', TWD: 'NT$', USD: 'US$', EUR: '€', JPY: 'JP¥', KRW: '₩',
}

export function currencySymbol(code: string | null | undefined): string {
  return CURRENCY_SYMBOLS[code || 'CNY'] ?? `${code} `
}

/** 票价显示：¥45 / HK$60 / US$12.5 */
export function formatPrice(price: number | null | undefined, currency?: string | null): string {
  if (price === null || price === undefined) return '—'
  const n = price.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  return `${currencySymbol(currency)}${n}`
}

export type MovieDraft = Omit<MovieRecord, 'id' | 'year'>

/**
 * 从现有数据学习「影院 → 地区」的对应关系（取每家影院最常见的地区），
 * 用于新增记录时预填地区，不含任何写死的城市列表。
 */
export function learnRegionMap(records: MovieRecord[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>()
  for (const r of records) {
    if (!r.cinema || !r.region) continue
    const m = counts.get(r.cinema) ?? new Map<string, number>()
    m.set(r.region, (m.get(r.region) ?? 0) + 1)
    counts.set(r.cinema, m)
  }
  const map = new Map<string, string>()
  for (const [cinema, m] of counts) {
    let best = ''
    let bestN = 0
    for (const [region, n] of m) {
      if (n > bestN) { best = region; bestN = n }
    }
    map.set(cinema, best)
  }
  return map
}

/** 数据中出现过的地区列表，按记录数降序 */
export function listRegions(records: MovieRecord[]): string[] {
  const count = new Map<string, number>()
  for (const r of records) {
    if (r.region) count.set(r.region, (count.get(r.region) ?? 0) + 1)
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
}

/** 格式（影片拷贝版本）可选列表，也可手动输入其他值 */
export const FORMAT_OPTIONS = [
  '2D', '3D',
  'IMAX 2D', 'IMAX 3D',
  '杜比视界 2D', '杜比视界 3D',
  'CINITY 2D', 'CINITY 3D',
  'CINITY LED 2D', 'CINITY LED 3D',
  '中国巨幕 CGS 2D', '中国巨幕 CGS 3D',
  '4DX 2D', '4DX 3D',
  'MX4D 2D', 'MX4D 3D',
  'ScreenX',
]

/** 特效厅标注可选列表，也可手动输入其他值；普通场次留空 */
export const SPECIAL_HALL_OPTIONS = [
  'IMAX Xenon', 'IMAX COLA', 'IMAX XT', 'IMAX GT',
  '杜比影院', '杜比视界·全景声厅', 'CINITY', 'CINITY LED',
  '中国巨幕 CGS', 'LUXE 巨幕', 'Onyx LED', '4DX', 'MX4D', 'ScreenX',
]

/** 根据格式与特效厅标注归类 */
export function formatCategory(r: Pick<MovieRecord, 'format' | 'special'>): string {
  const f = r.format || ''
  const s = r.special || ''
  // 「杜比影院」为旧标注，统一归入新标注「杜比视界」；「杜比全景声」混排版不算
  if (/杜比影院|杜比视界/.test(s) || /杜比影院|杜比视界/.test(f)) return '杜比视界'
  if (s.includes('CINITY') || f.includes('CINITY')) return 'CINITY'
  if (s.includes('IMAX') || f.includes('IMAX')) {
    if (s.includes('激光') || s.includes('COLA') || s.includes('XT') || s.includes('GT') || f.includes('激光')) return '激光 IMAX'
    return 'IMAX（氙灯）'
  }
  if (/中国巨幕|CGS/i.test(s) || /中国巨幕|CGS/i.test(f)) return '中国巨幕'
  if (/MX4D/i.test(s) || /MX4D/i.test(f)) return 'MX4D'
  if (/4DX/i.test(s) || /4DX/i.test(f)) return '4DX'
  if (/ScreenX/i.test(s) || /ScreenX/i.test(f)) return 'ScreenX'
  if (/LUXE/i.test(s) || /LUXE/i.test(f)) return 'LUXE 巨幕'
  if (/Onyx/i.test(s) || /Onyx/i.test(f)) return 'Onyx LED'
  if (f.includes('3D')) return '普通 3D'
  if (f.includes('2D')) return '普通 2D'
  return '其他'
}

/** 各制式的品牌色 */
export const BRAND_COLORS: Record<string, string> = {
  'IMAX（氙灯）': '#2f80ed',
  '激光 IMAX': '#56ccf2',
  '杜比视界': '#8b5cf6',
  'CINITY': '#dc2626',
  '中国巨幕': '#ea580c',
  'LUXE 巨幕': '#eab308',
  'Onyx LED': '#14b8a6',
  '4DX': '#fb7185',
  'MX4D': '#4ade80',
  'ScreenX': '#38bdf8',
  '普通 2D': '#78716c',
  '普通 3D': '#a8a29e',
  '其他': '#57534e',
}

export function brandColor(category: string): string {
  return BRAND_COLORS[category] ?? '#94a3b8'
}
