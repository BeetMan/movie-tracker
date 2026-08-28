import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, ScanLine, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { MovieRecord, MovieDraft } from '@/types/movie'
import { CURRENCIES, CURRENCY_NAMES, FORMAT_OPTIONS, SPECIAL_HALL_OPTIONS } from '@/types/movie'
import { extractFromImage, fileToDataUrl } from '@/lib/vision'
import { getOcrMode, ocrExtract } from '@/lib/ocr'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial?: MovieRecord | null
  onSubmit: (draft: MovieDraft) => void
  onNeedSettings: () => void
  /** 根据影院名给出已知地区（从历史数据学习），未知返回空串 */
  suggestRegion: (cinema: string) => string
  /** 数据中出现过的地区列表，用于输入建议 */
  regions: string[]
  /** 历史记录中的影院列表（按频次降序），用于自动补全 */
  cinemas: string[]
}

const empty: MovieDraft = {
  title: '', date: '', format: '2D', cinema: '', hall: '', seat: '',
  price: null, currency: 'CNY', note: null, special: null, region: '',
}

export default function MovieFormDialog({ open, onOpenChange, initial, onSubmit, onNeedSettings, suggestRegion, regions, cinemas }: Props) {
  const [form, setForm] = useState<MovieDraft>(empty)
  const [priceText, setPriceText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [ocrPct, setOcrPct] = useState<number | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setPreview(null)
      setExtracting(false)
      if (initial) {
        const { title, date, format, cinema, hall, seat, price, note, special, region } = initial
        setForm({ title, date, format, cinema, hall, seat, price, currency: initial.currency ?? 'CNY', note, special, region })
        setPriceText(price === null ? '' : String(price))
      } else {
        setForm(empty)
        setPriceText('')
      }
    }
  }, [open, initial])

  const set = <K extends keyof MovieDraft>(k: K, v: MovieDraft[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const valid = form.title.trim() !== '' && /^\d{4}\.\d{1,2}\.\d{1,2}$|^\d{4}\.\d{1,2}\.\?$/.test(form.date.trim())

  const handleImage = async (file: File | Blob) => {
    const mode = getOcrMode()
    try {
      setExtracting(true)
      setOcrPct(null)
      const dataUrl = await fileToDataUrl(file)
      setPreview(dataUrl)
      const result =
        mode === 'local'
          ? await ocrExtract(dataUrl, setOcrPct)
          : await extractFromImage(dataUrl)
      setForm(f => ({
        ...f,
        ...result,
        cinema: result.cinema ?? f.cinema,
        currency: result.currency ?? f.currency,
        region: result.cinema ? suggestRegion(result.cinema) : f.region,
      }))
      if (result.price !== null && result.price !== undefined) setPriceText(String(result.price))
      toast.success(mode === 'local' ? '本地 OCR 完成，请仔细核对各字段' : '识别完成，请核对后保存')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '识别失败'
      if (msg === 'NO_API_KEY') {
        toast.error('未配置 API Key，请在设置中填入，或切换为「本地 OCR」', { duration: 5000 })
        onNeedSettings()
      } else {
        toast.error(msg)
      }
      setPreview(null)
    } finally {
      setExtracting(false)
      setOcrPct(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const item = [...e.clipboardData.items].find(i => i.type.startsWith('image/'))
    const file = item?.getAsFile()
    if (file) {
      e.preventDefault()
      handleImage(file)
    }
  }

  const handleSubmit = () => {
    const price = priceText.trim() === '' ? null : Number(priceText)
    onSubmit({
      ...form,
      title: form.title.trim(),
      date: form.date.trim(),
      region: form.region?.trim() || suggestRegion(form.cinema),
      price: price !== null && !Number.isNaN(price) ? price : null,
      note: form.note?.trim() || null,
      special: form.special?.trim() || null,
    })
    onOpenChange(false)
  }

  const field = (label: string, node: React.ReactNode, span = false) => (
    <div className={span ? 'sm:col-span-2' : ''}>
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      {node}
    </div>
  )

  const inputCls = 'border-input bg-muted/40 text-foreground placeholder:text-muted-foreground/60'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-background text-foreground sm:max-w-lg" onPaste={handlePaste}>
        <DialogHeader>
          <DialogTitle>{initial ? '编辑记录' : '新增观影记录'}</DialogTitle>
        </DialogHeader>

        {/* 截图识别区 */}
        <div
          onClick={() => !extracting && fileRef.current?.click()}
          className="group relative cursor-pointer overflow-hidden rounded-lg border border-dashed border-input transition-colors hover:border-amber-500/60"
        >
          {preview ? (
            <div className="relative">
              <img src={preview} alt="截图预览" className="max-h-40 w-full object-contain bg-muted/40" />
              {extracting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-500 dark:text-amber-400" />
                  <span className="text-xs text-muted-foreground">
                    {ocrPct !== null ? `本地 OCR 识别中… ${ocrPct}%` : '正在识别截图…'}
                  </span>
                </div>
              )}
              {!extracting && (
                <button
                  onClick={e => { e.stopPropagation(); setPreview(null) }}
                  className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground"
                  title="清除截图"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 px-4 py-5 text-muted-foreground group-hover:text-foreground">
              {extracting ? <Loader2 className="h-5 w-5 animate-spin text-amber-500 dark:text-amber-400" /> : <ScanLine className="h-5 w-5" />}
              <div className="text-xs leading-relaxed">
                <span className="font-medium text-foreground">从取票截图自动填写</span>
                <br />点击选择图片，或直接 Ctrl+V 粘贴截图
              </div>
              <ImagePlus className="h-4 w-4 opacity-50" />
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f) }}
          />
        </div>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          {field('影片 *', <Input className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} placeholder="片名" />, true)}
          {field('日期 *（YYYY.M.D）', <Input className={inputCls} value={form.date} onChange={e => set('date', e.target.value)} placeholder="2026.7.24" />)}
          {field('格式', <>
            <Input className={inputCls} value={form.format} onChange={e => set('format', e.target.value)} placeholder="选择或手动输入" list="format-options" />
            <datalist id="format-options">
              {FORMAT_OPTIONS.map(o => <option key={o} value={o} />)}
            </datalist>
          </>)}
          {field('影院', <>
            <Input className={inputCls} value={form.cinema} onChange={e => {
              const v = e.target.value
              setForm(f => ({ ...f, cinema: v, region: suggestRegion(v) }))
            }} placeholder="输入时会自动补全历史影院" list="cinema-options" />
            <datalist id="cinema-options">
              {cinemas.map(c => <option key={c} value={c} />)}
            </datalist>
          </>, true)}
          {field('地区（去过的影院自动带出，可改）', <>
            <Input className={inputCls} value={form.region} onChange={e => set('region', e.target.value)} placeholder="城市 / 地区" list="region-options" />
            <datalist id="region-options">
              {regions.map(r => <option key={r} value={r} />)}
            </datalist>
          </>)}
          {field('影厅', <Input className={inputCls} value={form.hall} onChange={e => set('hall', e.target.value)} placeholder="杜比视界·全景声厅" />)}
          {field('座位', <Input className={inputCls} value={form.seat} onChange={e => set('seat', e.target.value)} placeholder="5排13座" />)}
          {field('票价（留空表示未知）', (
            <div className="flex gap-2">
              <Input className={`${inputCls} flex-1`} value={priceText} onChange={e => setPriceText(e.target.value)} placeholder="金额" inputMode="decimal" />
              <Select value={form.currency ?? 'CNY'} onValueChange={v => set('currency', v)}>
                <SelectTrigger className={`w-32 ${inputCls}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-input bg-popover text-popover-foreground">
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{CURRENCY_NAMES[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ), true)}
          {field('特效厅标注（普通场留空）', <>
            <Input className={inputCls} value={form.special ?? ''} onChange={e => set('special', e.target.value)} placeholder="选择或手动输入" list="special-options" />
            <datalist id="special-options">
              {SPECIAL_HALL_OPTIONS.map(o => <option key={o} value={o} />)}
            </datalist>
          </>)}
          {field('备注', <Input className={inputCls} value={form.note ?? ''} onChange={e => set('note', e.target.value)} placeholder="点映 / 路演 / 配音版本…" />, true)}
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => onOpenChange(false)}>取消</Button>
          <Button className="bg-amber-500 text-stone-950 hover:bg-amber-400" disabled={!valid || extracting} onClick={handleSubmit}>
            {initial ? '保存修改' : '添加记录'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
