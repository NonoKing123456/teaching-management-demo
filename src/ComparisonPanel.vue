<script setup lang="ts">
import {ref,computed,watch,onBeforeUnmount} from 'vue'
import {Download,RefreshCw} from 'lucide-vue-next'
import UiSelect from './UiSelect.vue'
import {api,query,downloadFile} from './api'
import {yearOptions} from './teachingCalendar'
import {teacherLabel} from './modules'
type Item=Record<string,any>
const props=defineProps<{kind:string,year:number,term:string,period:number,teacher:string,meta:Item}>()
const baselineYear=ref(props.year),baselineTerm=ref(props.term),baselinePeriod=ref<number|string>(''),search=ref(''),page=ref(1)
const selectedTeacher=ref(props.teacher),selectedClass=ref(''),classes=ref<Item[]>([])
const result=ref<Item|null>(null),busy=ref(false),error=ref('')
const spec=computed(()=>props.meta.kinds[props.kind]),maxPage=computed(()=>Math.max(1,Math.ceil((result.value?.total||0)/100)))
const classOptions=computed(()=>[{value:'',label:'全部班级'},...classes.value.map(c=>({value:JSON.stringify([c.class_type,c.class_time]),label:`${c.class_type} · ${c.class_time}`}))])
let version=0
let timer:ReturnType<typeof setTimeout>|undefined
onBeforeUnmount(()=>{++version;clearTimeout(timer)})
function defaults(){
  ++version;busy.value=false
  baselineYear.value=props.kind==='communication'&&props.period===1?props.year-1:props.year
  baselineTerm.value=props.kind==='communication'?'全年':props.term
  baselinePeriod.value=props.kind==='communication'?(props.period-1||12):props.period>=4?props.period-1:''
  if(baselineYear.value<2020){baselineYear.value=2020;baselinePeriod.value=''}
  selectedClass.value='';classes.value=[];queueComparison()
}
watch(()=>[props.kind,props.year,props.term,props.period],defaults,{immediate:true})
watch(()=>props.teacher,value=>{selectedTeacher.value=value})
function queueComparison(){++version;clearTimeout(timer);result.value=null;error.value='';page.value=1;busy.value=false;if(baselinePeriod.value)timer=setTimeout(()=>void compare(),250)}
watch([baselineYear,baselineTerm,baselinePeriod,selectedTeacher],()=>{selectedClass.value='';classes.value=[];queueComparison()})
watch([selectedClass,search],queueComparison)
function params(){const [course,time]=selectedClass.value?JSON.parse(selectedClass.value):['',''];return {kind:props.kind,year:props.year,term:props.term,period:props.period,teacher_id:selectedTeacher.value,class_type:course,class_time:time,baseline_year:baselineYear.value,baseline_term:baselineTerm.value,baseline_period:baselinePeriod.value,search:search.value}}
async function compare(){
  clearTimeout(timer)
  if(!baselinePeriod.value){error.value='请选择对比周期。';return}
  const current=++version;busy.value=true;error.value=''
  try{const data=await api(`teaching/comparison/?${query({...params(),offset:(page.value-1)*100})}`);if(current===version){result.value=data;classes.value=data.class_options||[]}}
  catch(e){if(current===version)error.value=(e as Error).message}
  finally{if(current===version)busy.value=false}
}
async function exportComparison(){busy.value=true;error.value='';try{await downloadFile(`teaching/comparison/export/?${query(params())}`)}catch(e){error.value=(e as Error).message}finally{busy.value=false}}
function turn(next:number){page.value=next;void compare()}
function val(v:unknown){return v===null||v===undefined?'—':v}
function delta(v:number|null|undefined){return v===null||v===undefined?'无法比较':v===0?'持平':`${v>0?'+':''}${v} ${props.kind==='scores'?'分':'次'}`}
function deltaTone(v:number|null|undefined){return v===null||v===undefined||v===0?'change-neutral':v>0?'change-up':'change-down'}
</script>
<template>
  <section class="panel workflow-panel">
    <h2>{{kind==='scores'?'成绩跨期比较':'电教跨月比较'}}</h2>
    <div class="workflow-toolbar form-fields">
      <label>对比年份<UiSelect v-model="baselineYear" aria-label="对比年份" :disabled="busy" :options="yearOptions.map(value=>({value,label:`${value} 年`}))"/></label>
      <label v-if="kind==='scores'">对比学期<UiSelect v-model="baselineTerm" aria-label="对比学期" :disabled="busy" :options="['春','秋'].map(value=>({value,label:value}))"/></label>
      <label>对比周期<UiSelect v-model="baselinePeriod" aria-label="对比周期" :disabled="busy" :options="[{value:'',label:'请选择周期'},...Array.from({length:spec.periods},(_,i)=>({value:i+1,label:spec.period_labels?.[i]||`${i+1} 月`}))]"/></label>
      <label>教师<UiSelect v-model="selectedTeacher" aria-label="比较教师" :disabled="busy" :options="[{value:'',label:'全部教师'},...meta.teachers.map((t:Item)=>({value:String(t.id),label:t.name}))]"/></label>
      <label>班级<UiSelect v-model="selectedClass" aria-label="比较班级" :disabled="busy" :options="classOptions"/></label>
      <label>学生姓名<input v-model="search" aria-label="比较学生姓名" placeholder="全部学生" :disabled="busy"/></label>
    </div>
    <div class="workflow-toolbar"><button class="btn primary" :disabled="busy" @click="page=1;compare()"><RefreshCw :size="16"/>比较</button><button class="btn" :disabled="busy||!result?.total" @click="exportComparison"><Download :size="16"/>下载比较表</button></div>
    <p v-if="error" class="validation-summary" role="alert">{{error}}</p>
    <template v-if="result">
      <p>{{result.baseline_label}} 与 {{result.current_label}} · {{result.total}} 位学生</p>
      <div class="table-scroll"><table><thead><tr><th>教师</th><th>课型／时间段</th><th>学生</th><th>英文名</th><th>{{result.baseline_label}}</th><th>{{result.current_label}}</th><th>变化</th><th>记录情况</th><th v-if="kind==='communication'">两期沟通内容</th></tr></thead><tbody>
        <tr v-for="r in result.items" :key="String(r.teacher_id)+r.class_type+r.class_time+r.student_name+r.english_name"><td>{{teacherLabel(r,meta.teachers)}}</td><td>{{r.class_type}} / {{r.class_time}}</td><td>{{r.student_name}}</td><td>{{r.english_name||'—'}}</td><td>{{val(r.before)}}{{kind==='communication'?' 次':''}}</td><td>{{val(r.after)}}{{kind==='communication'?' 次':''}}</td><td class="comparison-change" :class="deltaTone(r.delta)">{{delta(r.delta)}}</td><td>{{r.ambiguous?'同名记录待核对':r.status}}</td>
          <td v-if="kind==='communication'" class="wrap-cell"><details class="comparison-records"><summary>查看两期明细</summary><template v-for="side in [{key:'before',label:result.baseline_label},{key:'after',label:result.current_label}]" :key="side.key"><strong>{{side.label}}</strong><p v-for="(entry,index) in r[side.key+'_records']" :key="index">{{entry.call_date}} {{entry.method}}：{{entry.content}}</p><p v-if="!r[side.key+'_records'].length">无电教记录</p></template></details></td>
        </tr>
      </tbody></table></div>
      <p v-if="!result.total">所选两期暂无符合条件的记录。</p>
      <div v-if="result.total>100" class="workflow-footer"><button class="btn small" :disabled="busy||page<=1" @click="turn(page-1)">上一页</button><span>{{page}} / {{maxPage}}</span><button class="btn small" :disabled="busy||page>=maxPage" @click="turn(page+1)">下一页</button></div>
    </template>
    <details class="inline-help"><summary>比较说明</summary><p>{{kind==='scores'?'同一学生展示两次分数及变化；未填不当作0分，真实0分保留。':'每位学生展示两个月的电教次数与沟通内容。'}}已有月份保留，不需要再次上传；换班或姓名不同的记录会分别显示。</p></details>
  </section>
</template>
<style scoped>.comparison-change{font-weight:600;white-space:nowrap}.change-up{color:#3f7865}.change-down{color:#9b6b47}.change-neutral{color:#667085}.comparison-records{line-height:1.8}.comparison-records summary{cursor:pointer;color:#1d4ed8}.comparison-records strong{display:block;margin-top:12px}.comparison-records p{margin:5px 0;white-space:pre-wrap}</style>
