<script setup lang="ts">
import {ref,computed,watch,onBeforeUnmount,onDeactivated,nextTick,useId} from 'vue'
import {Download,RefreshCw} from 'lucide-vue-next'
import UiSelect from './UiSelect.vue'
import PageTable from './PageTable.vue'
import SimpleTableHeader from './SimpleTableHeader.vue'
import {usePaginationScroll} from './usePaginationScroll'
import FieldError from './FieldError.vue'
import {api,query,downloadFile} from './api'
import {teacherLabel} from './modules'
import {classLabel,sortedClasses} from './classPresentation'
type Item=Record<string,any>
const props=withDefaults(defineProps<{kind:string,initialTeacher?:string,meta:Item,year:number,term:string,period:number}>(),{initialTeacher:''})
const scores=computed(()=>props.kind==='scores')
const panel=ref<HTMLElement>(),pagination=usePaginationScroll(()=>panel.value?.querySelector<HTMLElement>('[data-page-table]')||undefined)
const errorId=useId()
const selectedTeacher=ref(props.initialTeacher),selectedClass=ref(''),baseline=ref(''),target=ref(''),search=ref(''),page=ref(1)
const classes=ref<Item[]>([]),optionsLoading=ref(false),optionsError=ref(''),notice=ref('')
const result=ref<Item|null>(null),busy=ref(false),error=ref(''),errorField=ref('')
const currentClass=computed(()=>classes.value.find(c=>c.key===selectedClass.value))
const periods=computed<Item[]>(()=>scores.value?Array.from({length:props.meta.kinds.scores.periods},(_,i)=>({key:String(i+1),year:props.year,term:props.term,period:i+1,label:props.meta.kinds.scores.period_labels[i]})):currentClass.value?.periods||[])
const before=computed(()=>periods.value.find(p=>p.key===baseline.value)),after=computed(()=>scores.value?{year:props.year,term:props.term,period:props.period}:periods.value.find(p=>p.key===target.value))
const comparisonClass=computed(()=>result.value?.selected_class||currentClass.value)
const tableColumns=computed(()=>['学生',`${scores.value?'对比期':'基准期'} · ${scores.value?before.value?.label:result.value?.baseline_label}`,`${scores.value?'当前期':'对比期'} · ${scores.value?props.meta.kinds.scores.period_labels[props.period-1]:result.value?.current_label}`,'变化','记录情况',...(comparisonClass.value?[]:['教师／班级']),...(scores.value?[]:['两期沟通内容'])])
const tableTitles=computed(()=>(scores.value?[undefined,result.value?.baseline_label,result.value?.current_label,'变化＝当前期－对比期']:[]))
const currentLabel=computed(()=>`${props.year}年${props.term}季 · ${props.meta.kinds.scores?.period_labels[props.period-1]||''}`)
const maxPage=computed(()=>Math.max(1,Math.ceil((result.value?.total||0)/100)))
const classOptions=computed(()=>[{value:'',label:scores.value?'全部班级':'请选择班级'},...sortedClasses(classes.value).map(c=>({value:c.key,label:classLabel(c,{teacher:true,term:true,teachers:props.meta.teachers})}))])
const periodOptions=computed(()=>[{value:'',label:'请选择期次'},...periods.value.filter(p=>!scores.value||p.period!==props.period).map(p=>({value:p.key,label:p.label}))])
const targetOptions=computed(()=>periodOptions.value.filter(p=>!p.value||p.value!==baseline.value))
let version=0,optionsVersion=0,timer:ReturnType<typeof setTimeout>|undefined
function invalidate(){pagination.cancel();++version;clearTimeout(timer);result.value=null;page.value=1;busy.value=false;error.value='';errorField.value=''}
async function loadClasses(){const current=++optionsVersion;invalidate();selectedClass.value='';if(!scores.value){baseline.value='';target.value=''}classes.value=[];optionsLoading.value=true;optionsError.value='';notice.value='';try{const data=await api(`teaching/comparison/options/?${query({kind:props.kind,teacher_id:selectedTeacher.value,...(scores.value?{year:props.year,term:props.term}:{})})}`);if(current===optionsVersion){classes.value=data.items;notice.value=data.notice||''}}catch(e){if(current===optionsVersion)optionsError.value=(e as Error).message}finally{if(current===optionsVersion){optionsLoading.value=false;if(!optionsError.value&&scores.value)queue()}}}
watch([selectedTeacher,()=>props.kind,()=>scores.value?props.year:undefined,()=>scores.value?props.term:undefined],loadClasses,{immediate:true})
watch(()=>props.period,()=>{if(scores.value){if(baseline.value===String(props.period))baseline.value='';queue()}})
watch(selectedClass,()=>{invalidate();if(scores.value)queue();else{baseline.value='';target.value='';search.value=''}})
watch(baseline,()=>{if(baseline.value===target.value)target.value=''})
function complete(){return !optionsLoading.value&&!optionsError.value&&(!selectedClass.value||!!currentClass.value)&&!!before.value&&!!after.value&&(scores.value?before.value.period!==props.period:!!currentClass.value&&baseline.value!==target.value)}
function queue(){invalidate();if(complete())timer=setTimeout(()=>void compare(),250)}
watch([baseline,target,search],queue)
function params(){return {kind:props.kind,teacher_id:currentClass.value?.teacher_id??selectedTeacher.value,class_id:currentClass.value?.id??'',year:after.value!.year,term:after.value!.term,period:after.value!.period,baseline_year:before.value!.year,baseline_term:before.value!.term,baseline_period:before.value!.period,search:search.value}}
function validate(){error.value='';errorField.value='';if(optionsLoading.value||optionsError.value){error.value='请先读取比较范围。'}else if(!scores.value&&!currentClass.value||!!selectedClass.value&&!currentClass.value){errorField.value='class';error.value='请选择一个班级。'}else if(!scores.value&&periods.value.length<2){error.value='该班级只有一期已提交数据，暂不能比较。'}else if(!before.value){errorField.value='baseline';error.value=scores.value?'请选择对比期。':'请选择基准期。'}else if(!after.value){errorField.value='target';error.value='请选择对比期。'}else if(scores.value?before.value.period===props.period:baseline.value===target.value){errorField.value=scores.value?'baseline':'target';error.value='请选择两个不同的期次。'}return !error.value}
async function compare(ticket?:ReturnType<typeof pagination.prepare>){clearTimeout(timer);if(!validate())return;const current=++version;busy.value=true;if(!ticket)result.value=null;try{const data=await api(`teaching/comparison/?${query({...params(),offset:(page.value-1)*100})}`);if(current===version){result.value=data;await nextTick();if(ticket)void pagination.finish(ticket,()=>current===version)}}catch(e){if(current===version){error.value=(e as Error).message;if(ticket)pagination.cancel()}}finally{if(current===version)busy.value=false}}
async function exportComparison(){if(!complete()||!result.value)return;const current=version;busy.value=true;error.value='';try{await downloadFile(`teaching/comparison/export/?${query(params())}`)}catch(e){if(current===version)error.value=(e as Error).message}finally{if(current===version)busy.value=false}}
function turn(next:number){if(busy.value)return;const ticket=scores.value?pagination.prepare():undefined;page.value=next;void compare(ticket)}
onDeactivated(()=>pagination.cancel())
function val(v:unknown){return v===null||v===undefined?'—':v}
function delta(v:number|null|undefined){return v===null||v===undefined?'无法比较':v===0?'持平':`${v>0?'+':''}${v} ${props.kind==='scores'?'分':'次'}`}
function deltaTone(v:number|null|undefined){return v===null||v===undefined||v===0?'change-neutral':v>0?'change-up':'change-down'}
function rowKey(r:Item){return JSON.stringify([r.teacher_id,r.roster_class_id,r.roster_student_id||[r.student_name,r.english_name]])}
onBeforeUnmount(()=>{++version;++optionsVersion;clearTimeout(timer)})
</script>
<template>
 <section ref="panel" class="panel workflow-panel comparison-panel" :class="{'comparison-score-mode':scores}" :aria-busy="busy||optionsLoading">
  <h2>{{kind==='scores'?'成绩跨期比较':'电教跨月比较'}}<small v-if="scores&&result" class="comparison-count">{{result.total}} 位学生</small></h2>
  <form @submit.prevent="page=1;compare()">
   <div class="workflow-toolbar form-fields comparison-fields">
    <label>教师<UiSelect v-model="selectedTeacher" aria-label="比较教师" :options="[{value:'',label:'全部教师'},...meta.teachers.map((t:Item)=>({value:String(t.id),label:t.name}))]"/></label>
    <label class="comparison-class">班级<UiSelect wide v-model="selectedClass" aria-label="比较班级" :disabled="optionsLoading" :options="classOptions" :aria-invalid="errorField==='class'" :aria-describedby="errorField==='class'?errorId+'-class':undefined"/><FieldError :id="errorId+'-class'" :message="errorField==='class'?error:''"/></label>
    <label>{{scores?'对比期':'基准期'}}<UiSelect wide v-model="baseline" :aria-label="scores?'比较对比期':'比较基准期'" :disabled="(!scores&&!currentClass)||optionsLoading" :options="periodOptions" :aria-invalid="errorField==='baseline'" :aria-describedby="errorField==='baseline'?errorId+'-baseline':undefined"/><FieldError :id="errorId+'-baseline'" :message="errorField==='baseline'?error:''"/></label>
    <label v-if="scores">当前期<output class="comparison-current" aria-label="比较当前期" :title="currentLabel">{{currentLabel}}</output></label>
    <label v-if="!scores">对比期<UiSelect wide v-model="target" aria-label="比较对比期" :disabled="!currentClass||optionsLoading" :options="targetOptions" :aria-invalid="errorField==='target'" :aria-describedby="errorField==='target'?errorId+'-target':undefined"/><FieldError :id="errorId+'-target'" :message="errorField==='target'?error:''"/></label>
    <label>学生姓名<input v-model="search" aria-label="比较学生姓名" placeholder="全部学生"/></label>
    <div v-if="scores" class="comparison-actions"><button type="submit" class="btn primary" :disabled="busy||optionsLoading"><RefreshCw :size="16"/>比较</button><button type="button" class="btn" :disabled="busy||!result?.total" @click="exportComparison"><Download :size="16"/>下载比较表</button></div>
   </div>
   <p v-if="optionsError" class="validation-summary" role="alert">{{optionsError}}<button class="text-button" type="button" @click="loadClasses">重新读取</button></p>
   <p v-if="error&&!errorField" class="validation-summary" role="alert">{{error}}</p>
   <p v-if="optionsLoading" class="comparison-note" role="status">正在读取可比较的班级…</p>
   <p v-else-if="!classes.length" class="comparison-note">暂无已关联班级的提交数据。</p>
   <p v-else-if="!scores&&!currentClass" class="comparison-note">选择一个班级，再选择该班级的两个已提交期次。</p>
   <p v-else-if="!scores&&periods.length<2" class="comparison-note">该班级目前只有一期提交，至少需要两期才能比较。</p>
   <div v-if="!scores" class="workflow-toolbar"><button type="submit" class="btn primary" :disabled="busy||optionsLoading"><RefreshCw :size="16"/>比较</button><button type="button" class="btn" :disabled="busy||!result?.total" @click="exportComparison"><Download :size="16"/>下载比较表</button></div>
  </form>
  <template v-if="result">
   <p v-if="comparisonClass" class="comparison-context"><strong>{{classLabel(comparisonClass,{teacher:true,term:true,teachers:meta.teachers})}}</strong><span v-if="!scores">基准期：{{result.baseline_label}} → 对比期：{{result.current_label}} · {{result.total}} 位学生</span></p>
   <PageTable :enabled="scores" label="成绩跨期比较" :has-rows="!!result.total"><table class="comparison-compact-table" :class="{'comparison-scores-table':scores}"><SimpleTableHeader :columns="tableColumns" :titles="tableTitles"/><tbody>
    <tr v-for="r in result.items" :key="rowKey(r)"><td class="comparison-student">{{r.student_name}}<span v-if="r.english_name" class="comparison-english">{{r.english_name}}</span></td><td class="comparison-number">{{val(r.before)}}{{kind==='communication'?' 次':''}}</td><td class="comparison-number">{{val(r.after)}}{{kind==='communication'?' 次':''}}</td><td class="comparison-change" :class="deltaTone(r.delta)">{{delta(r.delta)}}</td><td>{{r.ambiguous?'同名记录待核对':r.status}}</td><td v-if="!comparisonClass" class="comparison-ownership"><span>{{teacherLabel(r,meta.teachers)}}</span><span class="comparison-class-label">{{r.class_time}} · {{r.class_type}}<span v-if="typeof r.is_experimental==='boolean'" class="comparison-cohort" :aria-label="r.is_experimental?'实验班':'普通班'" :title="r.is_experimental?'实验班':'普通班'">{{r.is_experimental?'实':'普'}}</span></span></td><td v-if="kind==='communication'" class="wrap-cell"><details class="comparison-records"><summary>查看两期明细</summary><template v-for="side in [{key:'before',label:result.baseline_label},{key:'after',label:result.current_label}]" :key="side.key"><strong>{{side.label}}</strong><p v-for="(entry,index) in r[side.key+'_records']" :key="index">{{entry.call_date}} {{entry.method}}：{{entry.content}}</p><p v-if="!r[side.key+'_records'].length">无电教记录</p></template></details></td></tr>
   </tbody></table><template #header><SimpleTableHeader :columns="tableColumns" :titles="tableTitles"/></template></PageTable>
   <p v-if="!result.total">所选范围的两期暂无符合条件的记录。</p>
   <div v-if="result.total>100" class="workflow-footer"><button class="btn small" :disabled="busy||page<=1" @click="turn(page-1)">上一页</button><span>{{page}} / {{maxPage}}</span><button class="btn small" :disabled="busy||page>=maxPage" @click="turn(page+1)">下一页</button></div>
  </template>
  <details class="inline-help"><summary>比较说明</summary><p>{{scores?'当前期跟随上方年份、学期和考试；选择同年同学期的另一期进行比较，变化＝当前期－对比期。班级默认全部，可单独筛选。':'班级和两个期次独立选择，展示两个月的次数及沟通内容。'}}按教师、班级和学生匹配，单期存在的记录单独标明。{{scores?'空白不当作0分，真实0分保留。':''}}</p><p v-if="notice">{{notice}}</p></details>
 </section>
</template>
<style scoped>
.comparison-count{font-size:13px;font-weight:400;color:#748094;margin-left:auto}
.comparison-panel :deep(.comparison-compact-table){width:100%;max-width:none;margin-inline:auto;table-layout:auto}
.comparison-panel :deep(.comparison-compact-table th),.comparison-compact-table td{padding-inline:12px}
.comparison-compact-table .comparison-student{min-width:130px;max-width:220px;white-space:normal;overflow-wrap:anywhere}
.comparison-english{margin-left:7px;color:#748094;font-size:13px}
.comparison-number{font-variant-numeric:tabular-nums;text-align:right}
.comparison-ownership>span{display:block}
.comparison-ownership .comparison-class-label{display:inline-flex;font-size:13px;color:#748094}
.comparison-compact-table .wrap-cell{min-width:240px;max-width:360px;white-space:normal;overflow-wrap:anywhere}
.comparison-score-mode .comparison-fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr) minmax(0,.75fr) minmax(0,1.25fr) minmax(0,.8fr) auto;align-items:start;gap:10px;padding:8px 0 18px}
.comparison-score-mode .comparison-fields>label{min-width:0;line-height:22px}
.comparison-score-mode .comparison-fields :deep(.ui-select-trigger){height:44px}
.comparison-score-mode .comparison-fields label input{width:100%;height:44px}
.comparison-score-mode .comparison-current{height:44px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
.comparison-actions{display:flex;align-items:center;gap:8px;padding-top:29px}
.comparison-score-mode .comparison-actions .btn{height:44px;padding:10px 12px;white-space:nowrap}
@media(max-width:1150px){.comparison-score-mode .comparison-fields{grid-template-columns:repeat(3,minmax(0,1fr))}.comparison-score-mode .comparison-actions{align-self:end;padding-top:0}}
@media(max-width:620px){.comparison-score-mode .comparison-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.comparison-score-mode .comparison-fields>label:first-child,.comparison-score-mode .comparison-fields>.comparison-class,.comparison-score-mode .comparison-fields>label:last-of-type,.comparison-score-mode .comparison-actions{grid-column:1/-1}.comparison-score-mode .comparison-current{height:auto;min-height:44px;white-space:normal}.comparison-score-mode .comparison-actions .btn{flex:1}}
</style>
<style scoped>.comparison-scores-table :deep(th),.comparison-scores-table td{padding-inline:14px}.comparison-current{display:flex;align-items:center;min-height:44px;padding:10px 12px;border:1px solid #e3e8f0;border-radius:8px;background:#f7f9fc;color:#475569;line-height:22px;font-size:15px}.comparison-class-label{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.comparison-cohort{display:inline-flex;align-items:center;justify-content:center;flex:none;width:20px;height:20px;border:1px solid #b8c5d9;border-radius:50%;color:#536b8d;font-size:12px;font-weight:500;line-height:1}.comparison-change{font-weight:600;white-space:nowrap}.change-up{color:#3f7865}.change-down{color:#9b6b47}.change-neutral{color:#667085}.comparison-records{line-height:1.8}.comparison-records summary{cursor:pointer;color:#1d4ed8}.comparison-records strong{display:block;margin-top:12px}.comparison-records p{margin:5px 0;white-space:pre-wrap}.comparison-note{font-size:14px;color:#748094;line-height:1.8;margin:10px 0}.comparison-context{display:grid;gap:6px;margin:16px 0;font-size:14px;line-height:1.8}.comparison-context strong{font-weight:500}.comparison-context span{color:#62738a}.comparison-fields{align-items:start}.comparison-fields label{min-width:140px;flex:1 1 150px}.comparison-fields .comparison-class{flex-basis:220px}.comparison-fields :deep(.ui-select){width:100%}@media(max-width:620px){.comparison-fields label{flex-basis:calc(50% - 8px);min-width:0}.comparison-fields .comparison-class{flex-basis:100%}.comparison-fields input{width:100%}.comparison-panel{padding:16px}}</style>
