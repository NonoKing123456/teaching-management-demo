import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate'
import config from './demo-config.json'
type Item=Record<string,any>
const specs:Item=config.specs
const xml=(s:string)=>new DOMParser().parseFromString(s,'application/xml')
const encode=(d:Document)=>strToU8(new XMLSerializer().serializeToString(d))
export const col=(n:number):string=>n?col(Math.floor((n-1)/26))+String.fromCharCode(65+(n-1)%26):''
export async function readBook(file:File){
  if(!file.name.toLowerCase().endsWith('.xlsx')||file.size>10485760)throw new Error('仅支持 10 MB 以内的 .xlsx 文件。')
  let files:Record<string,Uint8Array>;try{files=unzipSync(new Uint8Array(await file.arrayBuffer()))}catch{throw new Error('Excel 无法读取，请检查文件格式。')}
  if(Object.keys(files).length>3000||Object.values(files).reduce((n,b)=>n+b.length,0)>41943040)throw new Error('文件展开后过大。')
  const doc=(p:string)=>xml(strFromU8(files[p]||strToU8('<root/>')))
  if(!files['xl/workbook.xml'])throw new Error('这不是有效的 Excel 工作簿。')
  const shared=Array.from(doc('xl/sharedStrings.xml').getElementsByTagName('si')).map(el=>Array.from(el.getElementsByTagName('t')).map(t=>t.textContent).join(''))
  const rel=Array.from(doc('xl/_rels/workbook.xml.rels').getElementsByTagName('Relationship'))
  const styles=doc('xl/styles.xml'),formats=Array.from(styles.getElementsByTagName('numFmt'))
  const xfs=Array.from(styles.getElementsByTagName('cellXfs')[0]?.children||[])
  const sheets=Array.from(doc('xl/workbook.xml').getElementsByTagName('sheet')).map(el=>{
    const target=rel.find(r=>r.getAttribute('Id')===el.getAttribute('r:id'))?.getAttribute('Target')||''
    const path=target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,'')
    const d=doc(path),cells:Item={},formulas:Item={},percent:Item={}
    for(const c of Array.from(d.getElementsByTagName('c'))){const ref=c.getAttribute('r')!,t=c.getAttribute('t'),v=c.getElementsByTagName('v')[0]?.textContent||'';cells[ref]=t==='s'?shared[+v]:t==='inlineStr'?Array.from(c.getElementsByTagName('t')).map(x=>x.textContent).join(''):t==='str'?v:v===''?'':Number(v);formulas[ref]=c.getElementsByTagName('f').length>0;const id=xfs[+(c.getAttribute('s')||0)]?.getAttribute('numFmtId');percent[ref]=['9','10'].includes(id||'')||formats.some(f=>f.getAttribute('numFmtId')===id&&f.getAttribute('formatCode')?.includes('%'))}
    return {name:el.getAttribute('name')||'',hidden:el.getAttribute('state')&&el.getAttribute('state')!=='visible',cells,formulas,percent,path,doc:d}
  });return {files,sheets}
}
const grade=(v:any,ai=false)=>v==null?'':v>=(ai?96:100)?'A+':v>=90?'A':v>=80?'B':v>=70?'C':'D'
export async function parseRows(file:File,kind:string){
  const book=await readBook(file),s=specs[kind],rows:Item[]=[],errors:Item[]=[],warnings:string[]=[],times=new Set<string>()
  for(const sheet of book.sheets){const c=sheet.cells,err=(row:number,message:string)=>errors.push({sheet:sheet.name,row,message});if(kind==='habit'&&sheet.name.includes('Sheet')||kind==='classroom'&&sheet.name.includes('不统计'))continue
    if(sheet.hidden)err(0,'存在隐藏工作表，请取消隐藏。')
    if(Object.entries(s.markers).some(([ref,label])=>c[ref]!==label)){err(0,'模板不匹配，请下载对应模块的填报模板。');continue}
    const course=String(c[s.class_cell]||''),time=String(c[s.time_cell]||'');if(!course||!time)err(0,'课型和时间段都必须填写。');if(times.has(time))err(0,'多个工作表的时间段重复。');times.add(time)
    if(['habit','monthly'].includes(kind)&&!sheet.name.includes('演示老师'))err(0,'工作表名须包含“演示老师”，请使用演示模板。')
    const seen=new Set<string>()
    for(let r=s.start;r<=s.end;r++){const name=String(c[col(s.name_col)+r]||'');if(['平均','平均数','班级情况'].includes(String(c['A'+r]||'')))break;if(!name)continue
      const english=kind==='communication'?'':String(c[col(s.name_col+1)+r]||'');if(seen.has(name+'|'+english)&&kind!=='communication')err(r,'同班学生姓名和英文名重复。');seen.add(name+'|'+english)
      const data:Item={};s.fields.forEach(([key,label,type]:string[],i:number)=>{const n=kind==='communication'?({call_date:2,method:3,student_type:5,phone:6,content:7} as Item)[key]:s.name_col+2+i,ref=col(n)+r,raw=c[ref];let value:any=raw==null||raw===''?null:raw;
        if(type==='rank'){value=value==null?'':String(value).toUpperCase();if(value&&!['A+','A','B','C','D'].includes(value))err(r,label+'：请填写 A+、A、B、C 或 D。')}
        else if(type==='text')value=value==null?'':String(value)
        else if(value!=null){value=typeof value==='string'&&value.endsWith('%')?Number(value.slice(0,-1)):Number(value)*(type==='percent'&&sheet.percent[ref]?100:1);if(!Number.isFinite(value)||value<0||(['score','completion','reading_score'].includes(key)&&value>100))err(r,label+'：数值不在有效范围内。');value=Math.round(value*100)/100}
        data[key]=value
      })
      if(kind==='habit'){if(data.wechat_rate==null&&data.days!=null)data.wechat_rate=Math.round(data.days/7*100);if(data.average==null&&data.completion!=null&&data.wechat_rate!=null)data.average=Math.round((data.completion+data.wechat_rate)/2);for(const [k,v,ai]of [['completion_level','completion',false],['average_level','average',false],['reading_level','reading_score',true]]as const)if(!data[k])data[k]=grade(data[v],ai);if(data.stars==null)data.stars=(data.average>=100?2:data.average>=90?1:0)+(data.reading_score>=96?2:data.reading_score>=90?1:0)}
      if(kind==='classroom')for(const prefix of ['initial','phonemic','phonics','challenge','reading']){const total=data[prefix+'_total'],correct=data[prefix+'_correct'];if(total!=null&&correct!=null){if(correct>total)err(r,'正确数不能超过总题数。');if(data[prefix+'_rate']==null&&total>0)data[prefix+'_rate']=Math.round(correct/total*10000)/100}}
      if(kind==='communication'){if(!data.call_date&&!data.content&&!data.method&&!data.phone)continue;if(!data.call_date||!data.content)err(r,'电教时间和沟通内容必须填写。')}
      rows.push({sheet:sheet.name,source_row:r,student_name:name,english_name:english,class_type:course,class_time:time,data})
    }
    for(let r=s.end+1;r<=45;r++){if(['平均','平均数','班级情况'].includes(String(c['A'+r]||'')))break;if(c[col(s.name_col)+r]){err(r,'学生超出模板容量，请拆分班级。');break}}
  }
  if(!rows.length&&!errors.length)errors.push({sheet:'',row:0,message:'没有可提交的学生明细。'})
  return {rows,errors,warnings}
}
function setCell(d:Document,ref:string,value:any,percent=false){const ns=d.documentElement.namespaceURI!,create=(n:string)=>d.createElementNS(ns,n);let cell=Array.from(d.getElementsByTagName('c')).find(c=>c.getAttribute('r')===ref);if(!cell){const rownum=ref.match(/\d+$/)![0];let row=Array.from(d.getElementsByTagName('row')).find(r=>r.getAttribute('r')===rownum);if(!row){row=create('row');row.setAttribute('r',rownum);d.getElementsByTagName('sheetData')[0]!.append(row)}cell=create('c');cell.setAttribute('r',ref);row.append(cell)}while(cell.firstChild)cell.removeChild(cell.firstChild);cell.removeAttribute('t');if(value==null||value==='')return;if(typeof value==='number'){const v=create('v');v.textContent=String(percent?value/100:value);cell.append(v)}else{cell.setAttribute('t','inlineStr');const i=create('is'),t=create('t');t.textContent=String(value);i.append(t);cell.append(i)}}
export async function generateBook(kind:string,groups:Item[]){
  if(!groups.length)throw new Error('请先取得演示数据或导入源数据。')
  const response=await fetch('/examples/'+kind+'-template.xlsx');const book=await readBook(new File([await response.blob()],'template.xlsx'))
  // Templates contain the two fictional classes. Expand/collapse classes is intentionally excluded from this usability demo.
  if(groups.length!==book.sheets.length)throw new Error('演示版支持模板中的两个班级，请按源数据模板导入。')
  for(let n=0;n<groups.length;n++){const g=groups[n]!,sheet=book.sheets[n]!,s=specs[kind],checks=new Map<number,number>();if(!g.grade||!g.schedule)throw new Error('请填写课型和时间段。');if(!g.students?.length||g.students.length>s.end-s.start+1)throw new Error('班级人数为空或超出模板容量。')
    if(kind==='habit')for(const line of String(g.wechat||'').split('\n').filter(x=>x.trim())){const m=line.replace(/^\s*\d+[.、．)）\s]+/,'').replace(/打卡|住校|爱心/g,'').trim().match(/^(.+?)\s*[：:]?\s*(\d+)\s*天?\s*[❤♥]*$/);if(!m)throw new Error('接龙无法识别：'+line);const name=m[1]!.trim().replace(/\s/g,'').toLowerCase(),matches=g.students.map((st:Item,i:number)=>({st,i})).filter(({st}:Item)=>[st.name,st.english_name,st.name+st.english_name].map(x=>String(x||'').toLowerCase()).includes(name));if(matches.length!==1)throw new Error('接龙姓名未匹配或重名：'+m[1]);const i=matches[0].i,days=+m[2]!;if(days>31||checks.has(i))throw new Error('接龙天数超过 31 或姓名重复。');checks.set(i,days)}
    setCell(sheet.doc,s.class_cell,g.grade);setCell(sheet.doc,s.time_cell,g.schedule)
    for(let i=0;i<=s.end-s.start;i++){const r=s.start+i,student=g.students[i];setCell(sheet.doc,col(s.name_col)+r,student?.name);setCell(sheet.doc,col(s.name_col+1)+r,student?.english_name);let values:any[]=[];if(student){const a=student.completion,rd=student.reading_score,days=checks.get(i)??null,w=days==null?null:Math.round(days/7*100),avg=a==null||w==null?null:Math.round((a+w)/2);values=kind==='habit'?[a,grade(a),days,w,avg,grade(avg),rd,grade(rd,true),(avg!=null&&avg>=100?2:avg!=null&&avg>=90?1:0)+(rd!=null&&rd>=96?2:rd!=null&&rd>=90?1:0)]:[rd,a]};s.fields.forEach((f:string[],j:number)=>setCell(sheet.doc,col(s.name_col+2+j)+r,values[j],f[2]==='percent'))}
    book.files[sheet.path]=encode(sheet.doc)
  }
  return zipSync(book.files)
}
const escape=(v:any)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
export function reportBook(tables:{name:string,headers:string[],rows:any[][]}[]){
  const files:Record<string,Uint8Array>={},put=(p:string,s:string)=>files[p]=strToU8(s),ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  put('[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${tables.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`)
  put('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
  put('xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tables.map((t,i)=>`<sheet name="${escape(t.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`)
  put('xl/_rels/workbook.xml.rels',`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tables.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)
  put('xl/styles.xml',`<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="12"/><name val="微软雅黑"/><color rgb="FF233044"/></font><font><b/><sz val="12"/><name val="微软雅黑"/><color rgb="FFFFFFFF"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2457B2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`)
  tables.forEach((t,i)=>put(`xl/worksheets/sheet${i+1}.xml`,`<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${t.headers.map((_,j)=>`<col min="${j+1}" max="${j+1}" width="${j===t.headers.length-1?32:21}" customWidth="1"/>`).join('')}</cols><sheetData>${[t.headers,...t.rows].map((row,r)=>`<row r="${r+1}" ht="30" customHeight="1">${row.map((v,j)=>typeof v==='number'?`<c r="${col(j+1)}${r+1}" s="${r===0?1:0}"><v>${v}</v></c>`:`<c r="${col(j+1)}${r+1}" s="${r===0?1:0}" t="inlineStr"><is><t>${escape(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${col(t.headers.length)}${t.rows.length+1}"/></worksheet>`))
  return zipSync(files)
}
