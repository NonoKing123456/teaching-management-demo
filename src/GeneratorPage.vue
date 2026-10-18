<script setup lang="ts">
import UiSelect from './UiSelect.vue'
import {ref,computed,watch,onBeforeUnmount} from 'vue'
import {Download,RefreshCw,LoaderCircle,ArrowRight,CheckCircle2} from 'lucide-vue-next'
import {api,downloadFile,query} from './api'
import FileUpload from './FileUpload.vue'
import {useFeedback} from './feedback'
import FieldError from './FieldError.vue'
import {useFormValidation,required,yearError} from './formValidation'
import {defaultTeachingPeriod,yearOptions} from './teachingCalendar'

type Item=Record<string,any>
const props=defineProps<{kind:string,user:Item,meta:Item}>(),emit=defineEmits<{navigate:[id:string]}>()
const teacher=ref(String(props.user.role==='teacher'?props.user.id:props.meta.upload_teachers[0]?.id||props.user.id))
const groups=ref<Item[]>([]),busy=ref(false),submissionAttempt=ref(false)
const blocks=ref<Item[]>([]),showBlocks=ref(false),blockError=ref('')
const {error,notice}=useFeedback()
const formElement=ref<HTMLFormElement>(),sourceError=ref(''),generationError=ref('')
const preview=ref<Item|null>(null),replace=ref(false),submitted=ref<Item|null>(null)
const range=computed(()=>props.kind==='habit'?props.meta.weekly_range:props.meta.monthly_range)
const defaults=defaultTeachingPeriod(props.kind,new Date(range.value[1]+'T12:00:00'))
const year=ref(props.kind==='monthly'?new Date(range.value[1]+'T12:00:00').getFullYear():defaults.year),term=ref(defaults.term),period=ref<number|string>(props.kind==='monthly'?new Date(range.value[1]+'T12:00:00').getMonth()+1:'')
function isBlocked(g:Item){return blocks.value.some(b=>b.class_key===g.class_key)}
const included=computed(()=>groups.value.filter(g=>!isBlocked(g)))
const count=computed(()=>included.value.reduce((n,g)=>n+g.students.length,0))
const wechatTimers=new Map<Item,ReturnType<typeof setTimeout>>()
onBeforeUnmount(()=>wechatTimers.forEach(timer=>clearTimeout(timer)))
async function checkWechat(g:Item){
  if(!String(g.wechat||'').trim()){g.wechatCheck=null;g.wechatError='';return}
  const version=g.wechatVersion=(g.wechatVersion||0)+1
  try{
    const result=await api('checkin/wechat-preview/',{method:'POST',body:JSON.stringify({teacher_id:teacher.value,paste:g.wechat,students:g.students.map((s:Item)=>({name:s.name,english_name:s.english_name||''}))})})
    if(version===g.wechatVersion){g.wechatCheck=result;g.wechatError=result.errors.join(' ')}
  }catch(e){if(version===g.wechatVersion){g.wechatCheck=null;g.wechatError=(e as Error).message}}
}
function scheduleWechat(g:Item){g.wechatVersion=(g.wechatVersion||0)+1;g.wechatCheck=null;clearTimeout(wechatTimers.get(g));wechatTimers.set(g,setTimeout(()=>void checkWechat(g),300))}
async function checkAllWechat(){if(props.kind==='habit')await Promise.all(included.value.map(g=>{clearTimeout(wechatTimers.get(g));return checkWechat(g)}))}
const validation=useFormValidation(()=>({
  ...(submissionAttempt.value?{year:()=>yearError(year.value),period:()=>required(period.value,props.kind==='habit'?'提交周次':'提交月份')}:{}),
  ...Object.fromEntries(groups.value.flatMap((g,index)=>isBlocked(g)?[]:[
    [`grade_${index}`,()=>submissionAttempt.value&&required(g.grade,'课型')|| (String(g.grade||'').trim().length>60?'课型最多 60 字。':'')],
    [`schedule_${index}`,()=>submissionAttempt.value&&required(g.schedule,'时间段')|| (String(g.schedule||'').trim().length>60?'时间段最多 60 字。':(String(g.schedule||'').trim()&&included.value.some(other=>other!==g&&String(other.schedule||'').trim()===String(g.schedule||'').trim())?'时间段与其他班级重复，请核对。':''))],
  ])),
}))
function invalidate(){preview.value=null;replace.value=false;submitted.value=null;generationError.value=''}
function inputChanged(event:Event){invalidate();const name=(event.target as HTMLInputElement).name;validation.change(name);if(name?.startsWith('schedule_'))groups.value.forEach((_,i)=>validation.change(`schedule_${i}`))}
watch([year,term,period],invalidate)
function changeTeacher(){groups.value=[];invalidate();validation.reset();sourceError.value=''}
let blocksVersion=0
async function loadBlocks(){
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
  await run(async()=>{groups.value=[];const data=new FormData();data.append('kind',props.kind);data.append('teacher_id',teacher.value);if(file)data.append('file',file);const result=await api('checkin/source/',{method:'POST',body:data});groups.value=result.groups;++blocksVersion;blocks.value=result.blocked_classes;notice.value=`已读取 ${included.value.length} 个班级、${count.value} 位学生。`})
}
function invalidFile(message:string){groups.value=[];invalidate();notice.value='';error.value=message;sourceError.value=message}
function payload(){return {kind:props.kind,teacher_id:teacher.value,groups:included.value,year:year.value,term:term.value,period:period.value}}
async function generate(){
  submissionAttempt.value=false;validation.reset()
  if(!validation.validate(formElement.value)||!included.value.length)return
  await run(async()=>{await checkAllWechat();await downloadFile('checkin/generate/',{method:'POST',body:JSON.stringify(payload())});notice.value='Excel 已下载。'},'generate')
}
async function commitPrepared(){
  const result=await api(`teaching/batches/${preview.value!.id}/commit/`,{method:'POST',body:JSON.stringify({replace:replace.value})})
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
    if(preview.value!.errors.length){generationError.value='请修正下方问题后重新生成提交。';return}
    if(!preview.value!.existing)await commitPrepared()
  },'generate')
}
async function confirmReplacement(){
  if(!replace.value){generationError.value='请先勾选替换本期提交。';return}
  await run(commitPrepared,'generate')
}
</script>
<template>
  <form ref="formElement" class="workflow" novalidate @submit.prevent="generate" @input="inputChanged" @focusout="validation.touch(($event.target as HTMLInputElement).name)">
    <section class="panel workflow-panel">
      <div class="workflow-toolbar"><div><h2>{{kind==='habit'?'上周习惯数据生成':'上月课外阅读量整理'}}</h2><p>统计区间：{{range[0]}} 至 {{range[1]}}</p></div><span class="toolbar-spacer"></span><label>任课教师<UiSelect v-model="teacher" aria-label="任课教师" :disabled="busy||user.role==='teacher'" :options="(meta.upload_teachers.length?meta.upload_teachers:[{id:user.id,name:user.name}]).map((t:Item)=>({value:String(t.id),label:t.name}))" @change="changeTeacher"/></label></div>
      <ol class="workflow-steps" aria-label="打卡数据处理步骤"><li>{{kind==='habit'?'取得打卡数据':'导入阅读量数据'}}</li><li>选择本次班级</li><li v-if="kind==='habit'">粘贴微信接龙</li><li>生成并提交／下载</li></ol>
      <div class="source-actions"><button v-if="kind==='habit'" type="button" class="btn primary" :disabled="busy||!meta.writable" @click="getSource()"><LoaderCircle v-if="busy" class="spin" :size="16"/><RefreshCw v-else :size="16"/>从打卡平台取得数据</button><button type="button" class="text-button" :disabled="busy||!meta.writable" @click="run(()=>downloadFile(`checkin/source-template/?${query({teacher_id:teacher,kind})}`))"><Download :size="15"/>下载源数据模板</button></div>
      <button type="button" class="text-button" :aria-expanded="showBlocks" aria-controls="blocked-classes" @click="showBlocks=!showBlocks">已屏蔽班级（{{blocks.length}}）</button>
      <p v-if="blockError" class="validation-summary" role="alert">{{blockError}}<button type="button" class="text-button" :disabled="busy" @click="loadBlocks">刷新屏蔽列表</button></p>
      <section v-if="showBlocks" id="blocked-classes" class="blocked-classes" aria-label="已屏蔽班级">
        <p v-if="!blocks.length">暂无已屏蔽班级。</p>
        <div v-for="b in blocks" :key="b.id" class="blocked-class-row"><span>{{b.name}}<small v-if="b.source==='file'">源文件班级</small></span><button type="button" class="btn small" :disabled="busy" @click="restoreClass(b)">恢复班级</button></div>
      </section>
      <p v-if="sourceError" class="validation-summary" role="alert">{{sourceError}}</p>
      <FileUpload :busy="busy" :disabled="!meta.writable" :title="kind==='habit'?'导入打卡源数据 Excel':'导入月阅读量源数据 Excel'" button-text="导入源数据 Excel" @select="getSource" @invalid="invalidFile"/>
      <details class="inline-help"><summary>取数说明</summary><p>{{kind==='monthly'?'月阅读量平台取数暂缓，当前使用 Excel 导入。':meta.platform_configured?'平台已配置，取数时检查令牌有效性。':'平台未配置，请导入源数据 Excel；连接方式见系统说明。'}}</p><p>仅下载时课型、时间段可留空；生成并提交时须补齐。屏蔽按教师账号保存，周／月取数持续隐藏，可随时恢复，历史提交保留。</p></details>
    </section>
    <section v-for="(g,index) in groups" v-show="!isBlocked(g)" :key="index" class="panel workflow-panel" :aria-label="g.name">
      <div class="workflow-toolbar"><div><h2>{{g.name}}</h2><p>{{g.students.length}} 位学生</p></div><span class="toolbar-spacer"></span><button type="button" class="text-button" :disabled="busy" @click="blockClass(g)">永久屏蔽该班级</button></div>
      <template v-if="!isBlocked(g)">
        <div class="workflow-toolbar form-fields">
          <label class="field">课型（上传必填）<input v-model="g.grade" :disabled="busy" :name="`grade_${index}`" :aria-label="`课型（${g.name}）`" placeholder="例如：六年级" maxlength="60" :aria-invalid="!!validation.errors[`grade_${index}`]" :aria-describedby="validation.errors[`grade_${index}`]?`grade-error-${index}`:undefined"/><FieldError :id="`grade-error-${index}`" :message="validation.errors[`grade_${index}`]"/></label>
          <label class="field">时间段（上传必填）<input v-model="g.schedule" :disabled="busy" :name="`schedule_${index}`" :aria-label="`时间段（${g.name}）`" placeholder="例如：六下" maxlength="60" :aria-invalid="!!validation.errors[`schedule_${index}`]" :aria-describedby="validation.errors[`schedule_${index}`]?`schedule-error-${index}`:undefined"/><FieldError :id="`schedule-error-${index}`" :message="validation.errors[`schedule_${index}`]"/></label>
        </div>
        <div class="generator-grid"><div class="table-scroll"><table><thead><tr><th>学生姓名</th><th>英文名</th><th>{{kind==='habit'?'APP 完成度':'泛读数量'}}</th><th>{{kind==='habit'?'朗读分':'学习天数'}}</th><th v-if="kind==='habit'">未完成日期</th></tr></thead><tbody><tr v-for="(s,i) in g.students" :key="i"><td>{{s.name}}<span v-if="g.wechatCheck?.missing.includes(i)" class="student-missing-mark">接龙未填写</span></td><td>{{s.english_name||'—'}}</td><td>{{kind==='habit'?(s.completion==null?'未采集':s.completion+'%'):(s.reading_count??'未采集')}}</td><td>{{kind==='habit'?(s.reading_score??'未采集'):(s.study_days??'未采集')}}</td><td v-if="kind==='habit'" class="wrap-cell">{{s.unfinished||'—'}}</td></tr></tbody></table></div><label v-if="kind==='habit'" class="field"><strong>微信接龙<span v-if="g.wechatCheck?.missing.length"> · 还缺 {{g.wechatCheck.missing.length}} 人</span></strong><textarea v-model="g.wechat" @input="scheduleWechat(g)" :disabled="busy" rows="10" placeholder="例如：&#10;张同学Jack 👌7&#10;李同学Lily 👌"></textarea><span v-if="g.wechatError" class="field-error" role="alert">{{g.wechatError}}</span><small>按中文名匹配，重名时区分英文名；接龙中天数空白按 0，未出现在接龙中的学生保留空白。</small></label></div>
      </template>
    </section>
    <section v-if="groups.length" class="panel workflow-panel">
      <h2>本次生成 {{included.length}} 个班级 · {{count}} 位学生</h2>
      <p v-if="!included.length" role="status">班级均已屏蔽，请在“已屏蔽班级”中恢复后再生成。</p>
      <div class="workflow-toolbar form-fields" v-if="included.length">
        <label class="field">提交年份<UiSelect v-model="year" name="year" aria-label="提交年份" :disabled="busy" :options="yearOptions.map(y=>({value:y,label:`${y} 年`}))" :aria-invalid="!!validation.errors.year" aria-describedby="generation-year-error" @change="validation.change('year')"/><FieldError id="generation-year-error" :message="validation.errors.year"/></label>
        <label v-if="kind==='habit'">提交学期<UiSelect v-model="term" aria-label="提交学期" :disabled="busy" :options="['春','夏','秋'].map(value=>({value,label:value}))"/></label>
        <label class="field">{{kind==='habit'?'提交周次':'提交月份'}}<UiSelect v-model="period" name="period" :aria-label="kind==='habit'?'提交周次':'提交月份'" :disabled="busy" :options="[{value:'',label:kind==='habit'?'请选择周次':'请选择月份'},...Array.from({length:meta.kinds[kind].periods},(_,i)=>({value:i+1,label:kind==='habit'?`第 ${i+1} 周`:`${i+1} 月`}))]" :aria-invalid="!!validation.errors.period" aria-describedby="generation-period-error" @change="validation.change('period')"/><FieldError id="generation-period-error" :message="validation.errors.period"/></label>
      </div>
      <p v-if="generationError" class="validation-summary" role="alert">{{generationError}}</p>
      <div v-if="preview?.errors.length" class="import-errors"><div v-for="(e,i) in preview.errors" :key="i"><span>{{e.sheet||'文件'}}{{e.row?` · 第 ${e.row} 行`:''}}</span><p>{{e.message}}</p></div></div>
      <details v-if="preview?.warnings.length" class="inline-help"><summary>校验说明（{{preview.warnings.length}}）</summary><ul><li v-for="w in preview.warnings" :key="w">{{w}}</li></ul></details>
      <div v-if="preview?.existing&&!preview.errors.length" class="inline-confirm">
        <label class="replace-check"><input v-model="replace" type="checkbox" :disabled="busy" @input.stop/>替换本期已提交的 {{preview.existing.filename}}，旧版本保留。</label>
        <button type="button" class="btn primary" :disabled="busy" @click="confirmReplacement">确认替换并提交</button>
        <button type="button" class="btn" :disabled="busy" @click="invalidate">取消替换</button>
      </div>
      <p v-if="submitted" role="status">提交成功，{{submitted.count}} 条数据已入库。</p>
      <div class="workflow-toolbar">
        <button v-if="!preview?.existing||preview.errors.length" class="btn primary" type="button" :disabled="busy||!meta.writable||!included.length||!!submitted" @click="generateAndSubmit"><LoaderCircle v-if="busy" class="spin" :size="17"/><CheckCircle2 v-else :size="17"/>生成并提交</button>
        <button class="btn" type="submit" :disabled="busy||!meta.writable||!included.length"><Download :size="17"/>仅生成并下载 Excel</button>
        <button v-if="submitted" class="btn" type="button" :disabled="busy" @click="run(()=>downloadFile(`teaching/batches/${submitted!.batch_id}/`),'generate')"><Download :size="17"/>下载已提交原件</button>
        <button type="button" class="btn" :disabled="busy" @click="emit('navigate',kind)">查看提交与分析<ArrowRight :size="16"/></button>
      </div>
    </section>
  </form>
</template>
