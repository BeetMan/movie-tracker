import { describe, it, expect } from 'vitest'
import { sanitizeRecord, sanitizeRecords, parseStored, mergeInto, replaceWith, deriveYear } from '@/lib/records'
import type { MovieRecord } from '@/types/movie'

const rec = (over: Partial<MovieRecord>): MovieRecord => ({
  id: 1, title: '片名', date: '2026.01.01', format: '2D', cinema: '', hall: '',
  seat: '', price: null, currency: 'CNY', note: null, special: null, region: '', year: 2026, ...over,
})

describe('sanitizeRecord', () => {
  it('缺失字段补默认值，不留 undefined', () => {
    const r = sanitizeRecord({ title: '沙丘' }, 7)!
    expect(r).toEqual({
      id: 7, title: '沙丘', date: '', format: '', cinema: '', hall: '', seat: '',
      price: null, currency: 'CNY', note: null, special: null, region: '', year: new Date().getFullYear(),
    })
  })
  it('片名缺失或为空白的丢弃', () => {
    expect(sanitizeRecord({ date: '2026.01.01' }, 1)).toBeNull()
    expect(sanitizeRecord({ title: '   ' }, 1)).toBeNull()
    expect(sanitizeRecord(null, 1)).toBeNull()
    expect(sanitizeRecord('沙丘', 1)).toBeNull()
  })
  it('类型转换：字符串票价、数字座位、日期补零、币种大小写', () => {
    const r = sanitizeRecord({ title: ' 沙丘 ', date: '2024.3.1', price: '45.5', seat: 12, currency: 'hkd' }, 1)!
    expect(r.title).toBe('沙丘')
    expect(r.date).toBe('2024.03.01')
    expect(r.price).toBe(45.5)
    expect(r.seat).toBe('12')
    expect(r.currency).toBe('HKD')
    expect(r.year).toBe(2024)
  })
  it('非法票价置空、未知币种回退 CNY', () => {
    const r = sanitizeRecord({ title: 'a', price: 'abc', currency: 'XYZ' }, 1)!
    expect(r.price).toBeNull()
    expect(r.currency).toBe('CNY')
  })
  it('空字符串备注 / 特效厅归一为 null', () => {
    const r = sanitizeRecord({ title: 'a', note: '  ', special: '' }, 1)!
    expect(r.note).toBeNull()
    expect(r.special).toBeNull()
  })
  it('保留文件里的合法 id 与年份', () => {
    const r = sanitizeRecord({ id: 42, title: 'a', date: '2024.01.01', year: 2023 }, 1)!
    expect(r.id).toBe(42)
    expect(r.year).toBe(2023)
  })
})

describe('sanitizeRecords', () => {
  it('不是数组时抛错', () => {
    expect(() => sanitizeRecords({ title: 'a' })).toThrow()
  })
  it('统计丢弃条数', () => {
    const { records, dropped } = sanitizeRecords([{ title: 'a' }, {}, null, { title: 'b' }])
    expect(records.map(r => r.title)).toEqual(['a', 'b'])
    expect(dropped).toBe(2)
  })
  it('重复 / 缺失的 id 续编，不与已有 id 冲突', () => {
    const { records } = sanitizeRecords([{ id: 3, title: 'a' }, { id: 3, title: 'b' }, { title: 'c' }])
    const ids = records.map(r => r.id)
    expect(ids[0]).toBe(3)
    expect(new Set(ids).size).toBe(3)
    expect(ids.every(id => id > 0)).toBe(true)
  })
})

describe('parseStored', () => {
  it('没存过返回 null（回退内置数据）', () => {
    expect(parseStored(null)).toBeNull()
  })
  it('空数组是合法状态，不回退内置数据', () => {
    expect(parseStored('[]')).toEqual([])
  })
  it('损坏的 JSON 返回 null', () => {
    expect(parseStored('{oops')).toBeNull()
    expect(parseStored('{"a":1}')).toBeNull()
  })
  it('顺带清洗脏数据', () => {
    expect(parseStored('[{"title":"a"},{"x":1}]')!.map(r => r.title)).toEqual(['a'])
  })
})

describe('mergeInto', () => {
  const existing = [rec({ id: 5, title: '沙丘', date: '2024.03.01', cinema: '万达', seat: '5排1座', region: '北京' })]

  it('片名+日期+影院+座位相同视为重复', () => {
    const { merged, added, skipped } = mergeInto(existing, [rec({ title: '沙丘', date: '2024.03.01', cinema: '万达', seat: '5排1座' })])
    expect([added, skipped]).toEqual([0, 1])
    expect(merged).toHaveLength(1)
  })
  it('任一方座位为空也视为重复', () => {
    expect(mergeInto(existing, [rec({ title: '沙丘', date: '2024.03.01', cinema: '万达', seat: '' })]).skipped).toBe(1)
  })
  it('座位不同（同场两张票分开录）视为新记录', () => {
    expect(mergeInto(existing, [rec({ title: '沙丘', date: '2024.03.01', cinema: '万达', seat: '5排2座' })]).added).toBe(1)
  })
  it('新记录 id 续编，地区按影院学习补全', () => {
    const { merged } = mergeInto(existing, [rec({ id: 1, title: '奥本海默', cinema: '万达', region: '' })])
    expect(merged[1].id).toBe(6)
    expect(merged[1].region).toBe('北京')
  })
  it('文件内部的重复也只加一次', () => {
    const r = rec({ title: '新片', cinema: '万达', seat: '1排1座' })
    expect(mergeInto(existing, [r, { ...r }]).added).toBe(1)
  })
  it('不修改传入的原数组', () => {
    const copy = [...existing]
    mergeInto(existing, [rec({ title: '新片' })])
    expect(existing).toEqual(copy)
  })
})

describe('replaceWith', () => {
  it('id 从 1 重新编号，缺地区的按文件内数据学习', () => {
    const out = replaceWith([
      rec({ id: 9, cinema: 'A', region: '上海' }),
      rec({ id: 9, cinema: 'A', region: '' }),
    ])
    expect(out.map(r => r.id)).toEqual([1, 2])
    expect(out[1].region).toBe('上海')
  })
})

describe('deriveYear', () => {
  it('取日期前四位', () => {
    expect(deriveYear('2019.05.?')).toBe(2019)
  })
})
