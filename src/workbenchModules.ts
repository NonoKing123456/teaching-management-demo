export const workbenchModules:Record<string,{periodField:string;uploadName:string;inputHelp:string}>={
 habit:{periodField:'教学周',uploadName:'周习惯',inputHelp:'作业完成度、打卡天数、朗读分均需填写，0 表示真实零值。'},
 classroom:{periodField:'课次',uploadName:'课堂过关',inputHelp:'只填写本课实际开展的项目，其余可留空；总数、正确数和等级沿用原校验。'},
 monthly:{periodField:'月份',uploadName:'月课外阅读量',inputHelp:'泛读数量、学习天数填写非负整数；空白保留未采集，0 是真实零值。'},
 scores:{periodField:'考试',uploadName:'课内成绩',inputHelp:'填写本次考试分数；空白与真实 0 分分别保留。'},
}
export function workbenchPeriod(kind:string,period:number,labels?:string[]){return kind==='scores'?labels?.[period-1]||'考试':kind==='monthly'?`${period}月`:`第 ${period} ${kind==='classroom'?'课次':'周'}`}
