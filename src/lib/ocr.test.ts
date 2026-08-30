import { describe, it, expect } from 'vitest'
import { parseTicketText } from '@/lib/ocr'

interface OcrLine { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }
const line = (text: string, y0: number, height: number): OcrLine => ({
  text,
  bbox: { x0: 0, y0, x1: 100, y1: y0 + height },
})

describe('parseTicketText（本地 OCR 票面解析）', () => {
  it('淘票票风格票面：全字段', () => {
    const text = '流浪地球3 2026年8月15日 19:30 万达影城（CBD万达广场店） 1号激光IMAX厅 5排13座 实付：¥68.00 淘票票 取票码 1234'
    const lines = [
      line('流浪地球3', 10, 40),
      line('2026年8月15日 19:30', 60, 20),
      line('万达影城（CBD万达广场店）', 90, 20),
      line('1号激光IMAX厅 5排13座', 120, 20),
      line('实付：¥68.00', 150, 20),
    ]
    const r = parseTicketText(text, lines)
    expect(r.title).toBe('流浪地球3')
    expect(r.date).toBe('2026.8.15')
    expect(r.cinema).toBe('万达影城（CBD万达广场店）')
    expect(r.seat).toBe('5排13座')
    expect(r.price).toBe(68)
    expect(r.currency).toBe('CNY')
    expect(r.format).toBe('IMAX 2D')
  })

  it('日期三种写法通吃', () => {
    expect(parseTicketText('2026年8月15日 某影城', []).date).toBe('2026.8.15')
    expect(parseTicketText('2026-08-15 某影城', []).date).toBe('2026.8.15')
    expect(parseTicketText('2026.08.15 某影城', []).date).toBe('2026.8.15')
  })

  it('多张票座位合并去重', () => {
    const r = parseTicketText('5排13座 5排14座 5排13座 某影城', [])
    expect(r.seat).toBe('5排13座 5排14座')
  })

  it('港币票识别币种', () => {
    const r = parseTicketText('某電影 2026年1月1日 百老匯戲院 HK$110', [])
    expect(r.price).toBe(110)
    expect(r.currency).toBe('HKD')
  })

  it('价格优先取「实付/总价」类标签', () => {
    const r = parseTicketText('票价¥45 服务费¥5 实付¥50 某影城', [])
    expect(r.price).toBe(50)
  })

  it('杜比影院旧标注归一为新标注', () => {
    const r = parseTicketText('某片 2026年1月1日 某影城 杜比影院 3D', [])
    expect(r.format).toBe('杜比视界 3D')
    expect(r.special).toBe('杜比影院')
  })

  it('CINITY LED 优先于 CINITY', () => {
    const r = parseTicketText('某片 2026年1月1日 某影城 CINITY LED厅', [])
    expect(r.format).toBe('CINITY LED 2D')
    expect(r.special).toBe('CINITY LED')
  })

  it('IMAX 不猜氙灯/激光，special 留空', () => {
    const r = parseTicketText('某片 2026年1月1日 某影城 IMAX 3D', [])
    expect(r.format).toBe('IMAX 3D')
    expect(r.special).toBeNull()
  })

  it('点映/路演等关键词进备注', () => {
    const r = parseTicketText('某片 2026年1月1日 某影城 超前点映场 主创路演', [])
    expect(r.note).toContain('点映')
    expect(r.note).toContain('路演')
  })

  it('片名启发式：上半部分字高最大的非噪声行', () => {
    const lines = [
      line('淘票票', 0, 20),
      line('长安的荔枝', 30, 44),   // 大字标题
      line('2026年8月1日', 90, 18),
      line('幸福蓝海影城（江宁店）', 120, 18),
    ]
    const text = lines.map(l => l.text).join(' ')
    expect(parseTicketText(text, lines).title).toBe('长安的荔枝')
  })

  it('噪声行不会被当作片名', () => {
    const lines = [
      line('取票二维码', 0, 30),
      line('2026年8月1日', 40, 18),
    ]
    expect(parseTicketText(lines.map(l => l.text).join(' '), lines).title).toBe('')
  })
})
