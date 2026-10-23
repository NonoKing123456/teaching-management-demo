export type WorkbenchField=[string,string,string]
export type WorkbenchMetric={key:string,label:string,fields:WorkbenchField[]}

export function studentMetricColumns(kind:string,fields:WorkbenchField[]):WorkbenchMetric[]{
 if(kind!=='habit')return fields.map(field=>({key:field[0],label:field[1],fields:[field]}))
 const definitions:[string,string,string[]][]=[
  ['completion','作业完成度',['completion','completion_level']],
  ['days','微信打卡',['days','wechat_rate']],
  ['reading_score','朗读',['reading_score','reading_level']],
  ['average','两项平均',['average','average_level']],
  ['stars','星币',['stars']],
 ]
 const covered=new Set(definitions.flatMap(([, ,keys])=>keys))
 return [
  ...definitions.map(([key,label,keys])=>({key,label,fields:keys.map(name=>fields.find(field=>field[0]===name)).filter((field):field is WorkbenchField=>!!field)})).filter(group=>group.fields.length),
  ...fields.filter(field=>!covered.has(field[0])).map(field=>({key:field[0],label:field[1],fields:[field]})),
 ]
}
