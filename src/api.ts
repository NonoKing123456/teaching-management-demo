let csrfToken = ''
export class ApiError extends Error { constructor(public status: number, message: string) { super(message) } }
function messageOf(data: unknown): string {
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return data.map(messageOf).join(' ')
  if (data && typeof data === 'object') return Object.values(data).map(messageOf).join(' ')
  return '操作未完成，请稍后重试。'
}
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (options.method && options.method !== 'GET') headers.set('X-CSRFToken', csrfToken)
  const response = await fetch(`/api/${path}`, { ...options, headers, credentials: 'same-origin' })
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => ({ detail: '服务暂时无法连接。' }))
  if (!response.ok) throw new ApiError(response.status, messageOf(data))
  if (data.csrfToken) csrfToken = data.csrfToken
  return data as T
}
export function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') search.set(k, String(v))
  return search.toString()
}

export async function downloadFile(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (options.method && options.method !== 'GET') headers.set('X-CSRFToken', csrfToken)
  const response = await fetch(`/api/${path}`, {...options, headers, credentials:'same-origin'})
  if (!response.ok) throw new ApiError(response.status, messageOf(await response.json().catch(()=>({detail:'文件生成失败。'}))))
  const disposition = response.headers.get('Content-Disposition') || ''
  const name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const plain = disposition.match(/filename="([^"]+)"/)?.[1]
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = name ? decodeURIComponent(name) : plain || '教学数据.xlsx'
  anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),1000)
}
