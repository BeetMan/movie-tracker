/** 分享卡片共用的 canvas 绘制工具与视觉常量（票根卡片 / 年度报告） */

export const AMBER = '#f59e0b'
export const BG = '#1c1917'
export const FG = '#fafaf9'
export const MUTED = '#a8a29e'
export const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif'

export function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

export function dashedVLine(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number) {
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

export function dashedHLine(ctx: CanvasRenderingContext2D, x0: number, y: number, x1: number) {
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

export function ellipsis(ctx: CanvasRenderingContext2D, s: string, maxW: number): string {
  if (ctx.measureText(s).width <= maxW) return s
  let t = s
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

/** 角标：描边圆角小胶囊，返回右缘 x */
export function pill(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string): number {
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

/** 由种子生成伪随机条码（视觉装饰，不可扫） */
export function drawBarcode(ctx: CanvasRenderingContext2D, seed: number, x: number, y: number, w: number, h: number) {
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

export function drawLetterSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  let cx = x
  for (const ch of text) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + spacing
  }
}

export function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // image.tmdb.org 带 CORS 头，不会污染 canvas
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** cover 模式绘制图片到圆角矩形区域 */
export function drawCoverImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number) {
  ctx.save()
  roundedRect(ctx, x, y, w, h, r)
  ctx.clip()
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  ctx.restore()
}
