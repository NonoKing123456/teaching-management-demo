// Keep the original routes; only visible entries appear on the home page and sidebar.
export const moduleCatalog = [
  { id: 'weekly-checkin', name: '周习惯打卡', description: '取得 APP 数据，结合微信接龙生成周习惯表', action: '生成周习惯数据' },
  { id: 'monthly-checkin', name: '月阅读量数据整理', description: '导入泛读数量和学习天数，生成月阅读量表', action: '整理月阅读量数据' },
  { id: 'classroom', name: '课堂过关数据上传', description: '按课次上传，分析各项过关表现与星币', action: '进入上传与分析' },
  { id: 'habit', name: '周习惯数据上传', description: '按周提交，查看课型、教师分析与期末数据', action: '进入上传与分析' },
  { id: 'monthly', name: '月课外阅读量统计', description: '按月提交阅读量，评选超级班级和明星学员', action: '进入上传与分析' },
  { id: 'scores', name: '课内成绩上传', description: '上传成绩表，校验、分析并下载', action: '进入数据页面' },
  { id: 'communication', name: '电教数据上传', description: '按月上传沟通明细，汇总各教师电教记录', action: '进入上传与分析' },
] as const

export const primaryModules = moduleCatalog.filter(item => item.id !== 'monthly-checkin')
export const supportedPages = new Set<string>(['dashboard', ...moduleCatalog.map(item => item.id), 'students', 'audit', 'settings', 'teachers'])
export function recordKind(page: string): string {
  return page === 'weekly-checkin' ? 'habit' : page === 'monthly-checkin' ? 'monthly' : page
}

export function teacherLabel(row: Record<string, unknown>, teachers: ReadonlyArray<{id: unknown; name: string}> = []): string {
  const name = typeof row.teacher === 'string' ? row.teacher : '—'
  return teachers.find(teacher => String(teacher.id) === String(row.teacher_id))?.name || name
}
