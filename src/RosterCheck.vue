<script setup lang="ts">
import UiSelect from './UiSelect.vue'
import {classLabel,sortedClasses} from './classPresentation'

type Item=Record<string,any>
const props=withDefaults(defineProps<{check:Item,errors?:Item[]}>(),{errors:()=>[]})
const mapping=defineModel<Record<string,string>>({default:()=>({})})
defineEmits<{recheck:[],manage:[]}>()

function students(c:Item):Item[]{return c.students||[]}
function unfilled(c:Item){return students(c).filter(s=>['empty','missing'].includes(s.status))}
function filled(c:Item){return students(c).filter(s=>['complete','recorded'].includes(s.status)).length}
function location(s:Item){return s.locations?.length?`${s.locations[0].sheet} · 第 ${s.locations[0].row} 行`:'文件中没有该学生'}
function issues(c:Item){
 const result:{message:string,row:number,name?:string,allowed?:boolean}[]=[],seen=new Set<string>()
 const add=(message:string,row=0,name='',allowed=false)=>{
  const match=message.match(/^第\s*(\d+)\s*行\s*[:：]\s*/)
  if(match){row=Number(match[1]);message=message.slice(match[0].length)}
  const key=`${row}:${name}:${message.replace(/[\s：:。]/g,'')}`
  if(!message||seen.has(key))return
  seen.add(key);result.push({message,row,name,allowed})
 }
 for(const message of c.errors||[])add(message)
 const blankNames=unfilled(c).map(s=>s.name)
 for(const e of props.errors.filter(e=>e.sheet===c.sheet)){
  // Empty roster rows are summarized once below instead of one repeated error per student.
  if(/请补齐/.test(e.message)&&blankNames.some(name=>e.message.startsWith(name+'：')))continue
  add(e.message,e.row)
 }
 for(const s of students(c).filter(s=>!['empty','missing'].includes(s.status))){
  const row=s.locations?.[0]?.row||0
  if(s.missing_fields?.length)add(`缺少${s.missing_fields.join('、')}`,row,s.name)
  for(const message of s.issues||[])if(!props.errors.some(e=>e.sheet===c.sheet&&e.row===row&&e.message.includes(message)))add(message,row,s.name)
 }
 for(const s of c.extra||[])if(!props.errors.some(e=>e.sheet===c.sheet&&e.row===s.row))add(s.message,s.row,s.name,!!s.allowed)
 for(const s of c.duplicates||[])if(!props.errors.some(e=>e.sheet===c.sheet&&e.row===s.row))add('重复记录，请核对。',s.row,s.name)
 return result
}
</script>
<template>
 <section class="roster-check" aria-label="上传名单核对">
  <header class="check-heading"><h3>名单核对</h3><button type="button" class="text-button" @click="$emit('manage')">维护名单</button></header>
  <section v-for="c in check.classes||[]" :key="`${c.class_id||''}:${c.sheet}`" class="class-check">
   <header class="class-heading"><h4>{{c.class_id?classLabel(c):c.sheet}}</h4><div v-if="c.students" class="class-counts"><span>名单 {{c.roster_count??students(c).length}} 人</span><span class="count-filled">已填 {{filled(c)}}</span><span v-if="students(c).length-filled(c)" class="count-unfilled">未填 {{students(c).length-filled(c)}}</span></div><span v-else class="class-pending">待关联班级</span></header>
   <p v-if="c.missing_class" class="class-notice">文件未包含这个班。</p>
   <p v-if="c.changed" class="class-notice">名单有变更，请核对后重新校验。</p>
   <label v-if="c.candidates?.length" class="field">对应班级<UiSelect wide v-model="mapping[c.sheet]" :aria-label="`上传对应班级：${c.sheet}`" :options="[{value:'',label:'请选择时段'},...sortedClasses(c.candidates).map(v=>({value:String(v.id),label:classLabel(v)}))]"/></label>
   <ul v-if="issues(c).length" class="check-issues" aria-label="需要修改的问题"><li v-for="(issue,i) in issues(c)" :key="i" :class="{'issue-allowed':issue.allowed}"><span v-if="issue.row" class="issue-location">第 {{issue.row}} 行</span><span><strong v-if="issue.name">{{issue.name}} · </strong>{{issue.message}}</span></li></ul>
   <details v-if="unfilled(c).length" class="student-names"><summary>查看 {{unfilled(c).length}} 名未填学生</summary><ul><li v-for="s in unfilled(c)" :key="s.id" :title="location(s)"><span>{{s.name}}</span><small v-if="s.english_name">{{s.english_name}}</small><small v-if="s.status==='missing'" class="missing-row">缺行</small></li></ul></details>
   <details v-if="students(c).length" class="student-names all-students"><summary>查看全部 {{students(c).length}} 名学生</summary><ul><li v-for="s in students(c)" :key="s.id" :title="location(s)"><span>{{s.name}}</span><small v-if="s.english_name">{{s.english_name}}</small><small :class="['student-state', ['complete','recorded'].includes(s.status)?'is-filled':'is-unfilled']">{{['complete','recorded'].includes(s.status)?'已填':'未填'}}</small></li></ul></details>
  </section>
  <button v-if="Object.values(mapping).some(Boolean)" type="button" class="btn small recheck-button" @click="$emit('recheck')">按所选班级重新校验</button>
 </section>
</template>
<style scoped>
.roster-check{margin:16px 0;color:#344054;min-width:0}.check-heading,.class-heading{display:flex;justify-content:space-between;align-items:center;gap:10px 20px;flex-wrap:wrap}.check-heading{margin-bottom:4px}.check-heading h3{font-size:15px;font-weight:600;margin:0}.check-heading button{font-size:13px}.class-check{padding:16px 0;border-bottom:1px solid #edf1f6}.class-check:last-of-type{border-bottom:0}.class-heading h4{margin:0;font-size:14px;font-weight:600;line-height:1.6;overflow-wrap:anywhere}.class-counts{display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:13px;color:#7c8798;font-variant-numeric:tabular-nums}.count-filled{color:#27805e}.count-unfilled,.class-notice{color:#a36b20}.class-pending{font-size:13px;color:#a36b20}.class-notice{margin:9px 0 0;font-size:13px;line-height:1.6}.class-check .field{margin:12px 0;max-width:440px;font-size:14px}.check-issues{list-style:none;padding:10px 12px;margin:12px 0 0;border-radius:7px;background:#fff5f4}.check-issues li{display:flex;gap:12px;padding:4px 0;color:#b54746;font-size:13px;line-height:1.6;overflow-wrap:anywhere}.check-issues strong{font-weight:500}.check-issues .issue-allowed{color:#526987}.issue-location{flex:0 0 58px;font-variant-numeric:tabular-nums;color:#997172}.student-names{margin-top:11px;font-size:13px;color:#667085}.student-names summary{cursor:pointer;width:fit-content;line-height:1.8}.student-names summary:hover{color:#2563eb}.student-names ul{display:flex;flex-wrap:wrap;gap:7px;padding:0;list-style:none;margin:10px 0 0}.student-names li{display:flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid #e8edf4;border-radius:6px;line-height:1.6;color:#344054;max-width:100%;overflow-wrap:anywhere;flex-wrap:wrap}.student-names small{font-size:12px;color:#8993a2}.student-names .missing-row,.student-names .is-unfilled{color:#a36b20}.student-names .is-filled{color:#27805e}.all-students{color:#8993a2}.recheck-button{margin-top:14px}@media(max-width:600px){.class-heading{align-items:flex-start;gap:6px}.class-heading h4{width:100%}.class-counts{gap:14px}.check-issues li{gap:7px}.issue-location{flex-basis:51px}.student-names li{padding:4px 7px}}
</style>

