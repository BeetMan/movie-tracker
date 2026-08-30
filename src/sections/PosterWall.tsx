import { useEffect, useMemo, useRef, useState } from 'react'
import { Film, ImageOff, Loader2, RefreshCw, Search, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { MovieRecord } from '@/types/movie'
import {
  cacheKey, getTmdbKey, loadPosterCache, savePosterCache,
  pickBest, posterUrl, searchMovie,
  type PosterCache, type PosterMatch,
} from '@/lib/tmdb'

interface FilmEntry {
  title: string
  /** 首次观看年份（用作 TMDB 搜索的年份提示） */
  year: number
  count: number
  firstDate: string
}

interface Props {
  records: MovieRecord[]
  onNeedSettings: () => void
}

const CONCURRENCY = 3

export default function PosterWall({ records, onNeedSettings }: Props) {
  const [year, setYear] = useState('all')
  const [cache, setCache] = useState<PosterCache>(loadPosterCache)
  const [fetching, setFetching] = useState(false)
  const [rematch, setRematch] = useState<FilmEntry | null>(null)
  const cacheRef = useRef(cache)
  const key = getTmdbKey()

  const updateCache = (keyStr: string, match: PosterMatch | null) => {
    setCache(prev => {
      const next = { ...prev, [keyStr]: match }
      cacheRef.current = next
      savePosterCache(next)
      return next
    })
  }

  // 按片名去重：一部影片一张海报
  const films = useMemo(() => {
    const m = new Map<string, FilmEntry>()
    for (const r of records) {
      const e = m.get(r.title)
      if (!e) {
        m.set(r.title, { title: r.title, year: r.year, count: 1, firstDate: r.date })
      } else {
        e.count += 1
        if (r.year < e.year) e.year = r.year
        if (r.date < e.firstDate) e.firstDate = r.date
      }
    }
    return [...m.values()].sort((a, b) => b.firstDate.localeCompare(a.firstDate))
  }, [records])

  const years = useMemo(() => [...new Set(records.map(r => r.year))].sort((a, b) => b - a), [records])
  const shown = useMemo(
    () => (year === 'all' ? films : films.filter(f => records.some(r => r.title === f.title && r.year === Number(year)))),
    [films, year, records]
  )

  // 自动匹配缺失的海报（并发 3，失败不写缓存以便下次重试）
  useEffect(() => {
    if (!key) return
    const missing = shown.filter(f => !(cacheKey(f.title, f.year) in cacheRef.current))
    if (missing.length === 0) return
    let cancelled = false
    ;(async () => {
      setFetching(true)
      for (let i = 0; i < missing.length && !cancelled; i += CONCURRENCY) {
        const batch = missing.slice(i, i + CONCURRENCY)
        const results = await Promise.all(
          batch.map(f =>
            searchMovie(f.title, f.year, key)
              .then(cands => ({ k: cacheKey(f.title, f.year), match: pickBest(cands) }))
              .catch(e => {
                if (e instanceof Error && e.message === 'TMDB_KEY_INVALID') throw e
                return null // 网络等错误不缓存，下次进页面重试
              })
          )
        )
        if (cancelled) return
        setCache(prev => {
          const next = { ...prev }
          for (const r of results) if (r) next[r.k] = r.match
          cacheRef.current = next
          savePosterCache(next)
          return next
        })
      }
      if (!cancelled) setFetching(false)
    })().catch(e => {
      if (!cancelled) {
        setFetching(false)
        if (e instanceof Error && e.message === 'TMDB_KEY_INVALID') {
          toast.error('TMDB API Key 无效，请在设置中检查', { duration: 5000 })
        }
      }
    })
    return () => { cancelled = true }
  }, [key, shown])

  if (!key) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
        <Film className="h-8 w-8 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">
          海报墙通过 TMDB 匹配影片海报，需要一个免费的 API Key。
          <br />在 themoviedb.org 注册 → 设置 → API → 申请 Developer Key，约 1 分钟即可获得。
        </p>
        <Button className="bg-amber-500 text-stone-950 hover:bg-amber-400" onClick={onNeedSettings}>
          <Settings className="mr-1.5 h-4 w-4" />去设置里填 Key
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {shown.length} 部影片的海报
          {fetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500 dark:text-amber-400" />}
          {fetching && <span className="text-xs">正在匹配海报…</span>}
        </h2>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32 border-input bg-card text-foreground">
            <SelectValue placeholder="年份" />
          </SelectTrigger>
          <SelectContent className="border-input bg-popover text-popover-foreground">
            <SelectItem value="all">全部年份</SelectItem>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y} 年</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {shown.map(f => (
          <PosterCell
            key={f.title}
            film={f}
            match={cache[cacheKey(f.title, f.year)]}
            onClick={() => setRematch(f)}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground/70">
        点错配的影片可手动换海报；海报数据来自 TMDB，匹配结果缓存在本地浏览器。
      </p>

      <RematchDialog
        film={rematch}
        apiKey={key}
        onClose={() => setRematch(null)}
        onPick={match => {
          if (rematch) updateCache(cacheKey(rematch.title, rematch.year), match)
          setRematch(null)
        }}
      />
    </div>
  )
}

function PosterCell({ film, match, onClick }: { film: FilmEntry; match: PosterMatch | null | undefined; onClick: () => void }) {
  const url = match ? posterUrl(match.poster) : null
  return (
    <button
      onClick={onClick}
      title={`${film.title} · 首次观看 ${film.firstDate}\n点击重新匹配海报`}
      className="group relative aspect-[2/3] overflow-hidden rounded-lg border border-border bg-muted/60 text-left transition-transform hover:scale-[1.03] hover:border-amber-500/50"
    >
      {url ? (
        <img src={url} alt={film.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
          {match === undefined
            ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
            : <ImageOff className="h-5 w-5 text-muted-foreground/60" />}
          <span className="line-clamp-3 text-xs font-medium text-muted-foreground">{film.title}</span>
        </div>
      )}
      {match === null && (
        <span className="absolute left-1.5 top-1.5 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">未匹配</span>
      )}
      {film.count > 1 && (
        <Badge className="absolute right-1.5 top-1.5 border-0 bg-amber-500 px-1.5 py-0 text-[10px] text-stone-950">{film.count} 刷</Badge>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-8">
        <div className="truncate text-[11px] font-medium text-white">{film.title}</div>
        <div className="text-[10px] tabular-nums text-white/70">{film.firstDate}</div>
      </div>
    </button>
  )
}

/** 手动换海报：可改搜索词与年份，从候选中挑一张 */
function RematchDialog({ film, apiKey, onClose, onPick }: {
  film: FilmEntry | null
  apiKey: string
  onClose: () => void
  onPick: (match: PosterMatch | null) => void
}) {
  const [q, setQ] = useState('')
  const [y, setY] = useState('')
  const [results, setResults] = useState<PosterMatch[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchedFor, setSearchedFor] = useState<number | null>(null)

  useEffect(() => {
    if (film) {
      setQ(film.title)
      setY(String(film.year))
      setResults(null)
      setSearchedFor(null)
    }
  }, [film])

  const doSearch = async () => {
    if (!q.trim()) return
    setSearching(true)
    try {
      const cands = await searchMovie(q.trim(), /^\d{4}$/.test(y.trim()) ? Number(y.trim()) : null, apiKey)
      setResults(cands)
      setSearchedFor(Date.now())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '搜索失败')
    } finally {
      setSearching(false)
    }
  }

  const inputCls = 'border-input bg-muted/40 text-foreground placeholder:text-muted-foreground/60'

  return (
    <Dialog open={!!film} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-background text-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>重新匹配《{film?.title}》的海报</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input className={`${inputCls} flex-1`} value={q} onChange={e => setQ(e.target.value)}
            placeholder="片名（可试试英文原名）" onKeyDown={e => e.key === 'Enter' && doSearch()} />
          <Input className={`${inputCls} w-24`} value={y} onChange={e => setY(e.target.value)} placeholder="年份" inputMode="numeric" />
          <Button className="bg-amber-500 text-stone-950 hover:bg-amber-400" disabled={searching} onClick={doSearch}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        {results && (
          results.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {results.map(r => {
                const url = posterUrl(r.poster, 'w185')
                return (
                  <button key={r.id} onClick={() => onPick(r)}
                    className="group relative aspect-[2/3] overflow-hidden rounded-md border border-border bg-muted/60 transition-transform hover:scale-[1.04] hover:border-amber-500/60">
                    {url
                      ? <img src={url} alt={r.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                      : <div className="absolute inset-0 flex items-center justify-center"><ImageOff className="h-4 w-4 text-muted-foreground/60" /></div>}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-5">
                      <div className="truncate text-[10px] font-medium text-white">{r.title}</div>
                      <div className="text-[9px] tabular-nums text-white/70">{r.year ?? '?'}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground" key={searchedFor}>
              没有搜索结果。试试缩短片名、改用英文原名，或清空年份。
            </p>
          )
        )}
        <div className="flex justify-between">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => onPick(null)}>
            清除匹配
          </Button>
          <Button variant="outline" className="border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground" onClick={onClose}>
            <RefreshCw className="mr-1.5 hidden h-3.5 w-3.5" />关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
