import { lazy, Suspense, useRef, useState, useCallback, useEffect } from 'react'
import { ChevronDown, Clapperboard, Database, Loader2, Download, FileSpreadsheet, Info, Moon, Plus, RotateCcw, Settings, Sparkles, Sun, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Toaster, toast } from 'sonner'
import { useMovies, exportJson, exportCsv, LAST_EXPORT_KEY } from '@/hooks/useMovies'
import { useTheme } from '@/hooks/useTheme'

// 各区块按需加载：图表（recharts）、日历、识别等重依赖不进首屏主包
const StatsOverview = lazy(() => import('@/sections/StatsOverview'))
const RecordsTable = lazy(() => import('@/sections/RecordsTable'))
const PosterWall = lazy(() => import('@/sections/PosterWall'))
const MovieFormDialog = lazy(() => import('@/sections/MovieFormDialog'))
const SettingsDialog = lazy(() => import('@/sections/SettingsDialog'))

function SectionFallback() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-amber-500 dark:text-amber-400" />
    </div>
  )
}
import type { MovieRecord, MovieDraft } from '@/types/movie'
import { listRegions, normalizeDate } from '@/types/movie'
import { sanitizeRecords } from '@/lib/records'
import { version } from '../../package.json'

export default function Home() {
  const { records, addRecord, updateRecord, deleteRecord, restoreRecords, deleteMany, setRegionFor, importRecords, mergeRecords, resetToBase, isCustomized, suggestRegion, baseCount } = useMovies()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MovieRecord | null>(null)
  const [deleting, setDeleting] = useState<MovieRecord | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importList, setImportList] = useState<MovieRecord[] | null>(null)
  // 弹窗首次打开时才挂载（触发懒加载），之后保持挂载以保留关闭动画
  const [formMounted, setFormMounted] = useState(false)
  const [settingsMounted, setSettingsMounted] = useState(false)
  if (formOpen && !formMounted) setFormMounted(true)
  if (settingsOpen && !settingsMounted) setSettingsMounted(true)
  const [tab, setTab] = useState('overview')
  const { theme, toggle } = useTheme()
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [demoDismissed, setDemoDismissed] = useState(false)
  const [dataMenuOpen, setDataMenuOpen] = useState(false)
  const [lastExport, setLastExport] = useState<number>(() => Number(localStorage.getItem(LAST_EXPORT_KEY)) || 0)
  const backupOverdue = isCustomized && records.length > 0 && (lastExport === 0 || Date.now() - lastExport > 30 * 24 * 3600 * 1000)

  const handleExportJson = () => { exportJson(records); setLastExport(Date.now()) }
  const handleExportCsv = () => { exportCsv(records); setLastExport(Date.now()) }
  const fileRef = useRef<HTMLInputElement>(null)
  // 副标题摘要：场次 · 影片数 · 最早一场的年月
  const summary = (() => {
    if (records.length === 0) return '还没有记录，点「记一笔」添加第一场观影'
    const films = new Set(records.map(r => r.title)).size
    const first = records.map(r => normalizeDate(r.date)).filter(d => /^\d{4}\.\d{2}/.test(d)).sort()[0]
    return `${records.length} 场观影 · ${films} 部影片${first ? ` · 始于 ${first.slice(0, 7)}` : ''}`
  })()

  // 演示数据 → 清空开始自己的记录；撤销即恢复演示数据
  const clearDemo = () => {
    importRecords([])
    toast.success('已清空演示数据，点「记一笔」添加你的第一场', {
      action: { label: '撤销', onClick: resetToBase },
    })
  }
  const regionOptions = listRegions(records)
  const cinemaOptions = (() => {
    const count = new Map<string, number>()
    for (const r of records) {
      if (r.cinema && r.cinema !== '?' && r.cinema !== '？') count.set(r.cinema, (count.get(r.cinema) ?? 0) + 1)
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  })()
  // 影院 → 影厅频次表，用于表单里的影厅联想
  const suggestHalls = useCallback((cinema: string) => {
    const count = new Map<string, number>()
    for (const r of records) {
      if (r.cinema === cinema.trim() && r.hall) count.set(r.hall, (count.get(r.hall) ?? 0) + 1)
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  }, [records])

  // 重复检测：同片名 + 同日期，可能是误录（也可能是同天二刷，由用户在表单里确认）
  const findDuplicate = (draft: MovieDraft) =>
    records.find(r => r.title.trim() === draft.title && normalizeDate(r.date) === draft.date)

  const handleSubmit = (draft: MovieDraft) => {
    if (editing) {
      updateRecord(editing.id, draft)
      toast.success(`已更新《${draft.title}》`)
    } else {
      addRecord(draft)
      toast.success(`已添加《${draft.title}》`)
    }
    setEditing(null)
  }

  const handleDeleteMany = (list: MovieRecord[]) => {
    deleteMany(list.map(r => r.id))
    toast.success(`已删除 ${list.length} 条记录`, {
      action: { label: '撤销', onClick: () => restoreRecords(list) },
    })
  }

  const handleSetRegion = (ids: number[], region: string) => {
    setRegionFor(ids, region)
    toast.success(`已将 ${ids.length} 条记录的地区改为「${region}」`)
  }

  // 快捷键：N 记一笔，/ 聚焦搜索（输入框聚焦时或有弹窗时不生效）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (formOpen || settingsOpen || deleting || resetOpen) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setEditing(null)
        setFormOpen(true)
      } else if (e.key === '/') {
        e.preventDefault()
        setTab('records')
        requestAnimationFrame(() => document.getElementById('records-search')?.focus())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [formOpen, settingsOpen, deleting, resetOpen])

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const { records: list, dropped } = sanitizeRecords(JSON.parse(String(reader.result)))
        if (list.length === 0) throw new Error()
        if (dropped > 0) toast.warning(`文件中有 ${dropped} 条记录缺少片名或格式不对，已忽略`)
        setImportList(list)
      } catch {
        toast.error('导入失败：请使用本站导出的 JSON 文件')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const doMergeImport = () => {
    if (!importList) return
    const { added, skipped } = mergeRecords(importList)
    toast.success(
      added > 0
        ? `合并完成：新增 ${added} 条${skipped > 0 ? `，跳过重复 ${skipped} 条` : ''}`
        : `没有新记录，${skipped} 条全部重复`
    )
    setImportList(null)
  }

  const doReplaceImport = () => {
    if (!importList) return
    importRecords(importList)
    toast.success(`已整体替换为文件中的 ${importList.length} 条记录`)
    setImportList(null)
  }

  const btnCls = 'border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-amber-400/10 p-2.5">
                <Clapperboard className="h-7 w-7 text-amber-500 dark:text-amber-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">观影数据库</h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {summary}
              {!isCustomized && records.length > 0 && (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">演示数据</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-amber-500 text-stone-950 hover:bg-amber-400" title="快捷键 N" onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="mr-1.5 h-4 w-4" />记一笔
            </Button>
            <Popover open={dataMenuOpen} onOpenChange={setDataMenuOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={btnCls}>
                  <Database className="mr-1.5 h-4 w-4" />数据<ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 border-border p-1">
                <MenuItem icon={Download} label="导出 JSON" hint="完整备份" onClick={() => { setDataMenuOpen(false); handleExportJson() }} />
                <MenuItem icon={FileSpreadsheet} label="导出 CSV" hint="表格软件" onClick={() => { setDataMenuOpen(false); handleExportCsv() }} />
                <MenuItem icon={Upload} label="导入 JSON" onClick={() => { setDataMenuOpen(false); fileRef.current?.click() }} />
                {isCustomized && <>
                  <div className="my-1 h-px bg-border" />
                  <MenuItem icon={RotateCcw} label="恢复演示数据" danger onClick={() => { setDataMenuOpen(false); setResetOpen(true) }} />
                </>}
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" className={btnCls} title="设置" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className={btnCls} title={theme === 'dark' ? '切换为亮色模式' : '切换为深色模式'} onClick={toggle}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </div>
        </header>

        {!isCustomized && records.length > 0 && !demoDismissed && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
            <span className="min-w-[14rem] flex-1 text-muted-foreground">
              当前展示的是 <span className="text-foreground">{baseCount} 条演示数据</span>，可以先随便看看。准备好记录自己的观影时，清空它们或导入备份。
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" className="bg-amber-500 text-stone-950 hover:bg-amber-400" onClick={clearDemo}>清空，开始记录</Button>
              <Button size="sm" variant="outline" className={btnCls} onClick={() => fileRef.current?.click()}>导入备份</Button>
              <button className="text-muted-foreground hover:text-foreground" title="知道了" onClick={() => setDemoDismissed(true)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {backupOverdue && !bannerDismissed && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-400/10 px-4 py-3 text-sm">
            <Info className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
            <span className="flex-1 text-foreground">
              {lastExport === 0
                ? '你的观影数据只保存在这个浏览器里，还没有导出过备份。清除浏览器数据会导致记录丢失。'
                : `距上次导出备份已超过 30 天，建议导出一份最新备份。`}
            </span>
            <Button size="sm" className="bg-amber-500 text-stone-950 hover:bg-amber-400" onClick={handleExportJson}>
              立即导出
            </Button>
            <button className="text-muted-foreground hover:text-foreground" title="知道了" onClick={() => setBannerDismissed(true)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {records.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-20 text-center">
            <div className="rounded-2xl bg-amber-400/10 p-4">
              <Clapperboard className="h-8 w-8 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-foreground">还没有观影记录</p>
              <p className="mt-1 text-sm text-muted-foreground">记下看过的每一场，统计图表和海报墙会自动生成。支持上传票根截图识别填表。</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button className="bg-amber-500 text-stone-950 hover:bg-amber-400" onClick={() => { setEditing(null); setFormOpen(true) }}>
                <Plus className="mr-1.5 h-4 w-4" />记第一笔
              </Button>
              <Button variant="outline" className={btnCls} onClick={() => fileRef.current?.click()}>
                <Upload className="mr-1.5 h-4 w-4" />导入备份
              </Button>
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => { resetToBase(); toast.success('已恢复演示数据') }}>
                看看演示数据
              </Button>
            </div>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 border border-border bg-card">
              <TabsTrigger value="overview" className="data-[state=active]:bg-amber-500 data-[state=active]:text-stone-950">统计概览</TabsTrigger>
              <TabsTrigger value="records" className="data-[state=active]:bg-amber-500 data-[state=active]:text-stone-950">全部记录</TabsTrigger>
              <TabsTrigger value="posters" className="data-[state=active]:bg-amber-500 data-[state=active]:text-stone-950">海报墙</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <Suspense fallback={<SectionFallback />}>
                <StatsOverview records={records} />
              </Suspense>
            </TabsContent>
            <TabsContent value="records">
              <Suspense fallback={<SectionFallback />}>
                <RecordsTable
                  records={records}
                  onEdit={r => { setEditing(r); setFormOpen(true) }}
                  onDelete={setDeleting}
                  onDeleteMany={handleDeleteMany}
                  onSetRegion={handleSetRegion}
                />
              </Suspense>
            </TabsContent>
            <TabsContent value="posters">
              <Suspense fallback={<SectionFallback />}>
                <PosterWall records={records} onNeedSettings={() => setSettingsOpen(true)} />
              </Suspense>
            </TabsContent>
          </Tabs>
        )}

        <footer className="mt-10 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          数据只保存在当前浏览器，清除浏览器数据或换设备前，请先在「数据」菜单中导出 JSON。
          <span className="ml-2 text-muted-foreground/60">观影数据库 v{version}</span>
        </footer>
      </div>

      <Suspense fallback={null}>
      {formMounted && <MovieFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSubmit={handleSubmit}
        onNeedSettings={() => setSettingsOpen(true)}
        suggestRegion={suggestRegion}
        regions={regionOptions}
        cinemas={cinemaOptions}
        suggestHalls={suggestHalls}
        findDuplicate={findDuplicate}
      />}
      {settingsMounted && <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />}
      </Suspense>

      <AlertDialog open={!!deleting} onOpenChange={v => !v && setDeleting(null)}>
        <AlertDialogContent className="border-border bg-background text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条记录？</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              《{deleting?.title}》 · {deleting?.date} · {deleting?.cinema}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={btnCls}>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-500"
              onClick={() => {
                if (deleting) {
                  const snapshot = deleting
                  deleteRecord(snapshot.id)
                  toast.success(`已删除《${snapshot.title}》`, {
                    action: { label: '撤销', onClick: () => restoreRecords([snapshot]) },
                  })
                  setDeleting(null)
                }
              }}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent className="border-border bg-background text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>恢复演示数据？</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              当前的 {records.length} 条记录会被替换为内置的 {baseCount} 条演示数据。建议先导出备份。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={btnCls}>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-500"
              onClick={() => { resetToBase(); toast.success('已恢复演示数据') }}>
              恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!importList} onOpenChange={v => !v && setImportList(null)}>
        <AlertDialogContent className="border-border bg-background text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>如何导入这 {importList?.length ?? 0} 条记录？</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              当前已有 {records.length} 条记录。<br />
              <strong className="text-foreground">合并</strong>：保留现有记录，重复的（片名+日期+影院+座位相同）自动跳过，适合汇总多处录入的数据。<br />
              <strong className="text-foreground">替换</strong>：清空现有数据，仅保留文件内容，恢复备份时用这个。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-between">
            <AlertDialogCancel className={btnCls}>取消</AlertDialogCancel>
            <div className="flex gap-2">
              <AlertDialogAction className="bg-amber-500 text-stone-950 hover:bg-amber-400" onClick={doMergeImport}>
                合并到现有数据
              </AlertDialogAction>
              <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-500" onClick={doReplaceImport}>
                整体替换
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster theme={theme} position="bottom-right" />
    </div>
  )
}

function MenuItem({ icon: Icon, label, hint, danger, onClick }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  hint?: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent ${danger ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}
    >
      <Icon className="h-4 w-4 opacity-70" />
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </button>
  )
}
