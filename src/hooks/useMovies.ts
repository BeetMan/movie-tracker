import { useCallback, useEffect, useMemo, useState } from 'react'
import baseData from '@/data/movies.json'
import type { MovieRecord, MovieDraft } from '@/types/movie'
import { learnRegionMap, dedupBase, normSeat, normalizeDate } from '@/types/movie'

const STORAGE_KEY = 'movie-db-v1'
/** 最后一次导出备份的时间戳（毫秒），用于备份提醒 */
export const LAST_EXPORT_KEY = 'movie-db-last-export'

const base = baseData as MovieRecord[]

function load(): MovieRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as MovieRecord[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    /* ignore */
  }
  return base
}

function deriveYear(date: string): number {
  const m = /^(\d{4})/.exec(date.trim())
  return m ? parseInt(m[1], 10) : new Date().getFullYear()
}

export function useMovies() {
  const [records, setRecords] = useState<MovieRecord[]>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
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

  /**
   * 合并导入：把文件里的记录补充进现有数据，按「片名+日期+影院+座位」去重。
   * 座位一致或任一方座位为空（信息不全不敢放行）即视为重复；id 重新续编，地区沿用学习结果。
   */
  const mergeRecords = useCallback((list: MovieRecord[]) => {
    const seen = records.map(r => ({ base: dedupBase(r), seat: normSeat(r.seat) }))
    const regionMap = learnRegionMap(records)
    let maxId = Math.max(0, ...records.map(r => r.id))
    const merged = [...records]
    let added = 0
    let skipped = 0
    for (const raw of list) {
      const r = { ...raw, date: normalizeDate(raw.date ?? '') }
      const base = dedupBase(r)
      const seat = normSeat(r.seat)
      if (seen.some(e => e.base === base && (e.seat === seat || e.seat === '' || seat === ''))) {
        skipped += 1
        continue
      }
      seen.push({ base, seat })
      const region = r.region?.trim() || regionMap.get((r.cinema ?? '').trim()) || ''
      merged.push({ ...r, id: ++maxId, region, year: r.year ?? deriveYear(r.date) })
      added += 1
    }
    setRecords(merged)
    return { added, skipped }
  }, [records])

  const importRecords = useCallback((list: MovieRecord[]) => {
    const map = learnRegionMap(list)
    const cleaned = list.map((r, i) => ({
      ...r,
      id: i + 1,
      region: r.region?.trim() || map.get((r.cinema ?? '').trim()) || '',
      year: r.year ?? deriveYear(r.date || ''),
    }))
    setRecords(cleaned)
  }, [])

  const resetToBase = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setRecords(base)
  }, [])

  const isCustomized = useMemo(() => localStorage.getItem(STORAGE_KEY) !== null, [records])

  return { records, addRecord, updateRecord, deleteRecord, restoreRecords, deleteMany, setRegionFor, importRecords, mergeRecords, resetToBase, isCustomized, suggestRegion, baseCount: base.length }
}

export function exportJson(records: MovieRecord[]) {
  markExported()
  const blob = new Blob([JSON.stringify(records, null, 1)], { type: 'application/json' })
  download(blob, `观影数据库_${today()}.json`)
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
  download(blob, `观影数据库_${today()}.csv`)
}

function markExported() {
  try { localStorage.setItem(LAST_EXPORT_KEY, String(Date.now())) } catch { /* ignore */ }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
