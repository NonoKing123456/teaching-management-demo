<script setup lang="ts">
import {ref,computed} from 'vue'
import {Download,RefreshCw,LoaderCircle,ArrowRight} from 'lucide-vue-next'
import {api,downloadFile,query} from './api'
import FileUpload from './FileUpload.vue'
import {useFeedback} from './feedback'
type Item=Record<string,any>
const props=defineProps<{kind:string,user:Item,meta:Item}>(),emit=defineEmits<{navigate:[id:string]}>()
const teacher=ref(String(props.user.role==='teacher'?props.user.id:props.meta.upload_teachers[0]?.id||props.user.id)),groups=ref<Item[]>([]),busy=ref(false)
const {error,notice}=useFeedback()
const range=computed(()=>props.kind==='habit'?props.meta.weekly_range:props.meta.monthly_range),count=computed(()=>groups.value.reduce((n,g)=>n+g.students.length,0))
async function run(fn:()=>Promise<any>){busy.value=true;error.value='';notice.value='';try{await fn()}catch(e){error.value=(e as Error).message}finally{busy.value=false}}
async function getSource(file?:File){await run(async()=>{groups.value=[];const data=new FormData();data.append('kind',props.kind);data.append('teacher_id',teacher.value);if(file)data.append('file',file);const result=await api('checkin/source/',{method:'POST',body:data});groups.value=result.groups;notice.value=`已读取 ${groups.value.length} 个班级、${count.value} 位学生。`})}
function invalidFile(message:string){groups.value=[];notice.value='';error.value=message}
async function generate(){await run(async()=>{await downloadFile('checkin/generate/',{method:'POST',body:JSON.stringify({kind:props.kind,teacher_id:teacher.value,groups:groups.value})});notice.value='Excel 已下载，核对后请到对应数据上传入口提交。'})}
</script>
<template>
  <div class="workflow">
    <section class="panel workflow-panel"><div class="workflow-toolbar"><div><h2>{{kind==='habit'?'上周习惯数据生成':'上月习惯数据生成'}}</h2><p>统计区间：{{range[0]}} 至 {{range[1]}}</p></div><span class="toolbar-spacer"></span><label>任课教师<select v-model="teacher" :disabled="busy||user.role==='teacher'" @change="groups=[]"><option v-for="t in meta.upload_teachers" :key="t.id" :value="String(t.id)">{{t.name}}</option><option v-if="!meta.upload_teachers.length" :value="String(user.id)">{{user.name}}</option></select></label></div>
      <ol class="workflow-steps" aria-label="打卡数据处理步骤"><li>取得打卡数据</li><li v-if="kind==='habit'">粘贴微信接龙</li><li>生成 Excel</li><li>前往数据上传</li></ol>
      <div class="source-actions"><button class="btn primary" :disabled="busy||!meta.writable" @click="getSource()"><LoaderCircle v-if="busy" class="spin" :size="16"/><RefreshCw v-else :size="16"/>从打卡平台取得数据</button><button class="text-button" :disabled="busy||!meta.writable" @click="run(()=>downloadFile(`checkin/source-template/?${query({teacher_id:teacher})}`))"><Download :size="15"/>下载源数据模板</button></div>
      <FileUpload :busy="busy" :disabled="!meta.writable" title="导入打卡源数据 Excel" button-text="导入源数据 Excel" @select="getSource" @invalid="invalidFile"/>
      <details class="inline-help"><summary>取数说明</summary><p>{{meta.platform_configured?'平台已配置，取数时检查令牌有效性。':'平台未配置，请导入源数据 Excel；连接方式见系统说明。'}}</p><p>可导入源数据模板或原周／月习惯表。生成后需核对课型、时间段，再到对应上传入口提交。</p></details>
    </section>
    <section v-for="(g,index) in groups" :key="index" class="panel workflow-panel"><div class="workflow-toolbar"><div><h2>{{g.name}}</h2><p>{{g.students.length}} 位学生</p></div><span class="toolbar-spacer"></span><label>课型<input v-model="g.grade" placeholder="例如：六年级" maxlength="60"/></label><label>时间段<input v-model="g.schedule" placeholder="例如：六下" maxlength="60"/></label></div>
      <div class="generator-grid"><div class="table-scroll"><table><thead><tr><th>学生姓名</th><th>英文名</th><th>APP 完成度</th><th>朗读分</th><th v-if="kind==='habit'">未完成日期</th></tr></thead><tbody><tr v-for="(s,i) in g.students" :key="i"><td>{{s.name}}</td><td>{{s.english_name||'—'}}</td><td>{{s.completion==null?'未采集':s.completion+'%'}}</td><td>{{s.reading_score??'未采集'}}</td><td v-if="kind==='habit'" class="wrap-cell">{{s.unfinished||'—'}}</td></tr></tbody></table></div><label v-if="kind==='habit'" class="field"><strong>微信接龙</strong><textarea v-model="g.wechat" rows="10" placeholder="仅粘贴姓名＋天数，例如：&#10;张同学 7&#10;李同学 Lily 6"></textarea><small>重名请附英文名，未填写的学生保留空白。</small></label></div>
    </section>
    <section v-if="groups.length" class="panel workflow-panel"><div class="workflow-toolbar"><span>{{groups.length}} 个班级 · {{count}} 位学生</span><span class="toolbar-spacer"></span><button class="btn primary" :disabled="busy" @click="generate"><Download :size="17"/>生成并下载{{kind==='habit'?'周':'月'}}习惯 Excel</button><button class="btn" @click="emit('navigate',kind)">前往数据上传<ArrowRight :size="16"/></button></div></section>
  </div>
</template>
