/**
 * 设置备份：把识别方式、服务方、API Key、模型、主题、海报匹配缓存等
 * localStorage 设置项打包导出为 JSON，换设备/清浏览器后一键恢复。
 * 注意：导出文件包含 API Key 明文，请妥善保管。
 */
import { PROVIDERS, PROVIDER_STORAGE } from '@/lib/vision'
import { OCR_MODE_STORAGE } from '@/lib/ocr'
import { TMDB_KEY_STORAGE, POSTER_CACHE_STORAGE, savePosterCache, type PosterCache } from '@/lib/tmdb'
import { THEME_STORAGE } from '@/hooks/useTheme'
import { downloadFile, todayStamp } from '@/lib/download'

const SETTINGS_TYPE = 'movie-db-settings'

/** 允许导出/导入的白名单 key（观影记录本身走「导出 JSON」，不在这里） */
const SETTINGS_KEYS = [
  OCR_MODE_STORAGE,
  PROVIDER_STORAGE,
  TMDB_KEY_STORAGE,
  THEME_STORAGE,
  POSTER_CACHE_STORAGE,
  ...PROVIDERS.flatMap(p => [p.keyStorage, p.modelStorage]),
]

export function exportSettings() {
  const data: Record<string, string> = {}
  for (const k of SETTINGS_KEYS) {
    const v = localStorage.getItem(k)
    if (v !== null) data[k] = v
  }
  const payload = {
    _type: SETTINGS_TYPE,
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' })
  downloadFile(blob, `观影数据库_设置_${todayStamp()}.json`)
}

/** 导入设置备份，返回写入的设置项数量；格式不合法时抛错 */
export function importSettings(raw: string): number {
  const parsed = JSON.parse(raw) as { _type?: string; data?: unknown }
  if (parsed._type !== SETTINGS_TYPE || typeof parsed.data !== 'object' || parsed.data === null) {
    throw new Error('格式不正确')
  }
  let count = 0
  for (const [k, v] of Object.entries(parsed.data as Record<string, unknown>)) {
    if (!SETTINGS_KEYS.includes(k) || typeof v !== 'string') continue
    localStorage.setItem(k, v)
    count += 1
  }
  if (count === 0) throw new Error('文件里没有可导入的设置项')
  // 海报缓存有内存快照，需同步刷新让当前页面立刻生效
  const posters = localStorage.getItem(POSTER_CACHE_STORAGE)
  if (posters) {
    try { savePosterCache(JSON.parse(posters) as PosterCache) } catch { /* ignore */ }
  }
  return count
}
