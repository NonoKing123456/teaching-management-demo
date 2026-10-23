<script setup lang="ts">
import {ref,computed,watch,onMounted,nextTick} from 'vue'
import {Plus,Upload,ArrowLeft,History,UsersRound,X} from 'lucide-vue-next'
import UiSelect from './UiSelect.vue'
import {classLabel,sortedClasses} from './classPresentation'
import {studentLabel} from './studentPresentation'
import FieldError from './FieldError.vue'
import RosterImportDialog from './RosterImportDialog.vue'
import {api,query,downloadFile} from './api'
import {useFormValidation,required,yearError} from './formValidation'
import {defaultTeachingPeriod,yearOptions} from './teachingCalendar'

type Item=Record<string,any>
const props=defineProps<{user:Item,meta:Item}>()
const calendar=defaultTeachingPeriod('habit'),year=ref(String(calendar.year)),term=ref(calendar.term),teacher=ref(props.user.role==='teacher'?String(props.user.id):''),archived=ref('false'),search=ref('')
const classes=ref<Item[]>([]),selected=ref<Item|null>(null),history=ref<Item[]>([]),showHistory=ref(false),loading=ref(false),saving=ref(false),error=ref(''),notice=ref(''),importing=ref(false)
const dialog=ref<HTMLDialogElement>(),formElement=ref<HTMLFormElement>(),mode=ref('class'),editing=ref<Item|null>(null),student=ref<Item|null>(null),existing=ref<Item[]>([]),targetClasses=ref<Item[]>([])
const form=ref<Item>({}),formError=ref(''),studentSearch=ref(''),studentTotal=ref(0)
const options=computed(()=>props.meta.roster_options)
const writable=computed(()=>['manager','teacher'].includes(props.user.role)),canArchive=computed(()=>props.user.role==='manager')
const teacherOptions=computed(()=>props.meta.teachers.map((t:Item)=>({value:String(t.id),label:t.name})))
const title=computed(()=>({class:editing.value?'编辑班级':'新建班级',student:'添加学生',identity:'修改学生信息',transfer:'转班',archive:'归档班级',remove:'移出学生'} as Item)[mode.value])
const validation=useFormValidation(():Record<string,()=>string>=>{
 if(mode.value==='class')return {year:()=>yearError(form.value.year),term:()=>required(form.value.term,'学期'),teacher_id:()=>required(form.value.teacher_id,'负责教师'),grade:()=>required(form.value.grade,'年级'),schedule:()=>required(form.value.schedule,'上课时间段')}
 if(mode.value==='student')return form.value.method==='existing'?{student_id:()=>required(form.value.student_id,'已有学生')}:{name:()=>required(form.value.name,'学生姓名')}
 if(mode.value==='identity')return {name:()=>required(form.value.name,'学生姓名')}
 if(mode.value==='transfer')return {target_class_id:()=>required(form.value.target_class_id,'转入班级')}
 return {}
})
let loadVersion=0
async function load(){
 const version=++loadVersion;loading.value=true;error.value=''
 try{const data=await api(`roster/classes/?${query({year:year.value,term:term.value,teacher_id:teacher.value,archived:archived.value,search:search.value,include_incomplete:'true'})}`);if(version===loadVersion)classes.value=data.items}
 catch(e){if(version===loadVersion)error.value=(e as Error).message}finally{if(version===loadVersion)loading.value=false}
}
async function openClass(item:Item){error.value='';showHistory.value=false;try{selected.value=await api(`roster/classes/${item.id}/`)}catch(e){error.value=(e as Error).message}}
async function historyForClass(){if(!selected.value)return;try{const data=await api(`roster/classes/${selected.value.id}/history/`);history.value=data.items;showHistory.value=!showHistory.value}catch(e){error.value=(e as Error).message}}
function date(value:string){return new Date(value).toLocaleString('zh-CN',{hour12:false})}
function termLabel(value:string){return options.value.terms.find((t:Item)=>t.value===value)?.label||value||'待补齐'}
async function lookupStudents(){try{const data=await api(`roster/students/?${query({search:studentSearch.value})}`);existing.value=data.items;studentTotal.value=data.total}catch(e){formError.value=(e as Error).message}}
async function open(modeValue:string,item:Item|null=null){
 mode.value=modeValue;formError.value='';validation.reset();editing.value=modeValue==='class'?item:null;student.value=item
 form.value=modeValue==='class'?{year:String(item?.year||year.value||calendar.year),term:item?.term||term.value||calendar.term,grade:options.value.grades.includes(item?.grade)?item?.grade:'',schedule:options.value.schedules.includes(item?.schedule)?item?.schedule:'',teacher_id:String(item?.teacher_id||teacher.value||''),is_experimental:item?.is_experimental||false}:
 modeValue==='identity'?{name:item?.name||'',english_name:item?.english_name||''}:{name:'',english_name:'',method:'new',student_id:'',target_class_id:'',new_identity_confirmed:false}
 if(props.user.role==='teacher')form.value.teacher_id=String(props.user.id)
 if(modeValue==='student'){
  studentSearch.value='';await lookupStudents()
 }
 if(modeValue==='transfer'){
  try{targetClasses.value=(await api('roster/classes/?archived=false')).items.filter((c:Item)=>c.id!==selected.value?.id)}catch(e){formError.value=(e as Error).message}
 }
 dialog.value?.showModal();await nextTick();dialog.value?.querySelector<HTMLInputElement>('input:not([type=checkbox])')?.focus()
}
async function save(){
 if(saving.value||!validation.validate(formElement.value))return
 saving.value=true;formError.value=''
 try{
  const cls=selected.value
  if(mode.value==='class'){
   const data={...form.value,version:editing.value?.version}
   const result=await api(editing.value?`roster/classes/${editing.value.id}/`:'roster/classes/',{method:editing.value?'PATCH':'POST',body:JSON.stringify(data)})
   if(selected.value?.id===result.id)selected.value=result
  }else if(mode.value==='student'){
   selected.value=await api(`roster/classes/${cls!.id}/students/`,{method:'POST',body:JSON.stringify({version:cls!.version,...(form.value.method==='existing'?{student_id:form.value.student_id}:{name:form.value.name,english_name:form.value.english_name,new_identity_confirmed:form.value.new_identity_confirmed})})})
  }else if(mode.value==='identity'){
   await api(`roster/students/${student.value!.id}/`,{method:'PATCH',body:JSON.stringify(form.value)});await openClass(cls!)
  }else if(mode.value==='transfer'){
   const target=targetClasses.value.find(c=>String(c.id)===String(form.value.target_class_id))!
   await api(`roster/classes/${cls!.id}/students/${student.value!.enrollment_id}/transfer/`,{method:'POST',body:JSON.stringify({version:cls!.version,target_class_id:target.id,target_version:target.version})});await openClass(cls!)
  }else if(mode.value==='remove'){
   selected.value=await api(`roster/classes/${cls!.id}/students/${student.value!.enrollment_id}/`,{method:'DELETE',body:JSON.stringify({version:cls!.version})})
  }else if(mode.value==='archive'){
   selected.value=await api(`roster/classes/${cls!.id}/`,{method:'DELETE',body:JSON.stringify({version:cls!.version})})
  }
  dialog.value?.close();notice.value='已保存，名单版本和操作历史已更新。';showHistory.value=false;await load()
 }catch(e){formError.value=(e as Error).message}finally{saving.value=false}
}
async function imported(){importing.value=false;notice.value='名单已导入。未出现在文件中的旧学生保持不变。';await load()}
watch([year,term,teacher,archived],()=>{selected.value=null;void load()})
onMounted(load)
</script>

<template>
 <div class="workflow roster-page">
  <p v-if="error" class="validation-summary" role="alert">{{error}}</p><p v-if="notice" class="success-banner" role="status">{{notice}}</p>
  <section v-if="!selected" class="panel">
   <div class="workflow-toolbar"><label>年份<UiSelect v-model="year" aria-label="名单年份" :options="[{value:'',label:'全部年份'},...yearOptions.map(y=>({value:String(y),label:y+' 年'}))]"/></label><label>学期<UiSelect v-model="term" aria-label="名单学期" :options="[{value:'',label:'全部学期'},...options.terms]"/></label><label v-if="user.role!=='teacher'">教师<UiSelect v-model="teacher" aria-label="名单教师" :options="[{value:'',label:'全部教师'},...teacherOptions]"/></label><label>班级状态<UiSelect v-model="archived" aria-label="班级状态" :options="[{value:'false',label:'有效班级'},{value:'true',label:'已归档'},{value:'all',label:'全部'}]"/></label><span class="toolbar-spacer"></span><button v-if="writable" class="btn" @click="importing=true"><Upload :size="16"/>导入名单</button><button v-if="writable" class="btn primary" @click="open('class')"><Plus :size="16"/>新建班级</button></div>
   <form class="workflow-toolbar" @submit.prevent="load"><label class="search-field"><input v-model="search" placeholder="班级或学生姓名" aria-label="查询名单"/></label><button class="btn" :disabled="loading">查询</button><span>共 {{classes.length}} 个班级</span></form>
   <div class="table-scroll"><table><thead><tr><th>班级</th><th>年份／学期</th><th>教师</th><th>学生</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="item in sortedClasses(classes)" :key="item.id" :data-class-id="item.id"><td><strong>{{classLabel(item)}}</strong></td><td>{{item.year||'待补齐'}}／{{termLabel(item.term)}}</td><td>{{item.teacher}}</td><td>{{item.student_count}} 人</td><td><span v-if="item.archived">已归档</span><span v-else-if="item.missing_fields.length" class="roster-pending">待补齐：{{item.missing_fields.map((f:Item)=>f.label).join('、')}}</span><span v-else>有效</span></td><td><button class="text-button" @click="openClass(item)">查看名单</button></td></tr></tbody></table><p v-if="!classes.length&&!loading" class="empty-state compact">当前没有班级，可导入名单或新建班级。</p></div>
  </section>
  <section v-else class="panel workflow-panel">
   <div class="workflow-toolbar"><button class="text-button" @click="selected=null"><ArrowLeft :size="16"/>返回班级列表</button><span class="toolbar-spacer"></span><button class="btn" @click="historyForClass"><History :size="16"/>名单历史</button><button v-if="writable&&!selected.archived" class="btn" @click="open('class',selected)">编辑班级</button><button v-if="canArchive&&!selected.archived" class="text-button danger-text" @click="open('archive')">归档班级</button></div>
   <details v-if="selected.source_name" class="roster-source"><summary>来源信息</summary><p>导入或旧系统原班名：{{selected.source_name}}</p></details><div class="roster-heading"><h2>{{classLabel(selected)}}</h2><p>{{selected.teacher}} · {{selected.year||'待补齐年份'}}年{{termLabel(selected.term)}} · 名单版本 {{selected.version}}</p><p v-if="selected.course!==selected.grade">原课型：{{selected.course}}（保留原信息）</p><p v-if="selected.archived" class="info-banner">已归档，当前成员关系已结束；历史名单及教学记录仍可查询。</p></div>
   <section v-if="showHistory" class="roster-history" aria-label="名单历史"><details v-for="item in history" :key="item.id"><summary>版本 {{item.version}} · {{date(item.created_at)}} · {{item.actor}} · {{item.snapshot.students?.length||0}} 人</summary><p>{{item.snapshot.name}} · {{item.snapshot.grade}} · {{item.snapshot.schedule}} · {{item.snapshot.is_experimental?'实验班':'普通班'}}</p><ul><li v-for="s in item.snapshot.students||[]" :key="s.id">{{s.name}} {{s.english_name}}</li></ul><button v-if="item.source_import_id&&writable" class="text-button" @click="downloadFile(`roster/imports/${item.source_import_id}/original/`)">下载名单导入原件</button></details></section>
   <div class="workflow-toolbar"><h3>当前名单 {{selected.students.length}} 人</h3><span class="toolbar-spacer"></span><button v-if="writable&&!selected.archived" class="btn primary" @click="open('student')"><UsersRound :size="16"/>添加学生</button></div>
   <div class="table-scroll"><table><thead><tr><th>学生姓名</th><th>英文名</th><th>操作</th></tr></thead><tbody><tr v-for="item in selected.students" :key="item.id"><td>{{item.name}}</td><td>{{item.english_name||'—'}}</td><td><div v-if="writable&&!selected.archived" class="roster-actions"><button class="text-button" @click="open('identity',item)">修改信息</button><button class="text-button" @click="open('transfer',item)">转班</button><button class="text-button danger-text" @click="open('remove',item)">移出</button></div></td></tr></tbody></table><p v-if="!selected.students.length" class="empty-state compact">当前名单为空。</p></div>
  </section>
  <dialog ref="dialog" class="roster-dialog" @cancel="saving&&$event.preventDefault()"><form ref="formElement" novalidate @submit.prevent="save" @input="validation.change(($event.target as HTMLInputElement).name)" @focusout="validation.touch(($event.target as HTMLInputElement).name)"><header><h2>{{title}}</h2><button type="button" class="icon-button" aria-label="关闭窗口" :disabled="saving" @click="dialog?.close()"><X :size="20"/></button></header><div class="roster-form">
   <template v-if="mode==='class'">
    <p class="class-auto-label">{{classLabel(form)}}<small>选择时段和年级后自动生成，无需起班名。</small></p>
    <div class="roster-form-grid"><label class="field">年份<UiSelect v-model="form.year" name="year" aria-label="班级年份" :options="yearOptions.map(y=>({value:String(y),label:y+' 年'}))" @change="validation.change('year')"/><FieldError :id="`roster-${mode}-year`" :message="validation.errors.year"/></label><label class="field">学期<UiSelect v-model="form.term" name="term" aria-label="班级学期" :options="options.terms" @change="validation.change('term')"/><FieldError :id="`roster-${mode}-term`" :message="validation.errors.term"/></label><label class="field">年级<UiSelect v-model="form.grade" name="grade" aria-label="班级年级" :options="[{value:'',label:'请选择年级'},...options.grades.map((v:string)=>({value:v,label:v}))]" @change="validation.change('grade')"/><FieldError :id="`roster-${mode}-grade`" :message="validation.errors.grade"/></label><label class="field">上课时间段<UiSelect v-model="form.schedule" name="schedule" aria-label="班级时间段" :options="[{value:'',label:'请选择时间段'},...options.schedules.map((v:string)=>({value:v,label:v}))]" @change="validation.change('schedule')"/><FieldError :id="`roster-${mode}-schedule`" :message="validation.errors.schedule"/></label></div>
    <label v-if="user.role==='manager'" class="field">负责教师<UiSelect v-model="form.teacher_id" name="teacher_id" aria-label="班级负责教师" :options="[{value:'',label:'请选择教师'},...teacherOptions]" @change="validation.change('teacher_id')"/><FieldError :id="`roster-${mode}-teacher_id`" :message="validation.errors.teacher_id"/></label><label class="roster-check"><input v-model="form.is_experimental" type="checkbox"/>实验班</label>
   </template>
   <template v-else-if="mode==='student'||mode==='identity'"><label v-if="mode==='student'" class="field">添加方式<UiSelect v-model="form.method" aria-label="添加方式" :options="[{value:'new',label:'新建学生身份'},{value:'existing',label:'加入已有学生'}]"/></label><template v-if="form.method!=='existing'"><label class="field">学生姓名<input v-model="form.name" name="name" required maxlength="60"/><FieldError :id="`roster-${mode}-name`" :message="validation.errors.name"/></label><label class="field">英文名（选填）<input v-model="form.english_name" name="english_name" maxlength="60"/></label><label v-if="mode==='student'" class="roster-check"><input v-model="form.new_identity_confirmed" type="checkbox"/>如有同名身份，确认这是另一名新生</label></template><div v-else><label class="field">查找已有学生<input v-model="studentSearch" placeholder="姓名或英文名" aria-label="查找已有学生" @keydown.enter.prevent="lookupStudents"/></label><button class="text-button" type="button" @click="lookupStudents">查询学生</button><span v-if="studentTotal>existing.length">共 {{studentTotal}} 人，请搜索缩小范围。</span><label class="field">已有学生<UiSelect v-model="form.student_id" name="student_id" aria-label="已有学生" :options="[{value:'',label:'请选择学生'},...existing.map(s=>({value:s.id,label:studentLabel(s)}))]"/><FieldError :id="`roster-${mode}-student_id`" :message="validation.errors.student_id"/></label></div></template>
   <label v-else-if="mode==='transfer'" class="field">将 {{student?.name}} 转入<UiSelect v-model="form.target_class_id" name="target_class_id" wide aria-label="转入班级" :options="[{value:'',label:'请选择班级'},...sortedClasses(targetClasses).map(c=>({value:String(c.id),label:classLabel(c,{teacher:user.role==='manager',term:true,teachers:meta.teachers})}))]"/><FieldError :id="`roster-${mode}-target_class_id`" :message="validation.errors.target_class_id"/></label>
   <p v-else-if="mode==='archive'">归档 {{selected?.name}}？当前成员关系会结束，历史名单、提交和原件全部保留。</p><p v-else-if="mode==='remove'">将 {{student?.name}} 移出 {{selected?.name}}？学生身份和历史教学数据会保留。</p>
   </div><footer><p v-if="formError" class="validation-summary" role="alert">{{formError}}</p><button type="button" class="btn" :disabled="saving" @click="dialog?.close()">取消</button><button class="btn primary" :disabled="saving">{{saving?'正在保存…':'确认保存'}}</button></footer></form></dialog>
  <RosterImportDialog v-if="importing" :user="user" :meta="meta" :teacher="teacher" :year="year||String(calendar.year)" :term="term||calendar.term" @close="importing=false" @saved="imported"/>
 </div>
</template>

<style scoped>
.class-auto-label{font-weight:600;line-height:1.8}.class-auto-label small{display:block;color:#667085;font-weight:400}.roster-source{margin:14px 0;color:#667085}.roster-heading p{margin:8px 0;line-height:1.7;color:#526075}.roster-actions{display:flex;gap:16px}.roster-tag{display:inline-block;margin-left:8px;padding:2px 7px;font-size:13px;color:#527065;background:#edf5f1;border-radius:4px}.roster-pending{color:#956c42}.roster-history{padding:16px;background:#f8fafc;border-radius:8px}.roster-history details{padding:10px 0;border-bottom:1px solid #e7ecf3}.roster-history summary{cursor:pointer}.roster-history ul{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;list-style:none;padding:0}.roster-history small{display:block;color:#667085;overflow-wrap:anywhere}.roster-dialog{width:min(640px,calc(100% - 24px));max-height:90dvh;padding:0;border:1px solid #e2e8f1;border-radius:12px;box-shadow:0 20px 70px #17263a30}.roster-dialog::backdrop{background:#17263a55}.roster-dialog header{display:flex;align-items:center;justify-content:space-between;padding:20px;border-bottom:1px solid #edf1f6}.roster-form{display:flex;flex-direction:column;gap:20px;padding:24px}.roster-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.roster-form .field input,.roster-form .ui-select{width:100%}.roster-check{display:flex;gap:9px;align-items:center;line-height:1.7}.roster-dialog footer{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;padding:18px 24px;border-top:1px solid #edf1f6}.roster-dialog footer .validation-summary{flex-basis:100%}@media(max-width:600px){.roster-form-grid{grid-template-columns:1fr}.roster-form{padding:20px}}
</style>
