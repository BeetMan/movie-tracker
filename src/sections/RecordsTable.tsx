import { useMemo, useState } from 'react'
import { ArrowUpDown, Pencil, Search, Trash2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { MovieRecord } from '@/types/movie'
import { formatCategory, brandColor, formatPrice } from '@/types/movie'

const PAGE_SIZE = 15

type SortKey = 'date' | 'price' | 'title'

interface Props {
  records: MovieRecord[]
  onEdit: (r: MovieRecord) => void
  onDelete: (r: MovieRecord) => void
  onDeleteMany: (list: MovieRecord[]) => void
  onSetRegion: (ids: number[], region: string) => void
}

export default function RecordsTable({ records, onEdit, onDelete, onDeleteMany, onSetRegion }: Props) {
  const [q, setQ] = useState('')
  const [year, setYear] = useState('all')
  const [region, setRegion] = useState('all')
  const [cat, setCat] = useState('all')
  const [cinema, setCinema] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDesc, setSortDesc] = useState(true)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [regionInput, setRegionInput] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  const years = useMemo(() => [...new Set(records.map(r => r.year))].sort((a, b) => b - a), [records])
  const regions = useMemo(() => {
    const count = new Map<string, number>()
    for (const r of records) {
      if (r.region) count.set(r.region, (count.get(r.region) ?? 0) + 1)
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  }, [records])
  const cats = useMemo(() => [...new Set(records.map(r => formatCategory(r)))].sort(), [records])
  const cinemas = useMemo(
    () => [...new Set(
      records.filter(r => region === 'all' || r.region === region).map(r => r.cinema).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'zh')),
    [records, region]
  )

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    let list = records.filter(r => {
      if (year !== 'all' && r.year !== Number(year)) return false
      if (region !== 'all' && r.region !== region) return false
      if (cat !== 'all' && formatCategory(r) !== cat) return false
      if (cinema !== 'all' && r.cinema !== cinema) return false
      if (kw) {
        const hay = `${r.title} ${r.cinema} ${r.hall} ${r.note ?? ''} ${r.format} ${r.region}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      let c = 0
      if (sortKey === 'date') c = a.date.localeCompare(b.date)
      else if (sortKey === 'price') c = (a.price ?? -1) - (b.price ?? -1)
      else c = a.title.localeCompare(b.title, 'zh')
      return sortDesc ? -c : c
    })
    return list
  }, [records, q, year, region, cat, cinema, sortKey, sortDesc])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const cur = Math.min(page, pages)
  const slice = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)

  // 剔除已不存在的 id（例如撤销恢复、外部导入后选择集过期）
  const validSelected = useMemo(() => {
    const ids = new Set(records.map(r => r.id))
    return new Set([...selected].filter(id => ids.has(id)))
  }, [selected, records])
  const selectedRecords = useMemo(() => records.filter(r => validSelected.has(r.id)), [records, validSelected])
  const pageAllChecked = slice.length > 0 && slice.every(r => validSelected.has(r.id))

  const toggleOne = (id: number, on: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }
  const togglePage = (on: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      for (const r of slice) {
        if (on) next.add(r.id)
        else next.delete(r.id)
      }
      return next
    })
  }
  const applyRegion = () => {
    const region = regionInput.trim()
    if (!region) return
    onSetRegion([...validSelected], region)
    setRegionInput('')
  }
  const confirmBatchDelete = () => {
    onDeleteMany(selectedRecords)
    setSelected(new Set())
    setConfirmDel(false)
  }

  const hasFilter = q || year !== 'all' || region !== 'all' || cat !== 'all' || cinema !== 'all'
  const clearFilters = () => { setQ(''); setYear('all'); setRegion('all'); setCat('all'); setCinema('all'); setPage(1) }

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDesc(d => !d)
    else { setSortKey(k); setSortDesc(true) }
  }

  const selectCls = 'border-input bg-card text-foreground'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1) }}
            placeholder="搜索片名 / 影院 / 备注…"
            className="border-input bg-card pl-9 text-foreground placeholder:text-muted-foreground/60"
          />
        </div>
        <Select value={year} onValueChange={v => { setYear(v); setPage(1) }}>
          <SelectTrigger className={`w-28 ${selectCls}`}><SelectValue placeholder="年份" /></SelectTrigger>
          <SelectContent className="border-input bg-popover text-popover-foreground">
            <SelectItem value="all">全部年份</SelectItem>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y} 年</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={region} onValueChange={v => { setRegion(v); setCinema('all'); setPage(1) }}>
          <SelectTrigger className={`w-28 ${selectCls}`}><SelectValue placeholder="地区" /></SelectTrigger>
          <SelectContent className="border-input bg-popover text-popover-foreground">
            <SelectItem value="all">全部地区</SelectItem>
            {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cat} onValueChange={v => { setCat(v); setPage(1) }}>
          <SelectTrigger className={`w-36 ${selectCls}`}><SelectValue placeholder="制式" /></SelectTrigger>
          <SelectContent className="border-input bg-popover text-popover-foreground">
            <SelectItem value="all">全部制式</SelectItem>
            {cats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cinema} onValueChange={v => { setCinema(v); setPage(1) }}>
          <SelectTrigger className={`w-56 ${selectCls}`}><SelectValue placeholder="影院" /></SelectTrigger>
          <SelectContent className="max-h-72 border-input bg-popover text-popover-foreground">
            <SelectItem value="all">全部影院</SelectItem>
            {cinemas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" />清除筛选
          </Button>
        )}
      </div>

      {validSelected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-400/10 px-3 py-2 text-sm">
          <span className="font-medium text-foreground">已选 {validSelected.size} 场</span>
          <div className="flex items-center gap-1.5">
            <Input
              list="batch-region-options"
              value={regionInput}
              onChange={e => setRegionInput(e.target.value)}
              placeholder="改为地区…"
              className="h-8 w-36 border-input bg-card text-foreground placeholder:text-muted-foreground/60"
              onKeyDown={e => e.key === 'Enter' && applyRegion()}
            />
            <datalist id="batch-region-options">
              {regions.map(r => <option key={r} value={r} />)}
            </datalist>
            <Button size="sm" variant="outline" disabled={!regionInput.trim()} onClick={applyRegion}
              className="border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40">
              应用
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setConfirmDel(true)}
            className="border-rose-500/40 bg-transparent text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 dark:text-rose-400 dark:hover:text-rose-400">
            <Trash2 className="mr-1 h-3.5 w-3.5" />批量删除
          </Button>
          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>
            <X className="mr-1 h-3.5 w-3.5" />取消选择
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left text-xs text-muted-foreground">
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  checked={pageAllChecked}
                  onCheckedChange={v => togglePage(!!v)}
                  aria-label="选择本页"
                  className="border-input data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500 data-[state=checked]:text-stone-950"
                />
              </th>
              <Th label="影片" k="title" sortKey={sortKey} desc={sortDesc} onSort={toggleSort} className="px-3 py-2.5" />
              <Th label="日期" k="date" sortKey={sortKey} desc={sortDesc} onSort={toggleSort} className="px-3 py-2.5" />
              <th className="px-3 py-2.5 font-medium">制式</th>
              <th className="px-3 py-2.5 font-medium">影院</th>
              <th className="px-3 py-2.5 font-medium">影厅 / 座位</th>
              <Th label="票价" k="price" sortKey={sortKey} desc={sortDesc} onSort={toggleSort} className="px-3 py-2.5 text-right" />
              <th className="px-3 py-2.5 font-medium">备注</th>
              <th className="w-20 px-3 py-2.5 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {slice.map(r => (
              <tr key={r.id} className={`border-b border-border/60 text-muted-foreground transition-colors hover:bg-muted/40 ${validSelected.has(r.id) ? 'bg-amber-400/5' : ''}`}>
                <td className="px-3 py-2.5">
                  <Checkbox
                    checked={validSelected.has(r.id)}
                    onCheckedChange={v => toggleOne(r.id, !!v)}
                    aria-label={`选择《${r.title}》`}
                    className="border-input data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500 data-[state=checked]:text-stone-950"
                  />
                </td>
                <td className="max-w-56 px-3 py-2.5">
                  <div className="truncate font-medium text-foreground" title={r.title}>{r.title}</div>
                  {r.special && <Badge variant="outline" className="mt-0.5 border-amber-500/40 text-[10px] text-amber-600 dark:text-amber-400">{r.special}</Badge>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground">{r.date}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {(() => {
                    const catName = formatCategory(r)
                    const c = brandColor(catName)
                    return (
                      <Badge variant="outline" className="text-xs" style={{ borderColor: `${c}66`, color: c }}>
                        {catName}
                      </Badge>
                    )
                  })()}
                </td>
                <td className="max-w-52 px-3 py-2.5">
                  <div className="truncate" title={r.cinema}>{r.cinema || '—'}</div>
                  <div className="text-[10px] text-muted-foreground/70">{r.region}</div>
                </td>
                <td className="max-w-44 px-3 py-2.5 text-muted-foreground">
                  <div className="truncate" title={`${r.hall} ${r.seat}`}>{r.hall || '—'}{r.seat ? ` · ${r.seat}` : ''}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                  {r.price !== null ? formatPrice(r.price, r.currency) : <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className="max-w-32 px-3 py-2.5">
                  <div className="truncate text-muted-foreground" title={r.note ?? ''}>{r.note || ''}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button onClick={() => onEdit(r)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-amber-600 dark:hover:text-amber-400" title="编辑">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => onDelete(r)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-rose-500 dark:hover:text-rose-400" title="删除">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {slice.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">没有匹配的记录</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          共 {filtered.length} 场{hasFilter ? `（全部 ${records.length} 场中筛选）` : ''}
          {(() => {
            const byCur = new Map<string, number>()
            for (const r of filtered) {
              if (r.price === null) continue
              const c = r.currency || 'CNY'
              byCur.set(c, (byCur.get(c) ?? 0) + r.price)
            }
            if (byCur.size === 0) return ''
            const parts = [...byCur.entries()].map(([c, v]) => formatPrice(v, c))
            return `，合计 ${parts.join(' · ')}`
          })()}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={cur <= 1} onClick={() => setPage(cur - 1)}
            className="border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40">上一页</Button>
          <span className="tabular-nums">{cur} / {pages}</span>
          <Button variant="outline" size="sm" disabled={cur >= pages} onClick={() => setPage(cur + 1)}
            className="border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40">下一页</Button>
        </div>
      </div>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent className="border-border bg-background text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>批量删除 {validSelected.size} 条记录？</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              将删除选中的 {validSelected.size} 场观影记录。删除后可在提示中点击「撤销」恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground">取消</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-500" onClick={confirmBatchDelete}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Th({ label, k, sortKey, desc, onSort, className }: {
  label: string; k: SortKey; sortKey: SortKey; desc: boolean; onSort: (k: SortKey) => void; className?: string
}) {
  return (
    <th className={className}>
      <button onClick={() => onSort(k)} className="flex items-center gap-1 font-medium hover:text-foreground">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === k ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground/50'}`} />
        {sortKey === k && <span className="text-[10px] text-amber-500 dark:text-amber-400">{desc ? '↓' : '↑'}</span>}
      </button>
    </th>
  )
}
