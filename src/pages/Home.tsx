import { useRef, useState, useCallback, useEffect } from 'react'
import { Clapperboard, Download, FileSpreadsheet, Info, Moon, Plus, RotateCcw, Settings, Sun, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Toaster, toast } from 'sonner'
import { useMovies, exportJson, exportCsv, LAST_EXPORT_KEY } from '@/hooks/useMovies'
import { useTheme } from '@/hooks/useTheme'
import StatsOverview from '@/sections/StatsOverview'
import RecordsTable from '@/sections/RecordsTable'
import PosterWall from '@/sections/PosterWall'
import MovieFormDialog from '@/sections/MovieFormDialog'
import SettingsDialog from '@/sections/SettingsDialog'
import type { MovieRecord, MovieDraft } from '@/types/movie'
import { listRegions } from '@/types/movie'

export default function Home() {
  const { records, addRecord, updateRecord, deleteRecord, restoreRecords, deleteMany, setRegionFor, importRecords, mergeRecords, resetToBase, isCustomized, suggestRegion, baseCount } = useMovies()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MovieRecord | null>(null)
  const [deleting, setDeleting] = useState<MovieRecord | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingDup, setPendingDup] = useState<{ draft: MovieDraft; existing: MovieRecord } | null>(null)
  const [importList, setImportList] = useState<MovieRecord[] | null>(null)
  const [tab, setTab] = useState('overview')
  const { theme, toggle } = useTheme()
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [lastExport, setLastExport] = useState<number>(() => Number(localStorage.getItem(LAST_EXPORT_KEY)) || 0)
  const backupOverdue = isCustomized && (lastExport === 0 || Date.now() - lastExport > 30 * 24 * 3600 * 1000)

  const handleExportJson = () => { exportJson(records); setLastExport(Date.now()) }
  const handleExportCsv = () => { exportCsv(records); setLastExport(Date.now()) }
  const fileRef = useRef<HTMLInputElement>(null)
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

  const handleSubmit = (draft: MovieDraft) => {
    if (editing) {
      updateRecord(editing.id, draft)
      toast.success(`已更新《${draft.title}》`)
    } else {
      // 重复检测：同片名 + 同日期，可能是误录（也可能是同场二刷，由用户确认）
      const dup = records.find(r => r.title.trim() === draft.title.trim() && r.date === draft.date)
      if (dup) {
        setPendingDup({ draft, existing: dup })
        return
      }
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
      if (formOpen || settingsOpen || deleting || resetOpen || pendingDup) return
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
  }, [formOpen, settingsOpen, deleting, resetOpen, pendingDup])

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        if (!Array.isArray(data) || data.some(r => typeof r.title !== 'string')) throw new Error()
        setImportList(data as MovieRecord[])
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
              {records.length > 0 ? `${Math.min(...records.map(r => r.year))} 年至今的每一次影院之旅` : '每一次影院之旅'} · 修改会保存在当前浏览器，记得定期导出备份
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-amber-500 text-stone-950 hover:bg-amber-400" title="快捷键 N" onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="mr-1.5 h-4 w-4" />记一笔
            </Button>
            <Button variant="outline" className={btnCls} onClick={handleExportJson}>
              <Download className="mr-1.5 h-4 w-4" />导出 JSON
            </Button>
            <Button variant="outline" className={btnCls} onClick={handleExportCsv}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />导出 CSV
            </Button>
            <Button variant="outline" className={btnCls} onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 h-4 w-4" />导入
            </Button>
            <Button variant="outline" className={btnCls} onClick={() => setResetOpen(true)}>
              <RotateCcw className="mr-1.5 h-4 w-4" />重置
            </Button>
            <Button variant="outline" size="icon" className={btnCls} title="设置" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className={btnCls} title={theme === 'dark' ? '切换为亮色模式' : '切换为深色模式'} onClick={toggle}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </div>
        </header>

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

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 border border-border bg-card">
            <TabsTrigger value="overview" className="data-[state=active]:bg-amber-500 data-[state=active]:text-stone-950">统计概览</TabsTrigger>
            <TabsTrigger value="records" className="data-[state=active]:bg-amber-500 data-[state=active]:text-stone-950">全部记录</TabsTrigger>
            <TabsTrigger value="posters" className="data-[state=active]:bg-amber-500 data-[state=active]:text-stone-950">海报墙</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <StatsOverview records={records} />
          </TabsContent>
          <TabsContent value="records">
            <RecordsTable
              records={records}
              onEdit={r => { setEditing(r); setFormOpen(true) }}
              onDelete={setDeleting}
              onDeleteMany={handleDeleteMany}
              onSetRegion={handleSetRegion}
            />
          </TabsContent>
          <TabsContent value="posters">
            <PosterWall records={records} onNeedSettings={() => setSettingsOpen(true)} />
          </TabsContent>
        </Tabs>

        <footer className="mt-10 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          数据维护：在「全部记录」中直接增删改，或导出 JSON 后用「导入」整体替换。当前数据仅存储于本浏览器，换设备前请先导出。
        </footer>
      </div>

      <MovieFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSubmit={handleSubmit}
        onNeedSettings={() => setSettingsOpen(true)}
        suggestRegion={suggestRegion}
        regions={regionOptions}
        cinemas={cinemaOptions}
        suggestHalls={suggestHalls}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

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
            <AlertDialogTitle>重置为初始数据？</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              你在本浏览器中的全部修改都会被丢弃，恢复到内置的 {baseCount} 条原始记录。建议先导出备份。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={btnCls}>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-500"
              onClick={() => { resetToBase(); toast.success('已重置为初始数据') }}>
              重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDup} onOpenChange={v => !v && setPendingDup(null)}>
        <AlertDialogContent className="border-border bg-background text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>疑似重复记录</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              已有《{pendingDup?.existing.title}》在 {pendingDup?.existing.date}（{pendingDup?.existing.cinema || '未知影院'}）的观影记录。
              如果是同一天又看了一场可以继续添加，否则建议编辑原记录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={btnCls}>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-amber-500 text-stone-950 hover:bg-amber-400"
              onClick={() => {
                if (pendingDup) {
                  addRecord(pendingDup.draft)
                  toast.success(`已添加《${pendingDup.draft.title}》`)
                  setPendingDup(null)
                  setEditing(null)
                }
              }}>
              仍要添加
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
