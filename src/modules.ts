// Primary entries follow the seven modules in the original system.
export const primaryModules = [
  { id: 'weekly-checkin', name: '周习惯打卡', description: '取得 APP 数据，结合微信接龙生成周习惯表', action: '生成周习惯数据' },
  { id: 'monthly-checkin', name: '月习惯打卡', description: '取得上月打卡完成度与朗读分，生成月习惯表', action: '生成月习惯数据' },
  { id: 'classroom', name: '课堂过关数据上传', description: '按课次上传，分析各项过关表现与星币', action: '进入上传与分析' },
  { id: 'habit', name: '周习惯数据上传', description: '按周提交，查看课型、教师分析与期末数据', action: '进入上传与分析' },
  { id: 'monthly', name: '月习惯数据上传', description: '按月提交，生成超级班级和明星学员候选', action: '进入上传与分析' },
  { id: 'scores', name: '校内成绩上传', description: '上传成绩表，校验、分析并下载', action: '进入数据页面' },
  { id: 'communication', name: '电教数据上传', description: '按月上传沟通明细，汇总各教师电教记录', action: '进入上传与分析' },
] as const

export const supportedPages = new Set<string>(['dashboard', ...primaryModules.map(item => item.id), 'students', 'audit', 'settings'])
export function recordKind(page: string): string {
  return page === 'weekly-checkin' ? 'habit' : page === 'monthly-checkin' ? 'monthly' : page
}
