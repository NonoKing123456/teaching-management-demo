type Field=[string,string,string]
function counts(prefix:string,label:string){return {label,columns:[{key:prefix+'_total',label:'总数',width:64},{key:prefix+'_correct',label:'正确数',width:64},{key:prefix+'_rate',label:'正确率',width:80}]}}
const sections=[counts('initial','首音／听音／词汇'),counts('phonemic','音素／语言过关'),
 {label:'口语与表达',columns:[{key:'oral',label:'口语／思维',width:104},{key:'movie',label:'电影模仿',width:96},{key:'writing',label:'描述／写作',width:104}]},
 counts('phonics','拼读／词汇运用'),counts('challenge','挑战／输出词汇'),counts('reading','SW／阅读／语法'),
 {label:'解码与奖励',columns:[{key:'decode',label:'文本解码',width:96},{key:'stars',label:'星币',width:68}]}]
export function classroomGroups(fields:Field[]){
 const available=new Map(fields.map(field=>[field[0],field]))
 const result=sections.map(section=>({label:section.label,columns:section.columns.filter(c=>available.has(c.key)).map(c=>({...c,type:available.get(c.key)![2]}))})).filter(g=>g.columns.length)
 const known=new Set(sections.flatMap(s=>s.columns.map(c=>c.key)))
 const other=fields.filter(f=>!known.has(f[0])).map(f=>({key:f[0],label:f[1],type:f[2],width:120}))
 if(other.length)result.push({label:'其他项目',columns:other})
 return result
}
