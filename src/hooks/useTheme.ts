import { useCallback, useEffect, useState } from 'react'

const THEME_STORAGE = 'movie-db-theme'
export type Theme = 'dark' | 'light'

export function getTheme(): Theme {
  return (localStorage.getItem(THEME_STORAGE) as Theme) || 'dark'
}

/** 在首次渲染前把主题 class 应用到 <html>，避免闪烁 */
export function applyInitialTheme() {
  document.documentElement.classList.toggle('dark', getTheme() === 'dark')
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(THEME_STORAGE, theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, isDark: theme === 'dark', toggle }
}

/** 图表配色（recharts 不读 Tailwind 类，需按主题给 hex） */
export interface ChartPalette {
  tick: string
  tickStrong: string
  grid: string
  axis: string
  cursor: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
}

export function chartPalette(isDark: boolean): ChartPalette {
  return isDark
    ? {
        tick: '#a8a29e',
        tickStrong: '#d6d3d1',
        grid: '#292524',
        axis: '#44403c',
        cursor: '#292524',
        tooltipBg: '#1c1917',
        tooltipBorder: '#44403c',
        tooltipText: '#e7e5e4',
      }
    : {
        tick: '#78716c',
        tickStrong: '#44403c',
        grid: '#e7e5e4',
        axis: '#d6d3d1',
        cursor: '#f5f5f4',
        tooltipBg: '#ffffff',
        tooltipBorder: '#e7e5e4',
        tooltipText: '#1c1917',
      }
}
