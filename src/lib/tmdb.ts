/**
 * TMDB 影片匹配：按片名+年份搜索海报，结果缓存进 localStorage。
 * Key 由用户自行申请（themoviedb.org 免费），仅存本地，浏览器直连 api.tmdb.org。
 */

export const TMDB_KEY_STORAGE = 'movie-db-tmdb-key'
const CACHE_STORAGE = 'movie-db-posters-v1'

export interface PosterMatch {
  id: number
  /** TMDB poster_path（/ 开头），null 表示该片无海报 */
  poster: string | null
  /** TMDB 上的片名（可能与本地记录略有出入） */
  title: string
  /** 上映年份 */
  year: number | null
}

/** key → 匹配结果；值为 null 表示「搜过但没搜到」（负缓存，避免重复请求） */
export type PosterCache = Record<string, PosterMatch | null>

export function cacheKey(title: string, year: number): string {
  return `${title}|${year}`
}

export function getTmdbKey(): string {
  return localStorage.getItem(TMDB_KEY_STORAGE) ?? ''
}

export function loadPosterCache(): PosterCache {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE)
    if (raw) return JSON.parse(raw) as PosterCache
  } catch {
    /* ignore */
  }
  return {}
}

export function savePosterCache(cache: PosterCache) {
  try {
    localStorage.setItem(CACHE_STORAGE, JSON.stringify(cache))
  } catch {
    /* 超出容量时放弃持久化，内存中的结果仍可用 */
  }
}

export function posterUrl(path: string | null, size: 'w185' | 'w342' | 'w500' = 'w342'): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null
}

interface TmdbResult {
  id: number
  title?: string
  poster_path?: string | null
  release_date?: string
}

/** 搜索候选（最多 8 条），用于自动匹配和手动换海报 */
export async function searchMovie(title: string, year: number | null, key: string): Promise<PosterMatch[]> {
  const url = new URL('https://api.tmdb.org/3/search/movie')
  url.searchParams.set('api_key', key)
  url.searchParams.set('query', title)
  if (year) url.searchParams.set('year', String(year))
  url.searchParams.set('language', 'zh-CN')
  const res = await fetch(url)
  if (res.status === 401) throw new Error('TMDB_KEY_INVALID')
  if (!res.ok) throw new Error(`TMDB 请求失败（HTTP ${res.status}）`)
  const data = (await res.json()) as { results?: TmdbResult[] }
  return (data.results ?? []).slice(0, 8).map(r => ({
    id: r.id,
    poster: r.poster_path ?? null,
    title: r.title ?? title,
    year: r.release_date ? parseInt(r.release_date.slice(0, 4), 10) : null,
  }))
}

/** 自动匹配策略：取第一条有海报的候选；都没有海报则取第一条 */
export function pickBest(candidates: PosterMatch[]): PosterMatch | null {
  if (candidates.length === 0) return null
  return candidates.find(c => c.poster) ?? candidates[0]
}
