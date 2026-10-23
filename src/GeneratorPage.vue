<script setup lang="ts">
import UiSelect from './UiSelect.vue'
import {classLabel,sortedClasses} from './classPresentation'
import RosterCheck from './RosterCheck.vue'
import {ref,computed,watch,onBeforeUnmount} from 'vue'
import {Download,RefreshCw,LoaderCircle,ArrowRight,CheckCircle2,EyeOff} from 'lucide-vue-next'
import {api,downloadFile,query} from './api'
import FileUpload from './FileUpload.vue'
import {useFeedback} from './feedback'
import FieldError from './FieldError.vue'
import FillingState from './FillingState.vue'
import {useFormValidation,required,yearError} from './formValidation'
import {defaultTeachingPeriod,yearOptions,teachingPeriodRule} from './teachingCalendar'

type Item=Record<string,any>
const props=defineProps<{kind:string,user:Item,meta:Item}>(),emit=defineEmits<{navigate:[id:string]}>()
const teacher=ref(String(props.user.role==='teacher'?props.user.id:props.meta.roster_enabled?'':props.meta.upload_teachers[0]?.id||props.user.id))
const groups=ref<Item[]>([]),busy=ref(false),submissionAttempt=ref(false)
const blocks=ref<Item[]>([]),showBlocks=ref(false),blockError=ref('')
const {error,notice}=useFeedback()
const formElement=ref<HTMLFormElement>(),sourceError=ref(''),generationError=ref('')
const preview=ref<Item|null>(null),replace=ref(false),submitted=ref<Item|null>(null)
const rosterClasses=ref<Item[]>([]),rosterAcknowledged=ref(false),classMapping=ref<Record<string,string>>({})
const rosterWeekly=computed(()=>props.kind==='habit'&&props.meta.roster_enabled)
const initialRange=props.kind==='habit'?props.meta.weekly_range:props.meta.monthly_range
const defaults=defaultTeachingPeriod(props.kind,new Date(initialRange[1]+'T12:00:00'))
const year=ref(props.kind==='monthly'?new Date(initialRange[1]+'T12:00:00').getFullYear():defaults.year),term=ref(defaultTeachingPeriod('habit',new Date(initialRange[1]+'T12:00:00')).term),period=ref<number|string>(props.kind==='monthly'?new Date(initialRange[1]+'T12:00:00').getMonth()+1:'')
const rosterYear=ref(defaultTeachingPeriod('habit',new Date(initialRange[1]+'T12:00:00')).year)
const range=computed(()=>props.kind==='habit'?props.meta.weekly_range:[`${year.value}-${String(period.value).padStart(2,'0')}-01`,`${year.value}-${String(period.value).padStart(2,'0')}-${new Date(year.value,Number(period.value),0).getDate()}`])
const periodCount=computed(()=>teachingPeriodRule(props.meta,props.kind,term.value).periods)
watch(term,()=>{if(props.kind==='habit'&&Number(period.value)>periodCount.value)period.value=''})
watch([year,period],()=>{if(props.kind==='monthly'){const value=defaultTeachingPeriod('habit',new Date(year.value,Number(period.value)-1,15));rosterYear.value=value.year;term.value=value.term}})
const gradeOptions=computed(()=>[{value:'',label:'请选择年级'},...(props.meta.roster_options?.grades||[]).map((value:string)=>({value,label:value}))])
const scheduleOptions=computed(()=>[{value:'',label:'请选择时间段'},...(props.meta.roster_options?.schedules||[]).map((value:string)=>({value,label:value}))])
let rosterLoadVersion=0
async function loadRosterClasses(){const requestVersion=++rosterLoadVersion;if(!props.meta.roster_enabled||!teacher.value){rosterClasses.value=[];return}try{const data=await api(`roster/classes/?${query({teacher_id:teacher.value,year:props.kind==='monthly'?rosterYear.value:year.value,term:term.value,archived:'false'})}`);if(requestVersion===rosterLoadVersion)rosterClasses.value=data.items}catch(e){if(requestVersion===rosterLoadVersion)sourceError.value=(e as Error).message}}
watch([teacher,year,term,rosterYear],()=>{void loadRosterClasses();groups.value.forEach(g=>{g.wechatVersion=(g.wechatVersion||0)+1;g.prepared=null;g.roster_class_id='';g.roster_version=null})},{immediate:true})
async function bindClass(g:Item){
  invalidate();g.prepared=null;const version=g.bindVersion=(g.bindVersion||0)+1;g.wechatVersion=(g.wechatVersion||0)+1
  if(!g.roster_class_id){g.roster_version=null;if(rosterWeekly.value){g.grade='';g.schedule='';g.is_experimental=undefined;g.roster_name=''}return}
  const classId=g.roster_class_id;g.binding=true
  try{const cls=await api(`roster/classes/${classId}/`);if(version!==g.bindVersion||classId!==g.roster_class_id)return;g.grade=cls.grade;g.schedule=cls.schedule;g.roster_version=cls.version;g.is_experimental=cls.is_experimental;g.roster_name=cls.name;if(rosterWeekly.value)await checkWechat(g)}
  catch(e){if(version===g.bindVersion)g.wechatError=(e as Error).message}
  finally{if(version===g.bindVersion)g.binding=false}
}
function isBlocked(g:Item){return blocks.value.some(b=>b.class_key===g.class_key)}
const included=computed(()=>groups.value.filter(g=>!isBlocked(g)))
const count=computed(()=>included.value.reduce((n,g)=>n+g.students.length,0))
const activeSource=ref('')
const sourceToolsOpen=ref(false)
function sourceKey(g:Item){return g.class_key||g.name}
watch(included,items=>{if(!items.some(g=>sourceKey(g)===activeSource.value))activeSource.value=items.length?sourceKey(items[0]):''},{immediate:true})
function tabKey(event:KeyboardEvent,index:number){const items=included.value;let next=index;if(event.key==='ArrowRight')next=(index+1)%items.length;else if(event.key==='ArrowLeft')next=(index-1+items.length)%items.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=items.length-1;else return;event.preventDefault();activeSource.value=sourceKey(items[next]);(event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus()}
function classRows(g:Item):Item[]{return g.prepared?.rows||g.students.map((s:Item,i:number)=>({...s,from_source:true,membership:'pending',days:g.wechatCheck?.values?.[i]??null,filled:false}))}
const generationSummary=computed(()=>included.value.reduce((result,g)=>{const s=g.prepared?.summary;if(s){result.valid+=s.valid_count;result.outside+=s.valid_outside_count;result.skipped+=s.skipped_count}return result},{valid:0,outside:0,skipped:0}))
const preparedReady=computed(()=>included.value.length>0&&included.value.every(g=>g.prepared&&!g.preparing))
const preparationErrors=computed(()=>included.value.filter(g=>g.wechatError))
const wechatTimers=new Map<Item,ReturnType<typeof setTimeout>>()
onBeforeUnmount(()=>wechatTimers.forEach(timer=>clearTimeout(timer)))
async function checkWechat(g:Item){
  const version=g.wechatVersion=(g.wechatVersion||0)+1
  g.preparing=true
  try{
    if(rosterWeekly.value&&g.roster_class_id){
      const result=await api('checkin/class-preview/',{method:'POST',body:JSON.stringify({teacher_id:teacher.value,year:year.value,term:term.value,...(period.value?{period:period.value}:{}),group:g})})
      if(version===g.wechatVersion){g.prepared=result;g.wechatError=result.errors.join(' ')}
      return
    }
    if(!String(g.wechat||'').trim()){g.wechatCheck=null;g.wechatError='';return}
    const result=await api('checkin/wechat-preview/',{method:'POST',body:JSON.stringify({teacher_id:teacher.value,paste:g.wechat,students:g.students.map((s:Item)=>({name:s.name,english_name:s.english_name||''}))})})
    if(version===g.wechatVersion){g.wechatCheck=result;g.wechatError=result.errors.join(' ')}
  }catch(e){if(version===g.wechatVersion){g.prepared=null;g.wechatCheck=null;g.wechatError=(e as Error).message}}
  finally{if(version===g.wechatVersion)g.preparing=false}
}
function scheduleWechat(g:Item){g.wechatVersion=(g.wechatVersion||0)+1;g.wechatCheck=null;g.preparing=true;clearTimeout(wechatTimers.get(g));wechatTimers.set(g,setTimeout(()=>void checkWechat(g),300))}
async function checkAllWechat(){if(props.kind==='habit')await Promise.all(included.value.map(g=>{clearTimeout(wechatTimers.get(g));return checkWechat(g)}))}
const validation=useFormValidation(()=>({
  ...(submissionAttempt.value?{year:()=>yearError(year.value),period:()=>required(period.value,props.kind==='habit'?'提交周次':'提交月份')}:{}),
  ...Object.fromEntries(groups.value.flatMap((g,index)=>isBlocked(g)?[]:[
    ...(props.meta.roster_enabled?[[`class_${index}`,()=>submissionAttempt.value?(rosterWeekly.value&&!g.roster_class_id?'请选择班级。':required(g.roster_class_id,'对应本地班级')):'']]:[]),
    ...(!rosterWeekly.value?[
      [`grade_${index}`,()=>submissionAttempt.value&&required(g.grade,'课型')|| (String(g.grade||'').trim().length>60?'课型最多 60 字。':'')],
      [`schedule_${index}`,()=>submissionAttempt.value&&required(g.schedule,'时间段')|| (String(g.schedule||'').trim().length>60?'时间段最多 60 字。':'')],
    ]:[]),
  ])),
}))
function invalidate(){preview.value=null;replace.value=false;submitted.value=null;generationError.value='';rosterAcknowledged.value=false}
function inputChanged(event:Event){invalidate();const name=(event.target as HTMLInputElement).name;validation.change(name);if(name?.startsWith('schedule_'))groups.value.forEach((_,i)=>validation.change(`schedule_${i}`))}
watch([year,term,period,rosterYear],invalidate)
watch(period,()=>{if(rosterWeekly.value)included.value.forEach(g=>{if(g.roster_class_id)scheduleWechat(g)})})
function changeTeacher(){groups.value=[];invalidate();validation.reset();sourceError.value=''}
let blocksVersion=0
async function loadBlocks(){
  if(!teacher.value)return
  const version=++blocksVersion;blockError.value=''
  try{const result=await api(`checkin/blocked-classes/?${query({teacher_id:teacher.value})}`);if(version===blocksVersion)blocks.value=result.items}
  catch(e){if(version===blocksVersion)blockError.value=(e as Error).message}
}
watch(teacher,()=>{blocks.value=[];showBlocks.value=false;void loadBlocks()},{immediate:true})
async function blockClass(g:Item){
  await run(async()=>{
    const result=await api('checkin/blocked-classes/',{method:'POST',body:JSON.stringify({teacher_id:teacher.value,class_key:g.class_key,name:g.name,source:g.source})})
    ++blocksVersion;blocks.value=[...blocks.value.filter(b=>b.class_key!==result.class_key),result]
    invalidate();validation.reset();notice.value=`已屏蔽 ${g.name}，可在“已屏蔽班级”中恢复。`
  },'block')
}
async function restoreClass(b:Item){
  await run(async()=>{
    await api(`checkin/blocked-classes/${b.id}/?${query({teacher_id:teacher.value})}`,{method:'DELETE'})
    ++blocksVersion;blocks.value=blocks.value.filter(item=>item.id!==b.id);invalidate();validation.reset()
    notice.value=`已恢复 ${b.name}。`
    if(!groups.value.some(g=>g.class_key===b.class_key)){
      if(b.source==='platform'&&props.kind==='habit'){
        const data=new FormData();data.append('kind',props.kind);data.append('teacher_id',teacher.value);data.append('class_key',b.class_key)
        const result=await api('checkin/source/',{method:'POST',body:data})
        groups.value.push(...result.groups.filter((g:Item)=>!groups.value.some(current=>current.class_key===g.class_key)))
      }else notice.value=`已恢复 ${b.name}，${b.source==='platform'?'周习惯重新取数时显示':'重新导入源文件后显示'}。`
    }
  },'block')
}
async function run(fn:()=>Promise<any>,area='source'){
  if(busy.value)return
  busy.value=true;error.value='';notice.value='';sourceError.value='';generationError.value=''
  if(area==='block')blockError.value=''
  try{await fn()}catch(e){error.value=(e as Error).message;if(area==='generate')generationError.value=(e as Error).message;else if(area==='block')blockError.value=(e as Error).message;else sourceError.value=(e as Error).message}finally{busy.value=false}
}
async function getSource(file?:File){
  validation.reset();invalidate();submissionAttempt.value=false
  await run(async()=>{groups.value=[];const data=new FormData();data.append('kind',props.kind);data.append('teacher_id',teacher.value);if(file)data.append('file',file);const result=await api('checkin/source/',{method:'POST',body:data});groups.value=result.groups;++blocksVersion;blocks.value=result.blocked_classes;if(rosterWeekly.value){await loadRosterClasses();await Promise.all(included.value.map(async g=>{const matches=rosterClasses.value.filter(c=>c.source_system==='auok'&&c.source_id===g.class_key);if(matches.length===1){g.roster_class_id=String(matches[0].id);await bindClass(g)}}))}notice.value=rosterWeekly.value?'':`已读取 ${included.value.length} 个班级、${count.value} 位学生。`})
  if(groups.value.length&&!sourceError.value)sourceToolsOpen.value=false
}
function invalidFile(message:string){groups.value=[];invalidate();notice.value='';error.value=message;sourceError.value=message}
function payload(){return {kind:props.kind,teacher_id:teacher.value,groups:included.value,year:year.value,term:term.value,period:period.value,...(props.meta.roster_enabled?{roster_year:props.kind==='monthly'?rosterYear.value:year.value,roster_term:term.value}:{})}}
async function generate(){
  submissionAttempt.value=false;validation.reset()
  if(!validation.validate(formElement.value)||!included.value.length)return
  await run(async()=>{await checkAllWechat();await downloadFile('checkin/generate/',{method:'POST',body:JSON.stringify(payload())});notice.value='Excel 已下载。'},'generate')
}
async function commitPrepared(){
  const result=await api(`teaching/batches/${preview.value!.id}/commit/`,{method:'POST',body:JSON.stringify({replace:replace.value,roster_acknowledged:rosterAcknowledged.value})})
  submitted.value=result;preview.value=null;replace.value=false
  notice.value=`提交成功，${result.count} 条数据已入库，明细和分析已更新。`
}
async function generateAndSubmit(){
  submissionAttempt.value=true
  if(!validation.validate(formElement.value)||!included.value.length)return
  invalidate()
  await run(async()=>{
    await checkAllWechat()
    preview.value=await api('checkin/generate/',{method:'POST',body:JSON.stringify({...payload(),mode:'preview'})})
    if(preview.value!.errors.length){generationError.value='请修正校验问题后重新生成提交。';return}
    if(!preview.value!.existing&&!props.meta.roster_enabled)await commitPrepared()
  },'generate')
}
async function confirmReplacement(){
  if(preview.value?.existing&&!replace.value){generationError.value='请先勾选替换本期提交。';return}
  if(!rosterWeekly.value&&preview.value?.roster_check?.requires_acknowledgement&&!rosterAcknowledged.value){generationError.value='请先核对本次名单差异并确认。';return}
  await run(commitPrepared,'generate')
}
</script>
<template>
  <form ref="formElement" class="workflow" novalidate @submit.prevent="generate" @input="inputChanged" @focusout="validation.touch(($event.target as HTMLInputElement).name)">
    <section v-if="rosterWeekly" class="panel workflow-panel checkin-source-panel">
      <div class="checkin-source-heading"><div><h2>取数与填报</h2><p>平台统计区间：{{range[0]}} 至 {{range[1]}}</p></div><div v-if="user.role==='teacher'" class="checkin-source-identity"><span v-if="groups.length">已取数 {{included.length}} 班 · {{count}} 人</span><span class="checkin-teacher">{{user.name}}</span></div><label v-else class="field">任课教师<UiSelect v-model="teacher" aria-label="任课教师" :disabled="busy" :options="[{value:'',label:'请选择教师'},...meta.upload_teachers.map((t:Item)=>({value:String(t.id),label:t.name}))]" @change="changeTeacher"/></label></div>
      <div class="checkin-context-row">
        <label class="field">提交年份<UiSelect v-model="year" name="year" aria-label="提交年份" :disabled="busy" :options="yearOptions.map(y=>({value:y,label:String(y)}))" :aria-invalid="!!validation.errors.year" aria-describedby="generation-year-error" @change="validation.change('year')"/><FieldError id="generation-year-error" :message="validation.errors.year"/></label>
        <label class="field">提交学期<UiSelect v-model="term" aria-label="提交学期" :disabled="busy" :options="meta.roster_options?.terms||[]"/></label>
        <label class="field checkin-week-choice">提交周次<UiSelect v-model="period" name="period" aria-label="提交周次" :disabled="busy" :options="[{value:'',label:'选周次'},...Array.from({length:periodCount},(_,i)=>({value:i+1,label:`第 ${i+1} 周`}))]" :aria-invalid="!!validation.errors.period" aria-describedby="generation-period-error" @change="validation.change('period')"/><FieldError id="generation-period-error" :message="validation.errors.period"/></label>
        <button type="button" class="btn primary" :disabled="busy||!meta.writable||!teacher" @click="getSource()"><LoaderCircle v-if="busy" class="spin" :size="16"/><RefreshCw v-else :size="16"/>从打卡平台取得数据</button>
        <button v-if="blocks.length||showBlocks" type="button" class="text-button checkin-block-toggle" :aria-expanded="showBlocks" aria-controls="blocked-classes" @click="showBlocks=!showBlocks">已屏蔽班级（{{blocks.length}}）</button>
      </div>
      <details class="checkin-source-tools" :open="sourceToolsOpen" @toggle="sourceToolsOpen=($event.target as HTMLDetailsElement).open"><summary>导入 Excel 与取数说明</summary><div class="checkin-source-options"><FileUpload :busy="busy" :disabled="!meta.writable||!teacher" title="导入打卡源数据 Excel" button-text="导入源数据 Excel" @select="getSource" @invalid="invalidFile"/><div><button type="button" class="text-button" :disabled="busy||!meta.writable||!teacher" @click="run(()=>downloadFile(`checkin/source-template/?${query({teacher_id:teacher,kind})}`))"><Download :size="15"/>下载源数据模板</button><p>{{meta.platform_configured?'平台已配置，可直接取数；也可使用 Excel 导入源数据。':'平台尚未配置，请使用 Excel 导入源数据。'}}</p><p>选好绑定班级后，粘贴微信接龙，核对表格再提交。名单差异仅作提示，未填记录本次不提交。</p></div></div></details>
      <p v-if="blockError" class="validation-summary" role="alert">{{blockError}}<button type="button" class="text-button" :disabled="busy" @click="loadBlocks">刷新屏蔽列表</button></p>
      <section v-if="showBlocks" id="blocked-classes" class="blocked-classes" aria-label="已屏蔽班级"><p v-if="!blocks.length">暂无已屏蔽班级。</p><div v-for="b in blocks" :key="b.id" class="blocked-class-row"><span>{{b.name}}</span><button type="button" class="btn small" :disabled="busy" @click="restoreClass(b)">恢复班级</button></div></section>
      <p v-if="sourceError" class="validation-summary" role="alert">{{sourceError}}</p>
    </section>
    <section v-else class="panel workflow-panel">
      <div class="workflow-toolbar"><div><h2>{{kind==='habit'?'上周习惯数据生成':'月课外阅读量整理'}}</h2><p>统计区间：{{range[0]}} 至 {{range[1]}}</p></div><span class="toolbar-spacer"></span><span v-if="rosterWeekly&&user.role==='teacher'" class="subtle">{{user.name}}</span><label v-else>任课教师<UiSelect v-model="teacher" aria-label="任课教师" :disabled="busy||user.role==='teacher'" :options="[{value:'',label:'请选择教师'},...(meta.upload_teachers.length?meta.upload_teachers:[{id:user.id,name:user.name}]).map((t:Item)=>({value:String(t.id),label:t.name}))]" @change="changeTeacher"/></label></div>
      <ol class="workflow-steps" aria-label="打卡数据处理步骤"><li>{{kind==='habit'?'取得打卡数据':'导入阅读量数据'}}</li><li>选择本次班级</li><li v-if="kind==='habit'">粘贴微信接龙</li><li>生成并提交／下载</li></ol>
      <div class="source-actions"><button v-if="kind==='habit'" type="button" class="btn primary" :disabled="busy||!meta.writable||!teacher" @click="getSource()"><LoaderCircle v-if="busy" class="spin" :size="16"/><RefreshCw v-else :size="16"/>从打卡平台取得数据</button><button type="button" class="text-button" :disabled="busy||!meta.writable||!teacher" @click="run(()=>downloadFile(`checkin/source-template/?${query({teacher_id:teacher,kind})}`))"><Download :size="15"/>下载源数据模板</button></div>
      <button type="button" class="text-button" :aria-expanded="showBlocks" aria-controls="blocked-classes" @click="showBlocks=!showBlocks">已屏蔽班级（{{blocks.length}}）</button>
      <p v-if="blockError" class="validation-summary" role="alert">{{blockError}}<button type="button" class="text-button" :disabled="busy" @click="loadBlocks">刷新屏蔽列表</button></p>
      <section v-if="showBlocks" id="blocked-classes" class="blocked-classes" aria-label="已屏蔽班级">
        <p v-if="!blocks.length">暂无已屏蔽班级。</p>
        <div v-for="b in blocks" :key="b.id" class="blocked-class-row"><span>{{b.name}}<small v-if="b.source==='file'">源文件班级</small></span><button type="button" class="btn small" :disabled="busy" @click="restoreClass(b)">恢复班级</button></div>
      </section>
      <p v-if="sourceError" class="validation-summary" role="alert">{{sourceError}}</p>
      <FileUpload :busy="busy" :disabled="!meta.writable" :title="kind==='habit'?'导入打卡源数据 Excel':'导入月阅读量源数据 Excel'" button-text="导入源数据 Excel" @select="getSource" @invalid="invalidFile"/>
      <details class="inline-help"><summary>取数说明</summary><p>{{kind==='monthly'?'月阅读量平台取数暂缓，当前使用 Excel 导入。':meta.platform_configured?'平台已配置，取数时检查令牌有效性。':'平台未配置，请导入源数据 Excel；连接方式见系统说明。'}}</p><p>{{rosterWeekly?'取数后直接选择已有班级，年级、时间段和班型自动带入，无需重复填写。':'取数无需先填写年级和时段；提交前请选择对应的本地班级，未知旧值需核对。'}}屏蔽按教师账号保存，周／月取数持续隐藏，可随时恢复，历史提交保留。</p></details>
    </section>
    <div v-if="rosterWeekly&&included.length" class="source-class-tabs" role="tablist" aria-label="取数班级"><button v-for="(g,index) in included" :key="sourceKey(g)" type="button" role="tab" :aria-label="g.name" :aria-selected="activeSource===sourceKey(g)" :tabindex="activeSource===sourceKey(g)?0:-1" :aria-controls="`source-panel-${groups.indexOf(g)}`" :id="`source-tab-${groups.indexOf(g)}`" :title="g.name" @click="activeSource=sourceKey(g)" @keydown="tabKey($event,index)"><span class="source-tab-name">{{g.name}}</span><small aria-hidden="true">{{!g.roster_class_id?'待绑定':g.binding||g.preparing?'核对中':g.prepared?`已填 ${g.prepared.summary.valid_count} 人`:'待核对'}}</small></button></div>
    <section v-for="(g,index) in groups" v-show="!isBlocked(g)&&(!rosterWeekly||activeSource===sourceKey(g))" :role="rosterWeekly?'tabpanel':undefined" :aria-labelledby="rosterWeekly?`source-tab-${index}`:undefined" :id="`source-panel-${index}`" :key="index" class="panel workflow-panel" :aria-label="g.name">
      <div v-if="!rosterWeekly" class="workflow-toolbar"><div><h2>{{g.roster_class_id?classLabel(g):g.name}}</h2><p>{{g.students.length}} 位学生</p></div><span class="toolbar-spacer"></span><button type="button" class="text-button" :disabled="busy" @click="blockClass(g)">永久屏蔽该班级</button></div>
      <template v-if="!isBlocked(g)">
        <div class="workflow-toolbar form-fields" :class="{'checkin-class-heading':rosterWeekly}">
          <label v-if="meta.roster_enabled" class="field" :class="{'generator-class-choice':rosterWeekly}">{{rosterWeekly?'选择绑定班级':'对应本地班级（上传必选）'}}<UiSelect wide v-model="g.roster_class_id" :name="`class_${index}`" :aria-label="`本地班级（${g.name}）`" :disabled="busy" :options="[{value:'',label:rosterWeekly?'请选择班级':'请选择本地班级'},...sortedClasses(rosterClasses).map(c=>({value:String(c.id),label:classLabel(c)}))]" :aria-invalid="!!validation.errors[`class_${index}`]" @change="bindClass(g);validation.change(`class_${index}`)"/><FieldError :id="`class-error-${index}`" :message="validation.errors[`class_${index}`]"/></label>
          <label v-if="!rosterWeekly&&!g.roster_class_id" class="field">年级（上传必填）<UiSelect v-model="g.grade" :disabled="busy||!!g.roster_class_id" :name="`grade_${index}`" :aria-label="`课型（${g.name}）`" :options="gradeOptions" :aria-invalid="!!validation.errors[`grade_${index}`]" @change="invalidate();validation.change(`grade_${index}`)"/><FieldError :id="`grade-error-${index}`" :message="validation.errors[`grade_${index}`]"/></label>
          <label v-if="!rosterWeekly&&!g.roster_class_id" class="field">时间段（上传必填）<UiSelect v-model="g.schedule" :disabled="busy||!!g.roster_class_id" :name="`schedule_${index}`" :aria-label="`时间段（${g.name}）`" :options="scheduleOptions" :aria-invalid="!!validation.errors[`schedule_${index}`]" @change="invalidate();validation.change(`schedule_${index}`)"/><FieldError :id="`schedule-error-${index}`" :message="validation.errors[`schedule_${index}`]"/></label>
          <button v-if="meta.roster_enabled" type="button" class="text-button" @click="emit('navigate','roster')">维护班级名单</button>
          <span v-if="rosterWeekly" class="checkin-source-count">接口取到 {{g.students.length}} 人</span>
          <button v-if="rosterWeekly" type="button" class="text-button checkin-block-class" :disabled="busy" title="后续取数也会隐藏，可在已屏蔽班级中恢复" @click="blockClass(g)"><EyeOff :size="15"/>屏蔽此班</button>
        </div>
        <template v-if="rosterWeekly">
          <p class="source-roster-summary" aria-live="polite"><template v-if="g.prepared">班级名单 {{g.prepared.summary.roster_count}} 人 · 已对应 {{g.prepared.summary.matched_count}} 人 · 名单内未取到 {{g.prepared.summary.missing_source_count}} 人 · 名单外 {{g.prepared.summary.outside_count}} 人</template><template v-else>{{g.preparing||g.binding?'正在对应名单…':'选择绑定班级后，在下表查看名单对应情况。'}}</template></p>
          <p class="checkin-table-hint">左右滑动表格，查看全部指标 <ArrowRight :size="13"/></p><div class="checkin-union-grid"><div class="table-scroll" :aria-busy="!!g.preparing||!!g.binding"><table class="checkin-union-table"><colgroup><col class="checkin-name-column"/><col class="checkin-match-column"/><col span="4"/></colgroup><thead><tr><th>学生</th><th>名单对应</th><th>APP 完成度</th><th>打卡天数</th><th>朗读分</th><th>填写情况</th></tr></thead><tbody><tr v-for="(s,i) in classRows(g)" :key="i" :class="{'source-not-fetched':!s.from_source}" :data-membership="s.membership"><td><span class="checkin-student" :title="[s.name,s.english_name].filter(Boolean).join(' · ')"><span>{{s.name}}</span><small v-if="s.english_name">{{s.english_name}}</small></span></td><td><span :class="['checkin-match',s.membership==='outside'?'match-outside':s.membership==='pending'?'match-pending':s.from_source?'match-inside':'match-missing']">{{s.membership==='outside'?'名单外':s.membership==='pending'?'待选班级':s.from_source?'名单内':'未取到数据'}}</span></td><td :class="{'source-empty':s.completion==null}">{{s.completion==null?'未填':s.completion+'%'}}</td><td :class="{'source-empty':s.days==null}">{{s.days??'未填'}}</td><td :class="{'source-empty':s.reading_score==null}">{{s.reading_score??'未填'}}</td><td><FillingState :filled="!!s.filled"/></td></tr></tbody></table></div><label class="field checkin-paste"><span class="checkin-paste-heading"><strong>微信接龙</strong><small v-if="g.preparing||g.binding" role="status"><LoaderCircle class="spin" :size="13"/>正在更新</small><small v-else-if="g.prepared">已填 {{g.prepared.summary.valid_count}} 人 · 未填 {{g.prepared.summary.skipped_count}} 人</small></span><textarea v-model="g.wechat" :aria-label="`微信接龙（${g.name}）`" @input="scheduleWechat(g)" :disabled="busy" rows="7" placeholder="粘贴姓名和打卡天数，例如：&#10;张同学Jack 👌7&#10;李同学Lily 👌"></textarea><span v-if="g.wechatError" class="field-error" role="alert">{{g.wechatError}}</span><small>接龙里天数空白按 0；没出现的学生仍是未填。重名请补英文名。</small></label></div>
        </template>
        <div v-else class="generator-grid"><div class="table-scroll"><table><thead><tr><th>学生姓名</th><th>英文名</th><th>{{kind==='habit'?'APP 完成度':'泛读数量'}}</th><th>{{kind==='habit'?'朗读分':'学习天数'}}</th><th v-if="kind==='habit'">未完成日期</th></tr></thead><tbody><tr v-for="(s,i) in g.students" :key="i"><td>{{s.name}}<span v-if="g.wechatCheck?.missing.includes(i)" class="student-missing-mark">接龙未填写</span></td><td>{{s.english_name||'—'}}</td><td>{{kind==='habit'?(s.completion==null?'未采集':s.completion+'%'):(s.reading_count??'未采集')}}</td><td>{{kind==='habit'?(s.reading_score??'未采集'):(s.study_days??'未采集')}}</td><td v-if="kind==='habit'" class="wrap-cell">{{s.unfinished||'—'}}</td></tr></tbody></table></div><label v-if="kind==='habit'" class="field"><strong>微信接龙<span v-if="g.wechatCheck?.missing.length"> · 还缺 {{g.wechatCheck.missing.length}} 人</span></strong><textarea v-model="g.wechat" @input="scheduleWechat(g)" :disabled="busy" rows="10" placeholder="例如：&#10;张同学Jack 👌7&#10;李同学Lily 👌"></textarea><span v-if="g.wechatError" class="field-error" role="alert">{{g.wechatError}}</span><small>按中文名匹配，重名时区分英文名；接龙中天数空白按 0，未出现在接龙中的学生保留空白。</small></label></div>
      </template>
    </section>
    <section v-if="groups.length" class="panel workflow-panel" :class="{'checkin-submit-panel':rosterWeekly}">
      <div :class="{'checkin-submit-heading':rosterWeekly}"><h2>{{rosterWeekly?'本次提交':'本次生成'}}<span v-if="rosterWeekly">全部 {{included.length}} 个未屏蔽班级</span><template v-else> · {{included.length}} 个班级</template></h2><p v-if="rosterWeekly" class="generation-scope" aria-live="polite">{{!included.length?'暂无可提交的班级，可在顶部恢复已屏蔽班级。':preparedReady?`提交已填 ${generationSummary.valid} 人（含名单外 ${generationSummary.outside} 人），未填 ${generationSummary.skipped} 人本次不提交。`:included.some(g=>!g.roster_class_id)?`还有 ${included.filter(g=>!g.roster_class_id).length} 个班级待绑定，请切换上方班级完成选择。`:preparationErrors.length?'有班级需要核对，请查看接龙旁的提示。':'正在核对接龙与名单，请稍候…'}}</p><p v-else>{{count}} 位学生</p></div>
      <p v-if="rosterWeekly&&preparationErrors.length" class="field-error" role="alert">{{preparationErrors.map(g=>g.name).join('、')}}：请核对表格旁的接龙提示后再提交。</p>
      <p v-if="!included.length" role="status">班级均已屏蔽，请在“已屏蔽班级”中恢复后再生成。</p>
      <div class="workflow-toolbar form-fields" v-if="included.length&&!rosterWeekly">
        <label class="field">提交年份<UiSelect v-model="year" name="year" aria-label="提交年份" :disabled="busy" :options="yearOptions.map(y=>({value:y,label:`${y} 年`}))" :aria-invalid="!!validation.errors.year" aria-describedby="generation-year-error" @change="validation.change('year')"/><FieldError id="generation-year-error" :message="validation.errors.year"/></label>
        <label v-if="kind==='habit'||meta.roster_enabled">{{kind==='habit'?'提交学期':'班级学期'}}<UiSelect v-model="term" :aria-label="kind==='habit'?'提交学期':'生成名单学期'" :disabled="busy" :options="meta.roster_options?.terms||[]"/></label>
        <label v-if="meta.roster_enabled&&kind==='monthly'" class="field">班级年份<UiSelect v-model="rosterYear" aria-label="生成名单年份" :disabled="busy" :options="yearOptions.map(value=>({value,label:value+' 年'}))"/></label><label class="field">{{kind==='habit'?'提交周次':'提交月份'}}<UiSelect v-model="period" name="period" :aria-label="kind==='habit'?'提交周次':'提交月份'" :disabled="busy" :options="[{value:'',label:kind==='habit'?'请选择周次':'请选择月份'},...Array.from({length:periodCount},(_,i)=>({value:i+1,label:kind==='habit'?`第 ${i+1} 周`:`${i+1} 月`}))]" :aria-invalid="!!validation.errors.period" aria-describedby="generation-period-error" @change="validation.change('period')"/><FieldError id="generation-period-error" :message="validation.errors.period"/></label>
      </div>
      <p v-if="generationError" class="validation-summary" role="alert">{{generationError}}</p>

      <details v-if="preview?.warnings.length" class="inline-help"><summary>校验说明（{{preview.warnings.length}}）</summary><ul><li v-for="w in preview.warnings" :key="w">{{w}}</li></ul></details>
      <div v-if="preview?.existing&&!preview.errors.length" class="inline-confirm">
        <label class="replace-check"><input v-model="replace" type="checkbox" :disabled="busy" @input.stop/>{{rosterWeekly?`替换 ${year}年${term}季第${period}周的整份提交（原 ${preview.existing.count} 条），旧版本保留。`:`替换本期已提交的 ${preview.existing.filename}，旧版本保留。`}}</label>
        <p v-if="rosterWeekly" class="subtle">本次未包含的原记录不会继续计入本期。</p><button type="button" class="btn primary" :disabled="busy" @click="confirmReplacement">确认替换并提交</button>
        <button type="button" class="btn" :disabled="busy" @click="invalidate">取消替换</button>
      </div>
      <template v-if="!rosterWeekly&&preview?.roster_check?.classes"><RosterCheck v-model="classMapping" :check="preview.roster_check" @manage="emit('navigate','roster')" @recheck="run(async()=>{rosterAcknowledged=false;preview=await api(`teaching/batches/${preview!.id}/recheck/`,{method:'POST',body:JSON.stringify({class_mapping:classMapping})})},'generate')"/><label v-if="preview.roster_check.requires_acknowledgement" class="replace-check"><input v-model="rosterAcknowledged" type="checkbox"/>已核对本次名单差异与实际提交范围</label><button v-if="!preview.existing&&!preview.errors.length" type="button" class="btn primary" :disabled="busy" @click="confirmReplacement">确认提交本次数据</button></template><template v-if="rosterWeekly&&preview&&!preview.errors.length&&!preview.existing"><p>已生成 {{preview.count}} 条有效记录。名单差异由老师决定，未填学生仍保留在名单中。</p><button type="button" class="btn primary" :disabled="busy" @click="confirmReplacement">确认提交 {{preview.count}} 人</button></template><details v-if="preview?.errors.length" :open="!preview.roster_check?.classes?.some((c:Item)=>c.students?.length)"><summary>查看文件校验问题（{{preview.errors.length}}）</summary><div class="import-errors"><div v-for="(e,i) in preview.errors" :key="i"><span>{{e.sheet||'文件'}}{{e.row?` · 第 ${e.row} 行`:''}}</span><p>{{e.message}}</p></div></div></details><p v-if="submitted" role="status">提交成功，{{submitted.count}} 条数据已入库。</p>
      <div class="workflow-toolbar">
        <button v-if="(!preview||preview.errors.length)&&(!rosterWeekly||!submitted)" class="btn primary" type="button" :disabled="busy||!meta.writable||!teacher||!included.length||!!submitted||(rosterWeekly&&(!preparedReady||!generationSummary.valid||preparationErrors.length>0))" @click="generateAndSubmit"><LoaderCircle v-if="busy" class="spin" :size="17"/><CheckCircle2 v-else :size="17"/>{{rosterWeekly?`生成并提交 ${generationSummary.valid} 人`:'生成并提交'}}</button>
        <button class="btn" type="submit" :disabled="busy||!meta.writable||!teacher||!included.length||(rosterWeekly&&(!preparedReady||!generationSummary.valid||preparationErrors.length>0))"><Download :size="17"/>仅生成并下载 Excel</button>
        <button v-if="submitted" class="btn" type="button" :disabled="busy" @click="run(()=>downloadFile(`teaching/batches/${submitted!.batch_id}/`),'generate')"><Download :size="17"/>下载已提交原件</button>
        <button type="button" :class="rosterWeekly?'text-button checkin-view-records':'btn'" :disabled="busy" @click="emit('navigate',kind)">查看提交与分析<ArrowRight :size="16"/></button>
      </div>
    </section>
  </form>
</template>

<style scoped>
.workflow-toolbar label.generator-class-choice :deep(.ui-select){width:300px;max-width:100%}
.checkin-source-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}
.checkin-source-heading>div:first-child{display:flex;align-items:baseline;gap:8px 14px;flex-wrap:wrap}
.checkin-source-heading h2{margin:0;font-size:18px}
.checkin-source-identity{display:flex;gap:14px;align-items:center;color:#63738a;font-size:14px}
.checkin-source-heading p{margin:0;color:#63738a;font-size:14px}
.checkin-source-heading>.field{min-width:180px}
.checkin-teacher{color:#63738a;font-size:14px;white-space:nowrap}
.checkin-context-row{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}
.checkin-context-row>.field{width:120px;flex:0 0 120px}
.checkin-context-row>.checkin-week-choice{width:145px;flex-basis:145px}
.checkin-week-choice :deep(.ui-select-trigger){scroll-margin-block:96px}
.checkin-context-row>.btn,.checkin-context-row>.checkin-block-toggle{margin-top:29px;min-height:44px}
.checkin-context-row>.btn{height:44px}
.checkin-source-tools{margin-top:14px;color:#63738a;font-size:14px}
.checkin-source-tools>summary{width:fit-content;cursor:pointer;padding:3px 0}
.checkin-source-tools[open]>summary{color:#2563eb}
.checkin-source-options{display:grid;grid-template-columns:minmax(240px,1fr) 1fr;gap:24px;align-items:center;padding-top:14px}
.checkin-source-options p{margin-top:12px;line-height:1.8;color:#63738a}
.checkin-source-options :deep(.upload-zone){margin:0;padding:20px}
.source-class-tabs{display:flex;gap:0;overflow-x:auto;max-width:100%;padding:0 16px;border:1px solid #e2e8f1;border-bottom:0;border-radius:10px 10px 0 0;background:#fff;margin-bottom:-18px;scroll-padding-inline:16px}
.source-class-tabs button{display:flex;align-items:center;gap:12px;flex:0 0 auto;border:0;border-bottom:2px solid transparent;background:transparent;padding:16px 12px;color:#63738a;max-width:400px;min-height:58px;font:inherit;text-align:left}
.source-tab-name{min-width:0;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.source-class-tabs small{font-size:12px;color:#63738a;white-space:nowrap}
.source-class-tabs button[aria-selected=true]{border-bottom-color:#2563eb;color:#2563eb;font-weight:500}
.source-class-tabs button:focus-visible{outline:2px solid #5182e7;outline-offset:-4px;border-radius:5px}
.source-class-tabs button:hover{background:#f7f9fc}
.workflow-panel[role=tabpanel]{border-top:0;border-radius:0 0 10px 10px;padding-top:18px}
.workflow-panel>.checkin-class-heading{align-items:flex-end;margin-bottom:12px;gap:12px}
.checkin-class-heading>.generator-class-choice{flex:0 1 300px;min-width:0}
.checkin-class-heading>.text-button{font-size:14px;min-height:44px}
.checkin-source-count{color:#63738a;font-size:14px;margin-left:auto;align-self:center;padding-top:24px}
.checkin-class-heading>.checkin-block-class{color:#63738a;font-size:14px;align-self:flex-end;min-height:44px}
.workflow-panel>.source-roster-summary{color:#63738a;line-height:1.7;font-size:14px;margin:0 0 16px}
.checkin-table-hint{display:none}
.checkin-union-grid{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:24px;align-items:start}
.checkin-union-grid>.table-scroll{min-width:0}
.checkin-union-table{width:100%;min-width:660px;border-collapse:collapse;table-layout:fixed}
.checkin-name-column{width:180px}.checkin-match-column{width:112px}
.checkin-union-table th{padding:11px 10px;font-size:14px!important;white-space:nowrap;font-weight:500}
.checkin-union-table td{display:table-cell;vertical-align:middle;padding:12px 10px;min-width:0;white-space:nowrap;border-bottom:1px solid #edf1f6;font-size:15px}
.checkin-student{display:flex;align-items:center;gap:7px;min-width:0;max-width:100%}
.checkin-student>span{flex:0 0 auto;max-width:65%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.checkin-student small{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#748197;font-size:13px}
.checkin-match{display:inline-flex;align-items:center;gap:5px;padding:3px 6px;border-radius:4px;font-size:13px;line-height:1.5;white-space:nowrap}
.checkin-match::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor;flex:none}
.checkin-match.match-inside{color:#34735a;background:#eef7f1}
.checkin-match.match-outside{color:#93682a;background:#fbf3e7}
.checkin-match.match-missing{color:#607895;background:#eef3f8}
.checkin-match.match-pending{color:#748094;background:#f2f4f7}
.checkin-union-table .source-empty{color:#7b8799}
.checkin-union-table td:nth-child(2),.checkin-union-table td:last-child{font-size:13px}
.source-not-fetched{background:#f8fafc}
.checkin-paste{min-width:0;position:sticky;top:88px}
.checkin-paste-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:24px}
.checkin-paste-heading strong{font-weight:500}
.checkin-paste-heading small{display:flex;align-items:center;gap:4px;color:#63738a;font-size:12px}
.checkin-paste textarea{width:100%;box-sizing:border-box;min-height:220px;resize:vertical;padding:12px;line-height:1.8}
.checkin-paste>small{font-size:13px;color:#63738a;line-height:1.8}
.checkin-submit-heading h2{font-size:17px;margin-bottom:6px}
.checkin-submit-heading h2>span{font-size:14px;font-weight:400;color:#63738a;margin-left:6px}
.checkin-submit-heading .generation-scope{font-size:14px;line-height:1.8;color:#526075;margin:0}
.checkin-submit-panel>.workflow-toolbar{padding:0;margin:14px 0 0;gap:10px}
.checkin-view-records{margin-left:auto;font-size:14px;min-height:44px}
.checkin-submit-panel>.inline-confirm{align-items:flex-start;flex-wrap:wrap;margin-top:14px;gap:10px 14px;padding:14px;background:#fffaf1;border-radius:7px}
.checkin-submit-panel .replace-check{padding-top:0;align-items:flex-start;flex-basis:100%}
.checkin-submit-panel .replace-check input{flex-shrink:0;margin-top:6px}
.checkin-submit-panel .inline-confirm>.subtle{flex-basis:100%;font-size:14px;line-height:1.7}
.checkin-submit-panel>details{margin-top:14px}
.checkin-submit-panel>[role=status]{margin-top:14px;color:#2e7c5a}
@media(max-width:1250px){.checkin-union-grid{grid-template-columns:minmax(0,1fr)}.checkin-paste{position:static}.checkin-paste textarea{min-height:150px;max-height:240px}.checkin-class-heading .checkin-source-count{margin-left:0}.checkin-class-heading>.checkin-block-class{margin-left:auto}.checkin-source-options{grid-template-columns:minmax(0,1fr)}}
@media(max-width:600px){.workflow-panel>.checkin-table-hint{display:flex;align-items:center;gap:4px;font-size:12px;color:#748197;margin:0 0 8px}.checkin-union-table th:first-child,.checkin-union-table td:first-child{position:sticky;left:0;background:#fff;z-index:1}.checkin-union-table th:first-child{background:#f3f6fb;z-index:2}.checkin-union-table .source-not-fetched td:first-child{background:#f8fafc}.source-class-tabs{padding:0 6px;scroll-padding-inline:6px}.source-class-tabs button{max-width:290px;padding:14px 10px;gap:8px;font-size:14px}.source-tab-name{max-width:200px}.workflow-toolbar label.generator-class-choice{width:100%;flex-basis:100%}.workflow-toolbar label.generator-class-choice :deep(.ui-select){width:100%}.checkin-class-heading>.text-button{min-height:32px}.checkin-source-count{padding-top:0}.checkin-source-count{font-size:13px}.checkin-source-heading{align-items:flex-start}.checkin-source-heading h2{font-size:18px}.checkin-source-heading p{font-size:13px}.checkin-context-row{gap:12px 8px}.checkin-context-row>.field{flex:1 1 85px;width:auto;min-width:0}.checkin-context-row>.checkin-week-choice{flex-basis:100px}.checkin-context-row :deep(.ui-select-trigger){padding-left:10px;padding-right:10px;gap:8px}.checkin-context-row>.btn{margin-top:0;flex:1 1 100%}.checkin-context-row>.checkin-block-toggle{margin-top:0;min-height:32px}.checkin-source-heading>.field{min-width:140px}.checkin-teacher{max-width:100px;white-space:normal}.checkin-source-identity{display:none}.checkin-submit-heading h2{flex-wrap:wrap}.checkin-submit-heading h2>span{margin-left:0}.checkin-submit-panel>.workflow-toolbar>.btn{flex:1 1 100%;justify-content:center}.checkin-view-records{margin:0;justify-content:center;width:100%}.checkin-paste textarea{max-height:none}.checkin-submit-panel>.inline-confirm>.btn{flex:1;justify-content:center}}
@media(max-width:360px){.checkin-context-row>.field{flex-basis:calc(50% - 4px)}.checkin-context-row>.checkin-week-choice{flex-basis:100%}}
</style>
