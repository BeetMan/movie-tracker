/**
 * 票根风分享卡片：canvas 绘制 1200×630 PNG。
 * 深色票根 + 琥珀色品牌元素，左侧电影海报（TMDB 缓存，CORS 安全），
 * 右侧票根信息：片名 / 制式角标 / 日期 / 影院 / 影厅座位 / 票价 / 条码编号。
 */
import type { MovieRecord } from '@/types/movie'
import { formatCategory, brandColor, formatPrice } from '@/types/movie'
import {
  AMBER, BG, FG, MUTED, FONT,
  roundedRect, dashedVLine, dashedHLine, pill, drawBarcode, drawLetterSpaced, loadImage, drawCoverImage, ellipsis,
} from '@/lib/canvasKit'

const W = 1200
const H = 630

export async function renderTicketCard(record: MovieRecord, posterPath?: string | null): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 不可用')

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
      drawCoverImage(ctx, img, px, py, pw, ph, 14)
      ctx.strokeStyle = 'rgba(245,158,11,0.35)'
      ctx.lineWidth = 2
      roundedRect(ctx, px, py, pw, ph, 14)
      ctx.stroke()
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

/** 片名排版：一行放下用大字；两行用中字；再长截断 */
function fitTitle(ctx: CanvasRenderingContext2D, title: string, maxW: number): string[] {
  ctx.font = `700 58px ${FONT}`
  if (ctx.measureText(title).width <= maxW) return [title]
  ctx.font = `700 46px ${FONT}`
  if (ctx.measureText(title).width <= maxW) return [title]
  let split = Math.ceil(title.length / 2)
  while (split > 1 && ctx.measureText(title.slice(0, split)).width > maxW) split--
  const l1 = title.slice(0, split)
  const l2 = ellipsis(ctx, title.slice(split), maxW)
  return [l1, l2]
}
