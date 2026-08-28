import type { MovieDraft } from '@/types/movie'
import { CURRENCIES, FORMAT_OPTIONS, SPECIAL_HALL_OPTIONS } from '@/types/movie'

export const API_KEY_STORAGE = 'movie-db-apikey'
export const MODEL_STORAGE = 'movie-db-model'
export const DEFAULT_MODEL = 'kimi-latest'

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) ?? ''
}

export function getModel(): string {
  return localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL
}

/** 读取图片文件并压缩为 JPEG dataURL（最长边 1600px） */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas 不可用'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片读取失败')) }
    img.src = url
  })
}

const PROMPT = `这是一张电影取票/购票页面的截图（可能来自淘票票、猫眼、影院小程序或取票机照片）。请提取观影信息，严格只输出 JSON，不要输出任何其他文字：

{
  "title": "影片名（字符串）",
  "date": "放映日期，格式 YYYY.M.D，如 2026.3.15（字符串）",
  "format": "影片拷贝版本，优先从这些值中选：${FORMAT_OPTIONS.join('、')}（字符串）",
  "cinema": "影院全称，含分店名（字符串）",
  "hall": "影厅名称（字符串）",
  "seat": "座位，如 5排13座；多张票用空格分隔（字符串）",
  "price": "实际支付总价的数字，不含货币符号；截图中只有积分/通兑/兑换码而无金额时填 null",
  "currency": "price 的币种代码，从 ${CURRENCIES.join('、')} 中选；人民币填 CNY，港币填 HKD，以此类推；无法确定填 CNY",
  "note": "有价值的信息：点映、路演、观影团、国语配音等，没有则填 null",
  "special": "特效厅标注，仅当影厅为特效厅时填写，优先从这些值中选：${SPECIAL_HALL_OPTIONS.join('、')}；普通厅填 null"
}

注意：
- date 是放映日期，不是购票日期；只有月日没有年份时，结合截图中的购票时间或当前年份推断
- format 注意区分新旧标注：票面写「杜比影院」也按新标注填「杜比视界 2D / 杜比视界 3D」
- 无法确定的字段：字符串填 ""，price/note/special 填 null`

/** 调用 Kimi 视觉模型，从截图提取观影信息 */
export async function extractFromImage(dataUrl: string): Promise<Partial<MovieDraft>> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('NO_API_KEY')

  const res = await fetch('https://api.moonshot.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getModel(),
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  })

  if (res.status === 401) throw new Error('API Key 无效，请检查设置')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`识别请求失败（${res.status}）${text.slice(0, 120)}`)
  }

  const data = await res.json()
  const content: string = data?.choices?.[0]?.message?.content ?? ''
  return parseExtraction(content)
}

function parseExtraction(content: string): Partial<MovieDraft> {
  const cleaned = content.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('模型未返回有效结果，请换一张更清晰的截图')
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    throw new Error('结果解析失败，请重试')
  }
  const str = (k: string) => (typeof obj[k] === 'string' ? (obj[k] as string).trim() : '')
  const price = typeof obj.price === 'number' && Number.isFinite(obj.price) ? obj.price : null
  const cur = str('currency').toUpperCase()
  return {
    title: str('title'),
    date: str('date'),
    format: str('format') || '2D',
    cinema: str('cinema'),
    hall: str('hall'),
    seat: str('seat'),
    price,
    currency: (CURRENCIES as readonly string[]).includes(cur) ? cur : 'CNY',
    note: str('note') || null,
    special: str('special') || null,
  }
}
