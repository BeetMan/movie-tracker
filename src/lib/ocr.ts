import type { MovieDraft } from '@/types/movie'

export const OCR_MODE_STORAGE = 'movie-db-ocr-mode'
export type OcrMode = 'ai' | 'local'

export function getOcrMode(): OcrMode {
  return (localStorage.getItem(OCR_MODE_STORAGE) as OcrMode) || 'ai'
}

interface OcrLine {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

interface OcrBlock {
  paragraphs?: { lines?: { text: string; bbox: OcrLine['bbox'] }[] }[]
}

/**
 * OCR 资源的绝对根路径（以 / 结尾）。
 * CF 构建 base='/movie/' 时必须是绝对路径：worker 线程里的相对 URL
 * 会按 worker 脚本位置解析，用 './' 会错；根部署（'./'）直接用 '/'。
 */
const ASSET_ROOT = import.meta.env.BASE_URL.startsWith('/')
  ? `${location.origin}${import.meta.env.BASE_URL}`
  : '/'

const OCR_TIMEOUT = 180_000

/** 本地 OCR：在浏览器内识别图片文字，再按票面规则解析字段 */
export async function ocrExtract(
  dataUrl: string,
  onProgress?: (pct: number) => void
): Promise<Partial<MovieDraft>> {
  const { createWorker } = await import('tesseract.js')
  // worker 脚本 / WASM 核心 / 语言包全部自托管（public/tess、public/tessdata），不依赖 CDN
  const worker = await withTimeout(
    createWorker(['chi_sim', 'eng'], 1, {
      workerPath: `${ASSET_ROOT}tess/worker.min.js`,
      corePath: `${ASSET_ROOT}tess/core`,
      langPath: `${ASSET_ROOT}tessdata`,
      gzip: false,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text' && onProgress) onProgress(Math.round(m.progress * 100))
      },
    }),
    'OCR 引擎加载超时（首次需下载约 15MB 模型），请检查网络后重试'
  )
  try {
    const { data } = await withTimeout(
      worker.recognize(dataUrl, {}, { text: true, blocks: true } as never),
      '识别超时，请换一张更小的截图重试'
    )
    const lines: OcrLine[] = ((data.blocks ?? []) as OcrBlock[])
      .flatMap(b => b.paragraphs ?? [])
      .flatMap(p => p.lines ?? [])
      .map(l => ({ text: l.text.trim(), bbox: l.bbox }))
      .filter(l => l.text.length > 0)
    return parseTicketText(data.text, lines)
  } finally {
    await worker.terminate()
  }
}

function withTimeout<T>(p: Promise<T>, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(msg)), OCR_TIMEOUT)),
  ])
}

const APP_NOISE = /淘票票|猫眼|取票|订单|票根|二维码|验票|购票|影评|想看|看过|小程序|凭此|检票|入场|副券/

export function parseTicketText(fullText: string, lines: OcrLine[]): Partial<MovieDraft> {
  const text = fullText
    .replace(/\(/g, '（')
    .replace(/\)/g, '）')
    .replace(/[ \t]+/g, ' ')

  // 日期：2026年8月15日 / 2026-08-15 / 2026.08.15
  let date = ''
  const dm = /(20\d{2})\s*[年.\-/]\s*(\d{1,2})\s*[月.\-/]\s*(\d{1,2})/.exec(text)
  if (dm) date = `${dm[1]}.${parseInt(dm[2], 10)}.${parseInt(dm[3], 10)}`

  // 座位：5排13座（多张合并）
  const seats: string[] = []
  for (const sm of text.matchAll(/(\d{1,2})\s*排\s*(\d{1,2})\s*座/g)) {
    const s = `${sm[1]}排${sm[2]}座`
    if (!seats.includes(s)) seats.push(s)
  }
  // 香港票常见：C7、E11 等独立座位号
  if (seats.length === 0) {
    for (const sm of text.matchAll(/座位[:：]?\s*([A-Z]\d{1,2}(?:\s+[A-Z]\d{1,2})*)/)) {
      seats.push(sm[1])
    }
  }

  // 票价：优先「实付/总价/金额 ¥xx」，其次任意 ¥xx / HK$xx / xx元
  let price: number | null = null
  const SYM = '[¥￥]|HK\\$|US\\$|NT\\$|MOP\\$?'
  const pm =
    new RegExp(`(?:实付|总价|合计|金额|应付|票价)[^0-9]{0,8}(?:${SYM})?\\s*(\\d+(?:\\.\\d{1,2})?)`, 'i').exec(text) ||
    new RegExp(`(?:${SYM})\\s*(\\d+(?:\\.\\d{1,2})?)`, 'i').exec(text) ||
    /(\d+(?:\.\d{1,2})?)\s*元/.exec(text)
  if (pm) {
    const v = parseFloat(pm[1])
    if (v > 0 && v < 20000) price = v
  }

  // 币种：默认人民币，票面出现外币标识时切换
  let currency = 'CNY'
  if (/HK\$|HKD|港币|港幣/i.test(text)) currency = 'HKD'
  else if (/MOP|澳门币|澳門幣/i.test(text)) currency = 'MOP'
  else if (/NT\$|TWD|新台币|新台幣/i.test(text)) currency = 'TWD'
  else if (/US\$|USD|美元/i.test(text)) currency = 'USD'

  // 影院：含 影城/影院/戏院 的最长片段，尽量带上（分店名）
  let cinema = ''
  for (const l of lines) {
    const lt = l.text.replace(/\(/g, '（').replace(/\)/g, '）').replace(/\s/g, '')
    if (!/影城|影院|戏院|戲院|电影城|电影中心/.test(lt)) continue
    const m = /([^\s，,、]{2,30}(?:影城|影院|戏院|戲院|电影城|电影中心)(?:（[^）]{2,25}）)?)/.exec(lt)
    if (m && m[1].length > cinema.length) cinema = m[1]
  }

  // 影厅：x号厅 / IMAX厅 / 杜比影院厅 / House 3
  let hall = ''
  const hm = /((?:\d{1,2}号)?[A-Za-z\u4e00-\u9fa5+·]{0,12}?(?:激光|巨幕|杜比|全景声|IMAX|CINITY|LED|DTS)?厅)/.exec(text)
  if (hm && !/影城|影院/.test(hm[1])) hall = hm[1]
  if (!hall) {
    const house = /House\s*\d+/i.exec(text)
    if (house) hall = house[0]
  }

  // 格式与特效厅
  const has3D = /\b3D\b/i.test(text)
  const dim = has3D ? '3D' : '2D'
  let format = dim
  let special: string | null = null
  if (/杜比影院|杜比视界/.test(text)) {
    // 「杜比影院」是旧标注，格式统一记为新标注「杜比视界」
    format = `杜比视界 ${dim}`
    special = /杜比视界/.test(text) ? '杜比视界·全景声厅' : '杜比影院'
  } else if (/CINITY\s*LED/i.test(text)) {
    format = `CINITY LED ${dim}`
    special = 'CINITY LED'
  } else if (/CINITY/i.test(text)) {
    format = `CINITY ${dim}`
    special = 'CINITY'
  } else if (/中国巨幕|CGS/i.test(text)) {
    format = `中国巨幕 CGS ${dim}`
    special = '中国巨幕 CGS'
  } else if (/MX4D/i.test(text)) {
    format = `MX4D ${dim}`
    special = 'MX4D'
  } else if (/4DX/i.test(text)) {
    format = `4DX ${dim}`
    special = '4DX'
  } else if (/LUXE/i.test(text)) {
    format = dim // LUXE 无特殊拷贝格式，仅作特效厅标注
    special = 'LUXE 巨幕'
  } else if (/ScreenX/i.test(text)) {
    format = 'ScreenX'
    special = 'ScreenX'
  } else if (/Onyx/i.test(text)) {
    format = dim
    special = 'Onyx LED'
  } else if (/IMAX/i.test(text)) {
    format = `IMAX ${dim}`
    special = null // 氙灯/激光型号无法从票面判断，留给用户确认
  }

  // 备注关键词
  const notes: string[] = []
  for (const kw of ['点映', '路演', '观影团', '国语', '配音', '首映', '零点场', '包场']) {
    if (text.includes(kw)) notes.push(kw)
  }

  // 片名：画面上半部分字高最大、且不含噪声词的整行
  const title = guessTitle(lines)

  return {
    title,
    date,
    format,
    cinema,
    hall,
    seat: seats.join(' '),
    price,
    currency,
    note: notes.length ? notes.join(' ') : null,
    special,
  }
}

function guessTitle(lines: OcrLine[]): string {
  if (lines.length === 0) return ''
  const maxY = Math.max(...lines.map(l => l.bbox.y1), 1)
  const heights = lines.map(l => l.bbox.y1 - l.bbox.y0).sort((a, b) => a - b)
  const median = heights[Math.floor(heights.length / 2)] || 1
  let best: { text: string; score: number } | null = null
  for (const l of lines) {
    const h = l.bbox.y1 - l.bbox.y0
    const t = l.text.replace(/\s/g, '')
    if (t.length < 2 || t.length > 30) continue
    if (l.bbox.y0 > maxY * 0.5) continue // 只看上半部分
    if (APP_NOISE.test(t)) continue
    if (/影城|影院|戏院|戲院|排|座|¥|￥|\d{4}\s*[年.\-/]/.test(t)) continue
    if (h < median * 1.1) continue // 片名通常是大字
    const score = h - l.bbox.y0 * 0.02 // 字越大、越靠上越可能是片名
    if (!best || score > best.score) best = { text: t, score }
  }
  return best?.text ?? ''
}
