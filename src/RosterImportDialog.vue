<script setup lang="ts">
import {ref,computed,onMounted,watch} from 'vue'
import {X} from 'lucide-vue-next'
import UiSelect from './UiSelect.vue'
import {classLabel,sortedClasses} from './classPresentation'
import {studentLabel,isStudentIdentifierHeader} from './studentPresentation'
import FileUpload from './FileUpload.vue'
import {api,query} from './api'
import {yearOptions} from './teachingCalendar'
type Item=Record<string,any>
const props=defineProps<{user:Item,meta:Item,teacher:string,year:string,term:string}>(),emit=defineEmits<{close:[],saved:[]}>()
const dialog=ref<HTMLDialogElement>(),teacher=ref(props.user.role==='teacher'?String(props.user.id):props.teacher),year=ref(props.year),term=ref(props.term)
const busy=ref(false),error=ref(''),fileInfo=ref<Item|null>(null),sheet=ref(''),header=ref(1),mapping=ref<Item>({}),defaults=ref<Item>({grade:'',schedule:'',is_experimental:false})
const preview=ref<Item|null>(null),resolutions=ref<Item>({}),classes=ref<Item[]>([]),dirty=ref(false),acknowledged=ref(false)
const options=computed(()=>props.meta.roster_options),selectedSheet=computed(()=>fileInfo.value?.sheets.find((s:Item)=>s.name===sheet.value))
const columns=computed(()=>[{value:'',label:'不使用此列'},...(selectedSheet.value?.rows[header.value-1]||[]).map((label:string,index:number)=>({value:String(index),label:`${index+1} 列 · ${label||'（空表头）'}`,hidden:isStudentIdentifierHeader(label)})).filter((column:Item)=>!column.hidden)])
watch([sheet,header,()=>fileInfo.value?.id],()=>{const index=(selectedSheet.value?.rows[header.value-1]||[]).findIndex(isStudentIdentifierHeader);mapping.value.student_source_id=index<0?'':String(index)})
function invalidate(){dirty.value=true;acknowledged.value=false}
async function inspect(file:File){
 error.value='';if(!teacher.value||!year.value||!term.value){error.value='请先选择负责教师、年份和学期，再导入文件。';return}
 busy.value=true
 try{
  const data=new FormData();data.append('file',file);data.append('teacher_id',teacher.value);data.append('year',year.value);data.append('term',term.value)
  fileInfo.value=await api('roster/imports/',{method:'POST',body:data});sheet.value=fileInfo.value!.sheets[0]?.name||'';mapping.value={};preview.value=null;resolutions.value={};dirty.value=true
  classes.value=(await api(`roster/classes/?${query({teacher_id:teacher.value,year:year.value,term:term.value,archived:'false'})}`)).items
 }catch(e){error.value=(e as Error).message}finally{busy.value=false}
}
async function check(){
 if(!fileInfo.value||busy.value)return
 busy.value=true;error.value=''
 try{
  preview.value=await api(`roster/imports/${fileInfo.value.id}/preview/`,{method:'POST',body:JSON.stringify({sheet:sheet.value,header_row:header.value,mapping:mapping.value,defaults:defaults.value,classes:resolutions.value})})
  for(const group of preview.value!.groups){
   const old=resolutions.value[group.key]||{}
   resolutions.value[group.key]={class_id:group.class_id?String(group.class_id):'',grade:options.value.grades.includes(group.grade)?group.grade:'',schedule:options.value.schedules.includes(group.schedule)?group.schedule:'',is_experimental:group.is_experimental,create_new:false,students:{},...old}
  }
  dirty.value=false;acknowledged.value=false
 }catch(e){error.value=(e as Error).message}finally{busy.value=false}
}
async function save(){
 if(!preview.value||dirty.value||preview.value.errors.length||!acknowledged.value){error.value='请重新校验并核对班级、学生身份后确认。';return}
 busy.value=true;error.value=''
 try{await api(`roster/imports/${fileInfo.value!.id}/commit/`,{method:'POST',body:JSON.stringify({preview_token:preview.value.preview_token,acknowledged:true})});emit('saved')}
 catch(e){error.value=(e as Error).message}finally{busy.value=false}
}
onMounted(()=>dialog.value?.showModal())
</script>

<template>
 <dialog ref="dialog" class="roster-import" @cancel="busy?$event.preventDefault():emit('close')">
  <header><h2>导入班级和学生名单</h2><button type="button" class="icon-button" :disabled="busy" aria-label="关闭名单导入" @click="emit('close')"><X :size="20"/></button></header>
  <div class="import-body">
   <p>先选教师和学期，再对应学生、年级、时段等列；没有原班名列也可以导入。</p>
   <div class="workflow-toolbar"><label v-if="user.role==='manager'">负责教师<UiSelect v-model="teacher" aria-label="导入名单教师" :disabled="busy||!!fileInfo" :options="[{value:'',label:'请选择教师'},...meta.teachers.map((t:Item)=>({value:String(t.id),label:t.name}))]"/></label><label>年份<UiSelect v-model="year" aria-label="导入名单年份" :disabled="busy||!!fileInfo" :options="yearOptions.map(y=>({value:String(y),label:y+' 年'}))"/></label><label>学期<UiSelect v-model="term" aria-label="导入名单学期" :disabled="busy||!!fileInfo" :options="options.terms"/></label></div>
   <FileUpload :busy="busy" title="校宝导出或其他名单 Excel" button-text="选择名单文件" @select="inspect" @invalid="error=$event"/>
   <template v-if="fileInfo">
    <div class="workflow-toolbar"><label>工作表<UiSelect v-model="sheet" aria-label="名单工作表" :disabled="busy" :options="fileInfo.sheets.map((s:Item)=>({value:s.name,label:s.name}))" @change="mapping={};preview=null;invalidate()"/></label><label>表头行<UiSelect v-model="header" aria-label="名单表头行" :disabled="busy" :options="selectedSheet.rows.map((_:Item,i:number)=>({value:i+1,label:`第 ${i+1} 行`}))" @change="invalidate"/></label></div>
    <div class="mapping-grid"><label v-for="field in fileInfo.fields.filter((f:Item)=>f.value!=='student_source_id')" :key="field.value" class="field">{{field.label}}{{field.value==='student_name'?'（必选）':''}}<UiSelect v-model="mapping[field.value]" :aria-label="`名单列：${field.label}`" :disabled="busy" :options="columns" @change="invalidate"/></label></div>
    <details class="source-sample"><summary>查看文件前几行</summary><div class="table-scroll"><table><tbody><tr v-for="(row,i) in selectedSheet.rows.slice(header,header+3)" :key="i"><td v-for="{value,index:j} in row.map((value:string,index:number)=>({value,index})).filter((c:Item)=>!isStudentIdentifierHeader(selectedSheet.rows[header-1]?.[c.index]))" :key="j">{{value||'—'}}</td></tr></tbody></table></div></details>
    <div class="workflow-toolbar"><label>缺少年级时补填<UiSelect v-model="defaults.grade" aria-label="导入默认年级" :disabled="busy" :options="[{value:'',label:'逐班核对'},...options.grades.map((v:string)=>({value:v,label:v}))]" @change="invalidate"/></label><label>缺少时段时补填<UiSelect v-model="defaults.schedule" aria-label="导入默认时间段" :disabled="busy" :options="[{value:'',label:'逐班核对'},...options.schedules.map((v:string)=>({value:v,label:v}))]" @change="invalidate"/></label><button class="btn" :disabled="busy" @click="check">{{busy?'正在校验…':preview?'重新校验':'预览名单'}}</button></div>
   </template>
   <section v-if="preview" aria-label="名单导入预览">
    <h3>核对 {{preview.groups.length}} 个班级</h3><p>{{preview.note}}</p>
    <section v-for="group in preview.groups" :key="group.key" class="import-class"><h3>{{classLabel(group)}} · {{group.students.length}} 人 · {{group.action}}</h3>
     <div class="workflow-toolbar"><label>关联班级<UiSelect wide v-model="resolutions[group.key].class_id" :aria-label="`关联班级：${group.name}`" :disabled="busy" :options="[{value:'',label:'新建班级'},...sortedClasses(classes).map(c=>({value:String(c.id),label:classLabel(c)}))]" @change="invalidate"/></label><template v-if="!resolutions[group.key].class_id"><label>年级<UiSelect v-model="resolutions[group.key].grade" :aria-label="`导入年级：${group.name}`" :disabled="busy" :options="[{value:'',label:'请选择年级'},...options.grades.map((v:string)=>({value:v,label:v}))]" @change="invalidate"/></label><label>时间段<UiSelect v-model="resolutions[group.key].schedule" :aria-label="`导入时间段：${group.name}`" :disabled="busy" :options="[{value:'',label:'请选择时间段'},...options.schedules.map((v:string)=>({value:v,label:v}))]" @change="invalidate"/></label><label class="check"><input v-model="resolutions[group.key].is_experimental" type="checkbox" @change="invalidate"/>实验班</label></template></div>
     <p v-for="message in group.errors" :key="message" class="field-error">{{message}}</p><p v-for="message in group.warnings" :key="message">{{message}}</p>
     <div class="table-scroll"><table><thead><tr><th>文件行</th><th>学生</th><th>英文名</th><th>本次处理／核对</th></tr></thead><tbody><tr v-for="row in group.students" :key="row.row"><td>{{row.row}}</td><td>{{row.name}}</td><td>{{row.english_name||'—'}}</td><td><UiSelect v-if="row.candidates?.length" v-model="resolutions[group.key].students[String(row.row)]" :aria-label="`学生身份：第${row.row}行`" :disabled="busy" :options="[{value:'',label:'请选择身份'},{value:'new',label:'确认新建另一位学生'},...row.candidates.map((s:Item)=>({value:s.id,label:studentLabel(s)}))]" @change="invalidate"/><template v-else>{{row.action}}</template></td></tr></tbody></table></div>
    </section>
    <label v-if="!dirty&&!preview.errors.length" class="check"><input v-model="acknowledged" type="checkbox"/>已核对班级、学生关联及新建身份，确认导入</label><p v-if="dirty">选择已改变，请重新校验后确认。</p>
   </section>
  </div>
  <footer><p v-if="error" class="validation-summary" role="alert">{{error}}</p><button class="btn" :disabled="busy" @click="emit('close')">取消</button><button v-if="preview" class="btn primary" :disabled="busy||dirty||preview.errors.length>0||!acknowledged" @click="save">确认导入名单</button></footer>
 </dialog>
</template>

<style scoped>
.roster-import{width:min(1100px,calc(100% - 24px));max-height:92dvh;padding:0;border:1px solid #e2e8f1;border-radius:12px;box-shadow:0 20px 70px #17263a30}.roster-import::backdrop{background:#17263a55}.roster-import header{display:flex;justify-content:space-between;align-items:center;padding:20px;border-bottom:1px solid #edf1f6}.import-body{padding:22px;display:flex;flex-direction:column;gap:18px;line-height:1.7}.mapping-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.mapping-grid .ui-select{width:100%}.import-class{padding:20px 0;border-bottom:1px solid #edf1f6}.check{display:flex;flex-direction:row!important;align-items:center;gap:8px}.check input{width:auto!important}.source-sample summary{cursor:pointer}.roster-import footer{position:sticky;bottom:0;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;padding:18px 24px;background:#fff;border-top:1px solid #edf1f6}.roster-import footer .validation-summary{flex-basis:100%}@media(max-width:600px){.mapping-grid{grid-template-columns:1fr}.import-body{padding:18px}}
</style>
