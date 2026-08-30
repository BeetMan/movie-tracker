import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { API_KEY_STORAGE, MODEL_STORAGE, DEFAULT_MODEL } from '@/lib/vision'
import { OCR_MODE_STORAGE, type OcrMode } from '@/lib/ocr'
import { TMDB_KEY_STORAGE } from '@/lib/tmdb'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export default function SettingsDialog({ open, onOpenChange }: Props) {
  const [mode, setMode] = useState<OcrMode>('ai')
  const [key, setKey] = useState('')
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [tmdbKey, setTmdbKey] = useState('')

  // 对话框每次打开时在渲染期间重新加载设置（React 推荐的 adjust-state-during-render 模式，避免在 effect 中同步 setState）
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setMode((localStorage.getItem(OCR_MODE_STORAGE) as OcrMode) || 'ai')
      setKey(localStorage.getItem(API_KEY_STORAGE) ?? '')
      setModel(localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL)
      setTmdbKey(localStorage.getItem(TMDB_KEY_STORAGE) ?? '')
    }
  }

  const save = () => {
    localStorage.setItem(OCR_MODE_STORAGE, mode)
    localStorage.setItem(API_KEY_STORAGE, key.trim())
    localStorage.setItem(MODEL_STORAGE, model.trim() || DEFAULT_MODEL)
    localStorage.setItem(TMDB_KEY_STORAGE, tmdbKey.trim())
    toast.success('设置已保存')
    onOpenChange(false)
  }

  const inputCls = 'border-input bg-muted/40 text-foreground placeholder:text-muted-foreground/60'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">识别方式</Label>
            <RadioGroup value={mode} onValueChange={v => setMode(v as OcrMode)} className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors has-[:checked]:border-amber-500/60 has-[:checked]:bg-amber-400/5">
                <RadioGroupItem value="ai" className="mt-0.5 border-input text-amber-500" />
                <span>
                  <span className="block text-sm text-foreground">AI 识别（推荐）</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    调用 Kimi 视觉大模型，准确率高、字段全，需要 Moonshot API Key（按量计费，单次约几分钱）
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors has-[:checked]:border-amber-500/60 has-[:checked]:bg-amber-400/5">
                <RadioGroupItem value="local" className="mt-0.5 border-input text-amber-500" />
                <span>
                  <span className="block text-sm text-foreground">本地 OCR</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    浏览器内离线识别，免费、无需 Key；准确率一般，识别后请仔细核对。首次使用需加载约 10MB 识别模型
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>

          {mode === 'ai' && (
            <>
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">Moonshot API Key</Label>
                <Input
                  type="password"
                  className={inputCls}
                  value={key}
                  onChange={e => setKey(e.target.value)}
                  placeholder="sk-..."
                />
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  在 platform.moonshot.cn 创建。Key 只保存在你的浏览器里，识别请求由浏览器直接发往 Moonshot，不经过任何中间服务器。
                </p>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">模型（需支持视觉）</Label>
                <Input
                  className={inputCls}
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder={DEFAULT_MODEL}
                />
              </div>
            </>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <Label className="mb-1.5 block text-xs text-muted-foreground">TMDB API Key（海报墙，可选）</Label>
          <Input
            type="password"
            className={inputCls}
            value={tmdbKey}
            onChange={e => setTmdbKey(e.target.value)}
            placeholder="32 位 v3 API Key"
          />
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            用于「海报墙」匹配影片海报。在 themoviedb.org 免费注册 → 设置 → API → 申请 Developer Key。Key 只保存在本地浏览器。
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => onOpenChange(false)}>取消</Button>
          <Button className="bg-amber-500 text-stone-950 hover:bg-amber-400" onClick={save}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
