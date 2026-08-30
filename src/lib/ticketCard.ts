/**
 * 票根风分享卡片：canvas 绘制 1200×630 PNG。
 * 深色票根 + 琥珀色品牌元素，左侧电影海报（TMDB 缓存，CORS 安全），
 * 右侧票根信息：片名 / 制式角标 / 日期 / 影院 / 影厅座位 / 票价 / 条码编号。
 */
import type { MovieRecord } from '@/types/movie'
import { formatCategory, brandColor, formatPrice } from '@/types/movie'

const W = 1200
const H = 630
const AMBER = '#f59e0b'
const BG = '#1c1917'
const FG = '#fafaf9'
const MUTED = '#a8a29e'
const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif'

export async function renderTicketCard(record: MovieRecord, posterPath?: string | null): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 不可用')

  // 背景
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  // 海报（失败则跳过，无占位块）
  let contentX = 64
  if (posterPath) {
    const img = await loadImage(`https://image.tmdb.org/t/p/w342${posterPath}`)
    if (img) {
      const pw = 280
      const ph = 420
      const px = 56
      const py = 105
      ctx.save()
      roundedRect(ctx, px, py, pw, ph, 14)
      ctx.clip()
      // cover 填充
      const scale = Math.max(pw / img.width, ph / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      ctx.drawImage(img, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh)
      ctx.restore()
      // 海报描边
      ctx.strokeStyle = 'rgba(245,158,11,0.35)'
      ctx.lineWidth = 2
      roundedRect(ctx, px, py, pw, ph, 14)
      ctx.stroke()
      // 撕票虚线
      dashedVLine(ctx, 386, 40, H - 40)
      contentX = 436
    }
  }
  const rightEdge = W - 64

  // 顶部品牌行
  ctx.fillStyle = AMBER
  ctx.font = `500 20px ${FONT}`
  ctx.textBaseline = 'alphabetic'
  drawLetterSpaced(ctx, '观影数据库 · MOVIE TRACKER', contentX, 78, 4)

  // 片名（最多两行，超长缩字号 + 省略）
  const cat = formatCategory(record)
  ctx.fillStyle = FG
  const titleLines = fitTitle(ctx, record.title, rightEdge - contentX)
  let y = 150
  for (const l of titleLines) {
    ctx.font = `700 ${titleLines.length > 1 ? 46 : 58}px ${FONT}`
    ctx.fillText(l, contentX, y)
    y += titleLines.length > 1 ? 60 : 0
  }
  if (titleLines.length === 1) y += 8

  // 制式 / 特效厅角标
  y += 34
  let pillX = contentX
  pillX = pill(ctx, pillX, y, cat, brandColor(cat)) + 14
  if (record.special) pill(ctx, pillX, y, record.special, AMBER)

  // 信息行
  const rows: [string, string][] = [
    ['日期', record.date],
    ['影院', record.cinema || '—'],
    ['影厅', [record.hall, record.seat].filter(Boolean).join(' · ') || '—'],
    ['票价', record.price !== null ? formatPrice(record.price, record.currency) : '—'],
  ]
  y = 330
  for (const [label, value] of rows) {
    ctx.font = `400 22px ${FONT}`
    ctx.fillStyle = MUTED
    ctx.fillText(label, contentX, y)
    ctx.font = `500 26px ${FONT}`
    ctx.fillStyle = FG
    ctx.fillText(ellipsis(ctx, value, rightEdge - contentX - 90), contentX + 90, y)
    y += 48
  }

  // 底部：条码 + 编号 + 备注
  dashedHLine(ctx, contentX, 530, rightEdge)
  drawBarcode(ctx, record.id, contentX, 552, 220, 44)
  ctx.font = `500 20px ${FONT}`
  ctx.fillStyle = MUTED
  ctx.fillText(`NO.${String(record.id).padStart(4, '0')}`, contentX + 240, 584)
  if (record.note) {
    ctx.textAlign = 'right'
    ctx.fillStyle = AMBER
    ctx.font = `400 20px ${FONT}`
    ctx.fillText(ellipsis(ctx, record.note, 400), rightEdge, 584)
    ctx.textAlign = 'left'
  }

  return canvas.toDataURL('image/png')
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // image.tmdb.org 带 CORS 头，不会污染 canvas
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function dashedVLine(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(168,162,158,0.45)'
  ctx.lineWidth = 2
  ctx.setLineDash([8, 10])
  ctx.beginPath()
  ctx.moveTo(x, y0)
  ctx.lineTo(x, y1)
  ctx.stroke()
  ctx.restore()
}

function dashedHLine(ctx: CanvasRenderingContext2D, x0: number, y: number, x1: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(168,162,158,0.3)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 8])
  ctx.beginPath()
  ctx.moveTo(x0, y)
  ctx.lineTo(x1, y)
  ctx.stroke()
  ctx.restore()
}

/** 片名排版：一行放下用大字；两行用中字；再长截断 */
function fitTitle(ctx: CanvasRenderingContext2D, title: string, maxW: number): string[] {
  ctx.font = `700 58px ${FONT}`
  if (ctx.measureText(title).width <= maxW) return [title]
  ctx.font = `700 46px ${FONT}`
  if (ctx.measureText(title).width <= maxW) return [title]
  // 折两行：尽量均分
  let split = Math.ceil(title.length / 2)
  while (split > 1 && ctx.measureText(title.slice(0, split)).width > maxW) split--
  const l1 = title.slice(0, split)
  const l2 = ellipsis(ctx, title.slice(split), maxW)
  return [l1, l2]
}

function ellipsis(ctx: CanvasRenderingContext2D, s: string, maxW: number): string {
  if (ctx.measureText(s).width <= maxW) return s
  let t = s
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

/** 角标：描边圆角小胶囊，返回右缘 x */
function pill(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string): number {
  ctx.font = `500 20px ${FONT}`
  const tw = ctx.measureText(text).width
  const w = tw + 32
  const h = 34
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  roundedRect(ctx, x, y - 24, w, h, 17)
  ctx.stroke()
  ctx.fillStyle = color
  ctx.fillText(text, x + 16, y)
  return x + w
}

/** 由记录 id 生成伪随机条码（视觉装饰，不可扫） */
function drawBarcode(ctx: CanvasRenderingContext2D, seed: number, x: number, y: number, w: number, h: number) {
  let s = seed * 2654435761 >>> 0
  const rand = () => {
    s = (s * 1103515245 + 12345) >>> 0
    return s / 0xffffffff
  }
  ctx.fillStyle = FG
  let cx = x
  while (cx < x + w) {
    const bw = 2 + Math.floor(rand() * 5)
    if (rand() > 0.45) ctx.fillRect(cx, y, bw, h)
    cx += bw + 2
  }
}

function drawLetterSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  let cx = x
  for (const ch of text) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + spacing
  }
}
