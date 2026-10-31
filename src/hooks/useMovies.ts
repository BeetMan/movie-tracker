import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import baseData from '@/data/movies.json'
import type { MovieRecord, MovieDraft } from '@/types/movie'
import { learnRegionMap } from '@/types/movie'
import { deriveYear, mergeInto, parseStored, replaceWith } from '@/lib/records'
import { downloadFile, todayStamp } from '@/lib/download'

export const STORAGE_KEY = 'movie-db-v1'
/** 最后一次导出备份的时间戳（毫秒），用于备份提醒 */
export const LAST_EXPORT_KEY = 'movie-db-last-export'

const base = baseData as MovieRecord[]

function load(): MovieRecord[] {
  try {
    return parseStored(localStorage.getItem(STORAGE_KEY)) ?? base
  } catch {
    return base
  }
}

export function useMovies() {
  const [records, setRecords] = useState<MovieRecord[]>(load)
  // 仍是内置演示数据（引用相等）时不写入 localStorage：
  // 只看演示的访客不会被标记为「有改动」，重置后也保持干净
  const isCustomized = records !== base
  const warnedRef = useRef(false)

  useEffect(() => {
    if (records === base) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
      warnedRef.current = false
    } catch {
      // 存储空间满 / 隐私模式禁用：内存中的数据仍可用，提醒用户尽快导出
      if (!warnedRef.current) {
        warnedRef.current = true
        toast.error('浏览器存储写入失败，本次修改刷新后会丢失，请立即导出 JSON 备份', { duration: 10000 })
      }
    }
  }, [records])

  /** 影院 → 地区，从现有数据学习，用于预填 */
  const regionMap = useMemo(() => learnRegionMap(records), [records])
  const suggestRegion = useCallback(
    (cinema: string) => regionMap.get(cinema.trim()) ?? '',
    [regionMap]
  )

  const addRecord = useCallback((draft: MovieDraft) => {
    setRecords(prev => {
      const id = Math.max(0, ...prev.map(r => r.id)) + 1
      const region = draft.region?.trim() || learnRegionMap(prev).get(draft.cinema.trim()) || ''
      return [...prev, { ...draft, region, id, year: deriveYear(draft.date) }]
    })
  }, [])

  const updateRecord = useCallback((id: number, draft: MovieDraft) => {
    setRecords(prev =>
      prev.map(r => {
        if (r.id !== id) return r
        const region =
          draft.region?.trim() || learnRegionMap(prev.filter(x => x.id !== id)).get(draft.cinema.trim()) || ''
        return { ...draft, region, id, year: deriveYear(draft.date) }
      })
    )
  }, [])

  const deleteRecord = useCallback((id: number) => {
    setRecords(prev => prev.filter(r => r.id !== id))
  }, [])

  /** 把误删的记录按原 id 放回去（配合删除后的「撤销」） */
  const restoreRecords = useCallback((list: MovieRecord[]) => {
    setRecords(prev => {
      const existing = new Set(prev.map(r => r.id))
      const back = list.filter(r => !existing.has(r.id))
      return back.length ? [...prev, ...back] : prev
    })
  }, [])

  const deleteMany = useCallback((ids: number[]) => {
    const set = new Set(ids)
    setRecords(prev => prev.filter(r => !set.has(r.id)))
  }, [])

  /** 批量修改地区 */
  const setRegionFor = useCallback((ids: number[], region: string) => {
    const set = new Set(ids)
    setRecords(prev => prev.map(r => (set.has(r.id) ? { ...r, region } : r)))
  }, [])

  /** 合并导入（list 须已经过 sanitizeRecords 清洗），返回新增 / 跳过条数 */
  const mergeRecords = useCallback((list: MovieRecord[]) => {
    const { merged, added, skipped } = mergeInto(records, list)
    setRecords(merged)
    return { added, skipped }
  }, [records])

  /** 整体替换（list 须已经过 sanitizeRecords 清洗） */
  const importRecords = useCallback((list: MovieRecord[]) => {
    setRecords(replaceWith(list))
  }, [])

  const resetToBase = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    setRecords(base)
  }, [])

  return { records, addRecord, updateRecord, deleteRecord, restoreRecords, deleteMany, setRegionFor, importRecords, mergeRecords, resetToBase, isCustomized, suggestRegion, baseCount: base.length }
}

export function exportJson(records: MovieRecord[]) {
  markExported()
  const blob = new Blob([JSON.stringify(records, null, 1)], { type: 'application/json' })
  downloadFile(blob, `观影数据库_${todayStamp()}.json`)
}

export function exportCsv(records: MovieRecord[]) {
  markExported()
  const header = '影片,日期,地区,格式,影院,影厅,座位,票价,币种,备注,特效厅标注'
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = records.map(r =>
    [r.title, r.date, r.region, r.format, r.cinema, r.hall, r.seat, r.price, r.currency ?? 'CNY', r.note, r.special].map(esc).join(',')
  )
  const blob = new Blob(['﻿' + header + '\n' + lines.join('\n')], { type: 'text/csv' })
  downloadFile(blob, `观影数据库_${todayStamp()}.csv`)
}

export function markExported() {
  try { localStorage.setItem(LAST_EXPORT_KEY, String(Date.now())) } catch { /* ignore */ }
}
