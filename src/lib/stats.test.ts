import { describe, it, expect } from 'vitest'
import { byMonth, byYear, spendByCurrency, yoyCompare, dayCounts, topRewatched, topCinemas } from '@/lib/stats'
import type { MovieRecord } from '@/types/movie'

const rec = (over: Partial<MovieRecord>): MovieRecord => ({
  id: 1, title: '片名', date: '2026.01.01', format: '2D', cinema: '万达影城',
  hall: '', seat: '', price: null, note: null, special: null, region: '', year: 2026, ...over,
})

describe('byMonth', () => {
  it('按月计数，花费只计人民币', () => {
    const list = [
      rec({ date: '2026.03.05', price: 40 }),
      rec({ id: 2, date: '2026.03.20', price: 50 }),
      rec({ id: 3, date: '2026.08.01', price: 60, currency: 'HKD' }), // 港币不进花费
    ]
    const m = byMonth(list)
    expect(m[2]).toEqual({ month: '3月', 场次: 2, 花费: 90 })
    expect(m[7]).toEqual({ month: '8月', 场次: 1, 花费: 0 })
  })
})

describe('byYear', () => {
  it('按年计数并升序排列', () => {
    const list = [rec({ year: 2025, date: '2025.01.01' }), rec({ id: 2, year: 2024, date: '2024.06.01' })]
    expect(byYear(list).map(y => y.year)).toEqual(['2024', '2025'])
  })
})

describe('spendByCurrency', () => {
  it('分币种汇总与均价', () => {
    const list = [
      rec({ price: 40 }), rec({ id: 2, price: 60 }),
      rec({ id: 3, price: 90, currency: 'HKD' }),
      rec({ id: 4, price: null }), // 无票价不参与
    ]
    const s = spendByCurrency(list)
    expect(s).toHaveLength(2)
    expect(s[0]).toMatchObject({ currency: 'CNY', spend: 100, count: 2, avg: 50 })
    expect(s[1]).toMatchObject({ currency: 'HKD', spend: 90, count: 1 })
  })
  it('全部无票价返回空', () => {
    expect(spendByCurrency([rec({})])).toEqual([])
  })
})

describe('yoyCompare（年度同比）', () => {
  const list = [
    // 2025 全年 12 条（每月一条，每条 ¥30）
    ...Array.from({ length: 12 }, (_, i) =>
      rec({ id: i + 1, year: 2025, date: `2025.${String(i + 1).padStart(2, '0')}.10`, price: 30 })),
    // 2026 前 3 个月共 5 条
    ...Array.from({ length: 5 }, (_, i) =>
      rec({ id: 100 + i, year: 2026, date: `2026.0${(i % 3) + 1}.10`, price: 50 })),
  ]
  it('按当年最大月份对齐去年同期', () => {
    const yoy = yoyCompare(list, 2026)
    expect(yoy).not.toBeNull()
    expect(yoy!.maxMonth).toBe(3)
    expect(yoy!.count).toBe(5)
    expect(yoy!.prevCount).toBe(3) // 2025 年 1–3 月各一条
    expect(yoy!.spend).toBe(250)
    expect(yoy!.prevSpend).toBe(90)
  })
  it('上一年没有记录时返回 null', () => {
    expect(yoyCompare([rec({ year: 2026, date: '2026.01.05' })], 2026)).toBeNull()
  })
})

describe('dayCounts（日历热力图）', () => {
  it('按月-日计数，跳过不完整日期与其他年份', () => {
    const list = [
      rec({ date: '2026.03.05' }),
      rec({ id: 2, date: '2026.03.05' }),
      rec({ id: 3, date: '2026.03.?' }),   // 未知日，跳过
      rec({ id: 4, date: '2025.03.05', year: 2025 }), // 其他年份，跳过
    ]
    const map = dayCounts(list, 2026)
    expect(map.get('3-5')).toBe(2)
    expect(map.size).toBe(1)
  })
})

describe('topRewatched / topCinemas', () => {
  it('只保留二刷以上的影片，按次数降序', () => {
    const list = [
      rec({ title: 'A' }), rec({ id: 2, title: 'A' }), rec({ id: 3, title: 'A' }),
      rec({ id: 4, title: 'B' }), rec({ id: 5, title: 'B' }),
      rec({ id: 6, title: 'C' }),
    ]
    expect(topRewatched(list)).toEqual([{ name: 'A', value: 3 }, { name: 'B', value: 2 }])
  })
  it('影院按场次降序取前 N', () => {
    const list = [
      rec({ cinema: '甲影院' }), rec({ id: 2, cinema: '甲影院' }), rec({ id: 3, cinema: '乙影院' }),
    ]
    expect(topCinemas(list, 1)).toHaveLength(1)
    expect(topCinemas(list, 1)[0]).toMatchObject({ full: '甲影院', value: 2 })
  })
})
