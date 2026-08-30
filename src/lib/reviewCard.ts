/**
 * 年度观影报告分享图：canvas 绘制 1000px 宽竖版 PNG，高度按内容自适应。
 * 结构：品牌行 → 大标题 → 四项大数字 → 同比 → 制式分布条 → 观影日历热力 →
 *      常去影院 / 二刷影片 双栏 → 海报条 → 底部条码。
 * 没数据的板块自动跳过（如无二刷影片、无海报缓存）。
 */
import type { MovieRecord } from '@/types/movie'
import { brandColor, formatPrice } from '@/types/movie'
import { overallStats, spendByCurrency, byFormat, topCinemas, topRewatched, dayCounts, yoyCompare } from '@/lib/stats'
import { findPoster, posterUrl, type PosterCache } from '@/lib/tmdb'
import {
  AMBER, BG, FG, MUTED, FONT,
  dashedHLine, drawBarcode, drawLetterSpaced, loadImage, drawCoverImage, ellipsis,
} from '@/lib/canvasKit'

const W = 1000
const MARGIN = 56
const RIGHT = W - MARGIN
const SEC = 52 // 板块间距

const CELL = 16
const GAP = 4

export async function renderReviewCard(records: MovieRecord[], year: number, posters: PosterCache): Promise<string> {
  const list = records.filter(r => r.year === year)
  if (list.length === 0) throw new Error('这一年没有记录')

  // ── 数据准备 ──
  const s = overallStats(list)
  const spending = spendByCurrency(list)
  const formats = byFormat(list).slice(0, 5)
  const cinemas = topCinemas(list, 3)
  const rewatched = topRewatched(list, 5)
  const heat = dayCounts(list, year)
  const yoy = yoyCompare(records, year)
  const hasYoy = !!(yoy && (yoy.prevCount > 0 || yoy.prevSpend > 0))
  const maxCols = Math.max(cinemas.length, rewatched.length)

  // 海报条：当年看过且已缓存海报的影片（最近在前，最多 8 张）
  const seen = new Set<string>()
  const posterFilms: { title: string; poster: string }[] = []
  for (const r of [...list].sort((a, b) => b.date.localeCompare(a.date))) {
    if (seen.has(r.title)) continue
    seen.add(r.title)
    const match = findPoster(posters, r.title, r.year)
    const url = match?.poster ? posterUrl(match.poster, 'w154') : null
    if (url) posterFilms.push({ title: r.title, poster: url })
    if (posterFilms.length >= 8) break
  }

  // ── 预排版：自顶向下计算各板块 y 位置与总高 ──
  let y = 330 // header（品牌行 + 大标题 + 四项数字）固定占 330
  if (hasYoy) y += 56
  const fmtY = y + SEC
  y = fmtY + 44 + formats.length * 34
  const heatY = y + SEC
  y = heatY + 44 + 12 * (CELL + GAP)
  const colsY = y + SEC
  y = colsY + 44 + maxCols * 40
  const posterY = posterFilms.length > 0 ? y + SEC : -1
  if (posterY > 0) y = posterY + 44 + 144
  const footerLineY = y + 36
  const H = footerLineY + 96

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 不可用')

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'

  // ── 头部 ──
  ctx.fillStyle = AMBER
  ctx.font = `500 18px ${FONT}`
  drawLetterSpaced(ctx, '观影数据库 · MOVIE TRACKER', MARGIN, 64, 3)

  ctx.fillStyle = FG
  ctx.font = `700 76px ${FONT}`
  ctx.fillText(`${year}`, MARGIN, 160)
  const yearW = ctx.measureText(`${year}`).width
  ctx.font = `700 40px ${FONT}`
  ctx.fillText('观影报告', MARGIN + yearW + 20, 158)

  ctx.font = `400 16px ${FONT}`
  ctx.fillStyle = MUTED
  ctx.textAlign = 'right'
  ctx.fillText(`生成于 ${new Date().toISOString().slice(0, 10)}`, RIGHT, 64)
  ctx.textAlign = 'left'

  // ── 四项大数字（总花费：最大币种为主，其余币种小字附注） ──
  const tiles: { label: string; value: string; sub?: string }[] = [
    { label: '观影场次', value: String(s.total) },
    { label: '不同影片', value: String(s.films) },
    { label: '打卡影院', value: String(s.cinemas) },
    spending.length
      ? {
          label: '总花费',
          value: formatPrice(spending[0].spend, spending[0].currency),
          sub: spending.length > 1 ? `另有 ${spending.slice(1).map(c => formatPrice(c.spend, c.currency)).join(' · ')}` : undefined,
        }
      : { label: '总花费', value: '—' },
  ]
  const colW = (RIGHT - MARGIN) / tiles.length
  tiles.forEach((t, i) => {
    const x = MARGIN + i * colW
    ctx.font = `700 ${t.value.length > 8 ? 30 : 44}px ${FONT}`
    ctx.fillStyle = i === 0 ? AMBER : FG
    ctx.fillText(t.value, x, 250)
    ctx.font = `400 17px ${FONT}`
    ctx.fillStyle = MUTED
    ctx.fillText(t.label, x, 280)
    if (t.sub) {
      ctx.font = `400 15px ${FONT}`
      ctx.fillStyle = MUTED
      ctx.fillText(ellipsis(ctx, t.sub, colW - 16), x, 304)
    }
  })

  // ── 同比 ──
  if (hasYoy && yoy) {
    const diff = yoy.count - yoy.prevCount
    const pct = yoy.prevCount > 0 ? Math.round((diff / yoy.prevCount) * 100) : null
    ctx.font = `400 20px ${FONT}`
    ctx.fillStyle = MUTED
    ctx.fillText(`较 ${year - 1} 年同期（1–${yoy.maxMonth}月）：场次 ${yoy.count} vs ${yoy.prevCount}`, MARGIN, 350)
    if (diff !== 0) {
      ctx.fillStyle = diff > 0 ? '#4ade80' : '#fb7185'
      ctx.font = `600 20px ${FONT}`
      ctx.fillText(`${diff > 0 ? '↑' : '↓'}${Math.abs(diff)}${pct !== null ? `（${diff > 0 ? '+' : ''}${pct}%）` : ''}`, MARGIN + 400, 350)
    }
  }

  // ── 制式分布 ──
  ctx.font = `600 24px ${FONT}`
  ctx.fillStyle = FG
  ctx.fillText('制式分布', MARGIN, fmtY)
  let by = fmtY + 14
  const maxFmt = Math.max(...formats.map(f => f.value), 1)
  const barX = MARGIN + 170
  const barMaxW = RIGHT - barX - 60
  for (const f of formats) {
    by += 34
    ctx.font = `400 19px ${FONT}`
    ctx.fillStyle = MUTED
    ctx.textAlign = 'right'
    ctx.fillText(f.name, MARGIN + 160, by + 16)
    ctx.textAlign = 'left'
    ctx.fillStyle = brandColor(f.name)
    const bw = Math.max(6, Math.round((f.value / maxFmt) * barMaxW))
    ctx.beginPath()
    ctx.roundRect(barX, by, bw, 22, 4)
    ctx.fill()
    ctx.fillStyle = FG
    ctx.font = `500 18px ${FONT}`
    ctx.fillText(String(f.value), barX + bw + 10, by + 17)
  }

  // ── 观影日历热力 ──
  ctx.font = `600 24px ${FONT}`
  ctx.fillStyle = FG
  ctx.fillText('观影日历', MARGIN, heatY)
  for (let month = 1; month <= 12; month++) {
    const rowY = heatY + 24 + (month - 1) * (CELL + GAP)
    ctx.font = `400 14px ${FONT}`
    ctx.fillStyle = MUTED
    ctx.fillText(`${month}月`, MARGIN, rowY + CELL - 3)
    const dim = new Date(year, month, 0).getDate()
    for (let day = 1; day <= dim; day++) {
      const c = heat.get(`${month}-${day}`) ?? 0
      ctx.fillStyle = c ? `rgba(245,158,11,${c >= 3 ? 1 : c === 2 ? 0.7 : 0.4})` : 'rgba(168,162,158,0.16)'
      ctx.beginPath()
      ctx.roundRect(MARGIN + 52 + (day - 1) * (CELL + GAP), rowY, CELL, CELL, 3)
      ctx.fill()
    }
  }

  // ── 常去影院 / 二刷影片 双栏 ──
  const colRight = MARGIN + (RIGHT - MARGIN) / 2 + 20
  ctx.font = `600 24px ${FONT}`
  ctx.fillStyle = FG
  ctx.fillText('常去影院', MARGIN, colsY)
  let yL = colsY
  ctx.font = `400 19px ${FONT}`
  for (const c of cinemas) {
    yL += 40
    ctx.fillStyle = FG
    ctx.fillText(ellipsis(ctx, c.full, 330), MARGIN, yL)
    ctx.fillStyle = AMBER
    ctx.textAlign = 'right'
    ctx.fillText(`${c.value} 场`, colRight - 40, yL)
    ctx.textAlign = 'left'
  }
  if (rewatched.length > 0) {
    ctx.font = `600 24px ${FONT}`
    ctx.fillStyle = FG
    ctx.fillText('二刷影片', colRight, colsY)
    let yR = colsY
    ctx.font = `400 19px ${FONT}`
    for (const r of rewatched) {
      yR += 40
      ctx.fillStyle = FG
      ctx.fillText(ellipsis(ctx, r.name, 330), colRight, yR)
      ctx.fillStyle = AMBER
      ctx.textAlign = 'right'
      ctx.fillText(`×${r.value}`, RIGHT, yR)
      ctx.textAlign = 'left'
    }
  }

  // ── 海报条 ──
  if (posterY > 0) {
    ctx.font = `600 24px ${FONT}`
    ctx.fillStyle = FG
    ctx.fillText('这一年看过的', MARGIN, posterY)
    const imgs = await Promise.all(posterFilms.map(f => loadImage(f.poster)))
    imgs.forEach((img, i) => {
      if (img) drawCoverImage(ctx, img, MARGIN + i * 110, posterY + 24, 96, 144, 8)
    })
  }

  // ── 底部 ──
  dashedHLine(ctx, MARGIN, footerLineY, RIGHT)
  drawBarcode(ctx, year, MARGIN, footerLineY + 24, 200, 40)
  ctx.font = `500 18px ${FONT}`
  ctx.fillStyle = MUTED
  ctx.fillText(`NO.${year}`, MARGIN + 220, footerLineY + 52)
  ctx.textAlign = 'right'
  ctx.fillText('beetya.ng/movie · 每一次影院之旅', RIGHT, footerLineY + 52)
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}
