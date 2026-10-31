/** 触发浏览器下载：Blob 或 dataURL */
export function downloadFile(data: Blob | string, name: string) {
  const url = typeof data === 'string' ? data : URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 立即 revoke 在部分 Safari 上会让下载失败，延后释放
  if (typeof data !== 'string') setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** 本地日期 YYYY-MM-DD（toISOString 是 UTC，东八区凌晨会差一天） */
export function todayStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
