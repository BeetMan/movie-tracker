import { describe, it, expect } from 'vitest'
import { resolveTheme } from '@/hooks/useTheme'

describe('resolveTheme', () => {
  it('固定偏好不受系统影响', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })
  it('跟随系统时取系统深浅色', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})
