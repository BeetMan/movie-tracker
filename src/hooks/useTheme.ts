import { useSyncExternalStore } from 'react'

export const THEME_STORAGE = 'movie-db-theme'
export type Theme = 'dark' | 'light'
/** 用户偏好：固定深色 / 浅色，或跟随系统 */
export type ThemePref = Theme | 'system'

/** 把偏好解析为实际主题 */
export function resolveTheme(pref: ThemePref, systemDark: boolean): Theme {
  return pref === 'system' ? (systemDark ? 'dark' : 'light') : pref
}

// —— 全局主题 store：多个组件调用 useTheme() 共享同一份状态，切换时同步刷新（如统计页图表配色） ——
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
let pref: ThemePref = readStored()
let current: Theme = resolveTheme(pref, media?.matches ?? true)
const listeners = new Set<() => void>()

function readStored(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_STORAGE)
    return v === 'light' || v === 'system' ? v : 'dark'
  } catch {
    return 'dark'
  }
}

export function getTheme(): Theme {
  return current
}

function getPref(): ThemePref {
  return pref
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function apply() {
  current = resolveTheme(pref, media?.matches ?? true)
  document.documentElement.classList.toggle('dark', current === 'dark')
  listeners.forEach(fn => fn())
}

export function setThemePref(next: ThemePref) {
  pref = next
  try { localStorage.setItem(THEME_STORAGE, next) } catch { /* ignore */ }
  apply()
}

// 跟随系统时，系统切换深浅色立即生效
media?.addEventListener('change', () => { if (pref === 'system') apply() })

/** 在首次渲染前把主题 class 应用到 <html>，避免闪烁 */
export function applyInitialTheme() {
  document.documentElement.classList.toggle('dark', current === 'dark')
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme)
  const preference = useSyncExternalStore(subscribe, getPref)
  return { theme, preference, isDark: theme === 'dark', setPreference: setThemePref }
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
