type Item=Record<string,any>
const schedules=['一晚','二晚','三晚','四晚','五晚','六晚','六上','六下1','六下2','日上','日下1','日下2']
export function classLabel(item:Item,context:{teacher?:boolean,term?:boolean,teachers?:Item[]}={}){
 const parts=[item.schedule||item.class_time||'待补时段',item.grade||item.class_type||'待补年级',item.legacy_unlinked?'旧记录未关联':item.is_experimental===true?'实验班':item.is_experimental===false?'普通班':'班型未标注']
 if(context.teacher&&item.teacher)parts.push(context.teachers?.find(t=>String(t.id)===String(item.teacher_id))?.name||item.teacher)
 if(context.term&&item.year)parts.push(`${item.year}年${item.term==='夏'?'暑季':item.term?item.term+'季':'待补学期'}`)
 if(item.archived_now)parts.push('已归档')
 return parts.join(' · ')
}
export function sortedClasses(items:Item[]){return items.slice().sort((a,b)=>{
 const first=schedules.indexOf(a.schedule||a.class_time),second=schedules.indexOf(b.schedule||b.class_time)
 return (first<0?99:first)-(second<0?99:second)||String(a.teacher||'').localeCompare(String(b.teacher||''),'zh-CN')||(b.year||0)-(a.year||0)
})}
