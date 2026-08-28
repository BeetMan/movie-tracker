import { useCallback, useEffect, useMemo, useState } from 'react'
import baseData from '@/data/movies.json'
import type { MovieRecord, MovieDraft } from '@/types/movie'
import { learnRegionMap } from '@/types/movie'

const STORAGE_KEY = 'movie-db-v1'

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

  return { records, addRecord, updateRecord, deleteRecord, importRecords, resetToBase, isCustomized, suggestRegion, baseCount: base.length }
}

export function exportJson(records: MovieRecord[]) {
  const blob = new Blob([JSON.stringify(records, null, 1)], { type: 'application/json' })
  download(blob, `观影数据库_${today()}.json`)
}

export function exportCsv(records: MovieRecord[]) {
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
