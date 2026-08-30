import { describe, it, expect } from 'vitest'
import {
  normalizeDate, dedupBase, normSeat, formatPrice, formatCategory,
  learnRegionMap, currencySymbol,
} from '@/types/movie'
import type { MovieRecord } from '@/types/movie'

const rec = (over: Partial<MovieRecord>): MovieRecord => ({
  id: 1, title: '片名', date: '2026.01.01', format: '2D', cinema: '', hall: '',
  seat: '', price: null, note: null, special: null, region: '', year: 2026, ...over,
})

describe('normalizeDate', () => {
  it('月日补零', () => {
    expect(normalizeDate('2026.8.9')).toBe('2026.08.09')
    expect(normalizeDate('2026.12.31')).toBe('2026.12.31')
  })
  it('已补零的不变', () => {
    expect(normalizeDate('2026.08.09')).toBe('2026.08.09')
  })
  it('未知日 ? 也补月份零', () => {
    expect(normalizeDate('2024.5.?')).toBe('2024.05.?')
    expect(normalizeDate('2024.05.?')).toBe('2024.05.?')
  })
  it('无法解析的原样返回', () => {
    expect(normalizeDate('待定')).toBe('待定')
    expect(normalizeDate('')).toBe('')
  })
})

describe('dedupBase / normSeat（合并导入去重）', () => {
  it('日期补零与否视为同一条', () => {
    expect(dedupBase(rec({ date: '2026.8.9' }))).toBe(dedupBase(rec({ date: '2026.08.09' })))
  })
  it('片名首尾空白与全角空格归一', () => {
    expect(dedupBase(rec({ title: '流浪地球3' })))
      .toBe(dedupBase(rec({ title: ' 流浪地球3　' })))
  })
  it('座位多张票的空格归一', () => {
    expect(normSeat('5排13座  6排1座')).toBe('5排13座 6排1座')
  })
})

describe('formatPrice / currencySymbol', () => {
  it('null 票价显示 —', () => {
    expect(formatPrice(null)).toBe('—')
    expect(formatPrice(undefined)).toBe('—')
  })
  it('按币种带符号', () => {
    expect(formatPrice(45)).toBe('¥45')
    expect(formatPrice(60, 'HKD')).toBe('HK$60')
    expect(formatPrice(12.5, 'USD')).toBe('US$12.5')
  })
  it('未知币种原样拼接', () => {
    expect(currencySymbol('XXX')).toBe('XXX ')
  })
})

describe('formatCategory（制式归类）', () => {
  it('IMAX：特效厅标注区分氙灯与激光', () => {
    expect(formatCategory({ format: 'IMAX 3D', special: null })).toBe('IMAX（氙灯）')
    expect(formatCategory({ format: 'IMAX 3D', special: 'IMAX GT' })).toBe('激光 IMAX')
    expect(formatCategory({ format: 'IMAX 2D', special: 'IMAX COLA' })).toBe('激光 IMAX')
  })
  it('杜比：旧标注「杜比影院」归入新标注', () => {
    expect(formatCategory({ format: '杜比影院 2D', special: '杜比影院' })).toBe('杜比视界')
    expect(formatCategory({ format: '2D', special: '杜比视界·全景声厅' })).toBe('杜比视界')
  })
  it('CINITY / 中国巨幕 / 4DX / ScreenX', () => {
    expect(formatCategory({ format: 'CINITY LED 3D', special: null })).toBe('CINITY')
    expect(formatCategory({ format: '中国巨幕 CGS 2D', special: null })).toBe('中国巨幕')
    expect(formatCategory({ format: '4DX 2D', special: null })).toBe('4DX')
    expect(formatCategory({ format: 'ScreenX', special: null })).toBe('ScreenX')
  })
  it('普通与兜底', () => {
    expect(formatCategory({ format: '2D', special: null })).toBe('普通 2D')
    expect(formatCategory({ format: '3D', special: null })).toBe('普通 3D')
    expect(formatCategory({ format: '', special: null })).toBe('其他')
  })
})

describe('learnRegionMap（影院→地区学习）', () => {
  it('取每家影院出现次数最多的地区', () => {
    const list = [
      rec({ cinema: '万达影城A', region: '北京' }),
      rec({ id: 2, cinema: '万达影城A', region: '北京' }),
      rec({ id: 3, cinema: '万达影城A', region: '上海' }),
      rec({ id: 4, cinema: '百丽宫', region: '上海' }),
    ]
    const map = learnRegionMap(list)
    expect(map.get('万达影城A')).toBe('北京')
    expect(map.get('百丽宫')).toBe('上海')
  })
  it('空影院或空地区不参与', () => {
    expect(learnRegionMap([rec({ cinema: '', region: '北京' })]).size).toBe(0)
  })
})
