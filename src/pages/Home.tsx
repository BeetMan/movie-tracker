import { useRef, useState } from 'react'
import { Clapperboard, Download, FileSpreadsheet, Moon, Plus, RotateCcw, Settings, Sun, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Toaster, toast } from 'sonner'
import { useMovies, exportJson, exportCsv } from '@/hooks/useMovies'
import { useTheme } from '@/hooks/useTheme'
import StatsOverview from '@/sections/StatsOverview'
import RecordsTable from '@/sections/RecordsTable'
import MovieFormDialog from '@/sections/MovieFormDialog'
import SettingsDialog from '@/sections/SettingsDialog'
import type { MovieRecord, MovieDraft } from '@/types/movie'
import { listRegions } from '@/types/movie'

export default function Home() {
  const { records, addRecord, updateRecord, deleteRecord, importRecords, resetToBase, suggestRegion, baseCount } = useMovies()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MovieRecord | null>(null)
  const [deleting, setDeleting] = useState<MovieRecord | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { theme, toggle } = useTheme()
  const fileRef = useRef<HTMLInputElement>(null)
  const regionOptions = listRegions(records)
  const cinemaOptions = (() => {
    const count = new Map<string, number>()
    for (const r of records) {
      if (r.cinema && r.cinema !== '?' && r.cinema !== '？') count.set(r.cinema, (count.get(r.cinema) ?? 0) + 1)
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  })()

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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        if (!Array.isArray(data) || data.some(r => typeof r.title !== 'string')) throw new Error()
        importRecords(data as MovieRecord[])
        toast.success(`已导入 ${data.length} 条记录`)
      } catch {
        toast.error('导入失败：请使用本站导出的 JSON 文件')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
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
            <Button className="bg-amber-500 text-stone-950 hover:bg-amber-400" onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="mr-1.5 h-4 w-4" />记一笔
            </Button>
            <Button variant="outline" className={btnCls} onClick={() => exportJson(records)}>
              <Download className="mr-1.5 h-4 w-4" />导出 JSON
            </Button>
            <Button variant="outline" className={btnCls} onClick={() => exportCsv(records)}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />导出 CSV
            </Button>
            <Button variant="outline" className={btnCls} onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 h-4 w-4" />导入
            </Button>
            <Button variant="outline" className={btnCls} onClick={() => setResetOpen(true)}>
              <RotateCcw className="mr-1.5 h-4 w-4" />重置
            </Button>
            <Button variant="outline" size="icon" className={btnCls} title="截图识别设置" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className={btnCls} title={theme === 'dark' ? '切换为亮色模式' : '切换为深色模式'} onClick={toggle}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </div>
        </header>

        <Tabs defaultValue="overview">
          <TabsList className="mb-4 border border-border bg-card">
            <TabsTrigger value="overview" className="data-[state=active]:bg-amber-500 data-[state=active]:text-stone-950">统计概览</TabsTrigger>
            <TabsTrigger value="records" className="data-[state=active]:bg-amber-500 data-[state=active]:text-stone-950">全部记录</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <StatsOverview records={records} />
          </TabsContent>
          <TabsContent value="records">
            <RecordsTable
              records={records}
              onEdit={r => { setEditing(r); setFormOpen(true) }}
              onDelete={setDeleting}
            />
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
              onClick={() => { if (deleting) { deleteRecord(deleting.id); toast.success('已删除'); setDeleting(null) } }}>
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

      <Toaster theme={theme} position="bottom-right" />
    </div>
  )
}
