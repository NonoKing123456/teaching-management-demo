export const currentYear = new Date().getFullYear()
export const yearOptions = Array.from({ length: Math.max(1, currentYear - 2020 + 1) }, (_, index) => currentYear - index)

export function defaultTeachingPeriod(kind: string, today = new Date()) {
  const year = today.getFullYear(), month = today.getMonth() + 1
  if (kind === 'monthly') return { year: month === 1 ? year - 1 : year, term: '全年', period: month - 1 || 12 }
  if (kind === 'communication') return { year, term: '全年', period: month }
  const term = month >= 2 && month <= 6 || kind === 'scores' && month >= 2 && month <= 8
    ? '春' : month >= 7 && month <= 8 ? '夏' : '秋'
  return { year: month === 1 ? year - 1 : year, term, period: 1 }
}
