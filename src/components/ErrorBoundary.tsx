import { Component, type ReactNode } from 'react'
import { TriangleAlert, RefreshCw, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 全局错误边界：任何渲染异常兜底，避免整页白屏。
 * 兜底界面提供「导出数据」逃生按钮，先把 localStorage 里的数据救出来。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private exportData = () => {
    const raw = localStorage.getItem('movie-db-v1')
    if (!raw) return
    const blob = new Blob([raw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `观影数据库_紧急备份_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const hasData = (() => {
      try { return !!localStorage.getItem('movie-db-v1') } catch { return false }
    })()

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 w-fit rounded-full bg-amber-400/10 p-3">
            <TriangleAlert className="h-8 w-8 text-amber-500 dark:text-amber-400" />
          </div>
          <h1 className="text-lg font-semibold">页面出错了</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            应用遇到了意外错误。你的观影数据保存在浏览器本地，通常不会受影响。
          </p>
          {error.message && (
            <p className="mt-3 max-h-24 overflow-auto rounded-md bg-muted/60 px-3 py-2 text-left font-mono text-xs text-muted-foreground">
              {error.message}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Button
              className="bg-amber-500 text-stone-950 hover:bg-amber-400"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />刷新页面
            </Button>
            {hasData && (
              <Button
                variant="outline"
                className="border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={this.exportData}
              >
                <Download className="mr-1.5 h-4 w-4" />先导出数据备份
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }
}
