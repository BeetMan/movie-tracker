import type { MovieDraft } from '@/types/movie'
import { CURRENCIES, FORMAT_OPTIONS, SPECIAL_HALL_OPTIONS } from '@/types/movie'

export interface VisionProvider {
  id: string
  name: string
  /** OpenAI 兼容接口的 base（不含 /chat/completions） */
  baseUrl: string
  /** 控制台地址（设置页提示用） */
  consoleUrl: string
  keyStorage: string
  modelStorage: string
  defaultModel: string
  /** 设置页模型联想（需支持视觉） */
  models: string[]
}

export const PROVIDER_STORAGE = 'movie-db-vision-provider'

export const PROVIDERS: VisionProvider[] = [
  {
    id: 'moonshot',
    name: 'Moonshot（Kimi）',
    baseUrl: 'https://api.moonshot.cn/v1',
    consoleUrl: 'platform.moonshot.cn',
    keyStorage: 'movie-db-apikey',   // 沿用旧 Key，老用户无感迁移
    modelStorage: 'movie-db-model',
    // kimi-latest 已下线（404），默认用长期可用的视觉预览模型
    defaultModel: 'moonshot-v1-128k-vision-preview',
    models: [
      'moonshot-v1-128k-vision-preview',
      'moonshot-v1-32k-vision-preview',
      'moonshot-v1-8k-vision-preview',
      'kimi-k3',
      'kimi-k2.7-code',
      'kimi-thinking-preview',
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    consoleUrl: 'platform.deepseek.com',
    keyStorage: 'movie-db-deepseek-key',
    modelStorage: 'movie-db-deepseek-model',
    defaultModel: 'deepseek-v4-flash-vision-exp',
    models: ['deepseek-v4-flash-vision-exp'],
  },
]

export function getProvider(): VisionProvider {
  const id = localStorage.getItem(PROVIDER_STORAGE)
  return PROVIDERS.find(p => p.id === id) ?? PROVIDERS[0]
}

export function getApiKey(p: VisionProvider = getProvider()): string {
  return localStorage.getItem(p.keyStorage) ?? ''
}

export function getModel(p: VisionProvider = getProvider()): string {
  return localStorage.getItem(p.modelStorage) || p.defaultModel
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
  "date": "放映日期，格式 YYYY.MM.DD（月日不足两位补零），如 2026.03.15（字符串）",
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
  const provider = getProvider()
  const apiKey = getApiKey(provider)
  if (!apiKey) throw new Error('NO_API_KEY')

  // 部分新模型（K2.7 Code / K3 / thinking 系）锁死 temperature=1，
  // 先用 0.1 请求，若服务端明确报 temperature 不支持则自动用 1 重试
  let res = await send(provider, apiKey, dataUrl, 0.1)
  if (res.status === 400) {
    const text = await res.clone().text().catch(() => '')
    if (/temperature/i.test(text)) res = await send(provider, apiKey, dataUrl, 1)
    else return throwHttpError(res.status, text)
  }

  if (res.status === 401) throw new Error(`${provider.name} API Key 无效，请检查设置`)
  if (res.status === 404) {
    throw new Error(`模型「${getModel(provider)}」不存在或当前 Key 无权限，请到设置中更换模型（如 ${provider.defaultModel}）`, { cause: 'MODEL_NOT_FOUND' })
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`识别请求失败（${res.status}）${text.slice(0, 120)}`)
  }

  const data = await res.json()
  const content: string = data?.choices?.[0]?.message?.content ?? ''
  return parseExtraction(content)
}

function throwHttpError(status: number, text: string): never {
  throw new Error(`识别请求失败（${status}）${text.slice(0, 120)}`)
}

function send(provider: VisionProvider, apiKey: string, dataUrl: string, temperature: number) {
  return fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getModel(provider),
      temperature,
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
