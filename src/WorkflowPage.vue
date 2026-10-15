<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { Upload, Download, CheckCircle2, AlertCircle, LoaderCircle, History, Trash2, Search, RefreshCw } from 'lucide-vue-next'
import { api, query, downloadFile } from './api'
import FileUpload from './FileUpload.vue'
import { useFeedback } from './feedback'
type Item = Record<string, any>
const props=defineProps<{kind:string,user:Item,meta:Item}>()
const today=new Date()
const year=ref(today.getFullYear()-(props.kind==='monthly'&&today.getMonth()===0?1:0)),term=ref(today.getMonth()+1>=2&&today.getMonth()+1<7?'春':today.getMonth()+1>=7&&today.getMonth()+1<9&&props.kind!=='scores'?'夏':'秋'),period=ref(props.kind==='monthly'?(today.getMonth()||12):props.kind==='communication'?today.getMonth()+1:1),teacher=ref(''),uploadTeacher=ref(String(props.user.role==='teacher'?props.user.id:props.meta.upload_teachers[0]?.id||props.user.id))
const tab=ref('submit'),search=ref(''),course=ref(''),time=ref(''),page=ref(1),rows=ref<Item>({items:[],total:0,fields:[]}),summary=ref<Item>({}),periods=ref<Item[]>([]),history=ref<Item[]>([])
const busy=ref(false),loading=ref(false),preview=ref<Item|null>(null),replace=ref(false),file=ref<File|null>(null),revoke=ref<number|null>(null)
const {error,notice}=useFeedback()
const previewPanel=ref<HTMLElement|null>(null)
const spec=computed(()=>props.meta.kinds[props.kind]),monthly=computed(()=>['monthly','communication'].includes(props.kind)),current=computed(()=>periods.value.find(p=>p.period===period.value)),writable=computed(()=>props.meta.writable)
const maxPage=computed(()=>Math.max(1,Math.ceil(rows.value.total/30)))
const reportName=computed(()=>({classroom:'课堂过关分析总表',habit:'周习惯分析总表',monthly:'超级班级和明星学员数据',scores:'校内成绩汇总表',communication:'电教汇总表'} as Item)[props.kind])
const starName=computed(()=>props.kind==='habit'?'习惯星币总表':'课堂星币总表')
const finalName=computed(()=>props.kind==='habit'?'下载个人期末习惯数据':'下载个人期末课堂数据')
function params(all=false){return {kind:props.kind,year:year.value,term:monthly.value?'全年':term.value,period:all?'':period.value,teacher_id:teacher.value,search:search.value,class_type:course.value,class_time:time.value}}
function val(v:any,type=''){return v===null||v===undefined||v===''?'—':type==='percent'?`${v}%`:v}
function date(v:string){return new Date(v).toLocaleString('zh-CN',{hour12:false})}
async function action(fn:()=>Promise<any>){busy.value=true;error.value='';notice.value='';try{await fn()}catch(e){error.value=(e as Error).message}finally{busy.value=false}}
let loadVersion=0
async function load(){
  const version=++loadVersion;loading.value=true;error.value=''
  try{
    const results=await Promise.all([api(`teaching/periods/?${query(params())}`),api(`teaching/rows/?${query({...params(),offset:(page.value-1)*30})}`),api(`teaching/summary/?${query(params())}`),api(`teaching/history/?${query(params())}`)])
    if(version!==loadVersion)return
    periods.value=results[0].items;rows.value=results[1];summary.value=results[2];history.value=results[3].items
  }catch(e){if(version===loadVersion)error.value=(e as Error).message}finally{if(version===loadVersion)loading.value=false}
}
function reset(){preview.value=null;file.value=null;replace.value=false;page.value=1;course.value='';time.value='';search.value='';load()}
watch([year,term,period,teacher],reset)
watch([course,time],()=>{page.value=1;load()})
watch(page,load)
let timer:ReturnType<typeof setTimeout>
watch(search,()=>{clearTimeout(timer);timer=setTimeout(()=>{page.value=1;load()},300)})
watch(uploadTeacher,()=>{preview.value=null;file.value=null;replace.value=false})
function invalidFile(message:string){file.value=null;preview.value=null;replace.value=false;notice.value='';error.value=message}
async function choose(selected:File){if(busy.value||!writable.value)return;file.value=selected;preview.value=null;replace.value=false;await action(async()=>{const data=new FormData();data.append('file',selected);for(const [k,v] of Object.entries({...params(),teacher_id:uploadTeacher.value}))data.append(k,String(v));preview.value=await api('teaching/preview/',{method:'POST',body:data});if(preview.value!.errors.length){error.value=`文件校验发现 ${preview.value!.errors.length} 处问题，请按下方校验预览修正后重新上传。`;await nextTick();previewPanel.value?.scrollIntoView({block:'start',behavior:'smooth'})}})}
async function commit(){await action(async()=>{await api(`teaching/batches/${preview.value!.id}/commit/`,{method:'POST',body:JSON.stringify({replace:replace.value})});notice.value='提交成功，明细、分析和下载已同步更新。';preview.value=null;file.value=null;replace.value=false;await load()})}
async function remove(id:number){await action(async()=>{await api(`teaching/batches/${id}/`,{method:'DELETE'});revoke.value=null;notice.value='本次提交已删除，可以重新上传；原件和旧版本保留。';await load()})}
async function download(mode:string){await action(()=>downloadFile(`teaching/export/?${query(mode==='final'?{kind:props.kind,year:year.value,term:term.value,mode,teacher_id:props.user.role==='teacher'?props.user.id:teacher.value||uploadTeacher.value}:{...params(),mode})}`))}
async function original(id:number){await action(()=>downloadFile(`teaching/batches/${id}/`))}
function selectPeriod(n:number){period.value=n;tab.value='submit'}
onMounted(load)
</script>

<template>
  <div class="workflow">
    <div class="workflow-toolbar panel">
      <label>年份<input v-model.number="year" type="number" min="2020" max="2122" aria-label="年份"/></label>
      <label v-if="!monthly">学期<select v-model="term" aria-label="学期"><option>春</option><option v-if="kind!=='scores'">夏</option><option>秋</option></select></label>
      <label>查看教师<select v-model="teacher" aria-label="筛选教师"><option value="">全体教师</option><option v-for="t in meta.teachers" :key="t.id" :value="String(t.id)">{{t.name}}</option></select></label>
      <button class="btn" :disabled="loading||busy" @click="load"><RefreshCw :size="15"/>刷新</button>
      <span class="toolbar-spacer"></span>
      <button v-if="writable" class="btn" :disabled="busy" @click="action(()=>downloadFile(`teaching/template/?${query({kind,teacher_id:uploadTeacher})}`))"><Download :size="16"/>下载填报模板</button>
      <button v-if="writable&&['habit','classroom'].includes(kind)" class="btn" :disabled="busy" @click="download('final')"><Download :size="16"/>{{finalName}}</button>
    </div>
    <div class="period-grid" aria-label="周期提交">
      <button v-for="p in periods" :key="p.period" class="period-card" :class="{selected:period===p.period}" @click="selectPeriod(p.period)"><strong>{{p.label}}</strong><span><i class="status-dot" :class="{done:p.submitted.length}"></i>已交 {{p.submitted.length}} · 未交 {{p.missing.length}}</span></button>
    </div>
    <div class="workflow-tabs"><button v-for="t in [{id:'submit',name:'上传与提交情况'},{id:'detail',name:'数据明细'},{id:'analysis',name:kind==='monthly'?'超级班级与明星候选':'分析汇总'},{id:'history',name:'提交历史'}]" :key="t.id" :class="{active:tab===t.id}" @click="tab=t.id">{{t.name}}</button><span class="toolbar-spacer"></span><small>{{current?.label}} · {{summary.count||0}} 条有效记录</small></div>
    <div v-if="loading" class="loading-inline"><LoaderCircle class="spin" :size="17"/>正在读取本期数据…</div>
    <template v-if="tab==='submit'">
      <div class="submit-grid">
        <section class="panel workflow-panel"><h2>{{current?.label}} · 数据上传</h2>
          <template v-if="writable"><label class="field">上传教师<select v-model="uploadTeacher" :disabled="busy||user.role==='teacher'"><option v-for="t in meta.upload_teachers" :key="t.id" :value="String(t.id)">{{t.name}}</option><option v-if="!meta.upload_teachers.length" :value="String(user.id)">{{user.name}}</option></select></label>
          <FileUpload :busy="busy" :filename="file?.name" :button-text="preview?'重新选择文件':'选择文件并校验'" @select="choose" @invalid="invalidFile"/></template>
          <p v-else class="info-banner">当前账号只读，可查看授权范围的提交、明细和报表。</p>
          <details v-if="writable" class="inline-help"><summary>填表说明</summary><ul><li>每位教师本期提交一份文件，每个班级一张工作表。</li><li>课型、时间段必须填写，同一文件内不能重复时间段。</li><li>保留模板列，不增删；未使用的列可隐藏，工作表不能隐藏。</li></ul></details>
        </section>
        <section class="panel workflow-panel"><h2>本期提交情况</h2><div class="status-group"><strong>已交 {{current?.submitted.length||0}} 人</strong><div v-for="b in current?.submitted||[]" :key="b.id" class="submitted-row"><span><b>{{b.teacher}}</b><small>{{b.count}} 条 · {{b.classes}} 个班级</small></span><button v-if="b.can_download" class="text-button" :disabled="busy" @click="original(b.id)"><Download :size="14"/>原件</button><button v-if="writable&&(user.role==='manager'||b.teacher_id===user.id)" class="text-button danger-text" @click="revoke=b.id"><Trash2 :size="14"/>删除本次提交</button><div v-if="revoke===b.id" class="inline-confirm"><span>确认删除本次提交？删除后可重新上传，原件与历史仍保留。</span><button class="btn small" @click="revoke=null">取消</button><button class="btn small danger" :disabled="busy" @click="remove(b.id)">确认删除</button></div></div><p v-if="!current?.submitted.length" class="muted">暂无教师提交。</p></div><div class="status-group"><strong>未交 {{current?.missing.length||0}} 人</strong><div class="teacher-tags"><span v-for="t in current?.missing||[]" :key="t.id">{{t.name}}</span></div></div><div class="period-downloads"><button class="btn primary" :disabled="busy||!summary.count" @click="download('analysis')"><Download :size="15"/>下载{{reportName}}</button><button v-if="['habit','classroom'].includes(kind)" class="btn" :disabled="busy||!summary.count" @click="download('stars')"><Download :size="15"/>下载{{starName}}</button></div></section>
      </div>
      <section v-if="preview" ref="previewPanel" class="panel workflow-panel preview-panel"><h2>校验预览</h2><div class="import-summary" :class="{invalid:preview.errors.length}"><component :is="preview.errors.length?AlertCircle:CheckCircle2" :size="22"/><div><strong>{{preview.errors.length?`发现 ${preview.errors.length} 处问题`:'校验通过'}}</strong><span>{{preview.count}} 条明细 · {{preview.classes}} 个班级 · {{preview.teacher}}</span></div></div><div v-if="preview.errors.length" class="import-errors"><div v-for="(e,i) in preview.errors" :key="i"><span>{{e.sheet||'文件'}}{{e.row?` · 第 ${e.row} 行`:''}}</span><p>{{e.message}}</p></div><small>请修正以上问题后重新上传。</small></div><details v-if="preview.warnings.length" class="inline-help"><summary>校验说明（{{preview.warnings.length}}）</summary><ul class="warning-list"><li v-for="w in preview.warnings" :key="w">{{w}}</li></ul></details><div class="table-scroll"><table><thead><tr><th>工作表／行</th><th>学生</th><th>英文名</th><th>课型</th><th>时间段</th></tr></thead><tbody><tr v-for="r in preview.rows.slice(0,12)" :key="r.sheet+r.source_row"><td>{{r.sheet}} · {{r.source_row}}</td><td>{{r.student_name}}</td><td>{{r.english_name||'—'}}</td><td>{{r.class_type}}</td><td>{{r.class_time}}</td></tr></tbody></table></div><label v-if="preview.existing" class="replace-check"><input v-model="replace" type="checkbox"/>替换 {{preview.existing.filename}}，旧数据和原件保留在提交历史中。</label><footer class="workflow-footer"><span>共 {{preview.count}} 条，预览前 12 条</span><button class="btn primary" :disabled="busy||preview.errors.length||!!preview.existing&&!replace" @click="commit"><CheckCircle2 :size="16"/>确认入库</button></footer></section>
    </template>
    <template v-if="tab==='detail'"><section class="panel"><div class="workflow-toolbar"><label class="search-field"><Search :size="16"/><input v-model="search" placeholder="学生姓名或英文名"/></label><select v-model="course" aria-label="课型筛选"><option value="">全部课型</option><option v-for="c in rows.courses" :key="c">{{c}}</option></select><select v-model="time" aria-label="时间段筛选"><option value="">全部时间段</option><option v-for="t in rows.times" :key="t">{{t}}</option></select><span class="toolbar-spacer"></span><button class="btn" :disabled="busy||!rows.total" @click="download('detail')"><Download :size="15"/>下载当前明细</button></div><div class="table-scroll"><table><thead><tr><th>教师</th><th>课型</th><th>时间段</th><th>学生姓名</th><th>英文名</th><th v-for="f in spec.fields" :key="f[0]">{{f[1]}}</th></tr></thead><tbody><tr v-for="r in rows.items" :key="r.id"><td>{{r.teacher}}</td><td>{{r.class_type}}</td><td>{{r.class_time}}</td><td>{{r.student_name}}</td><td>{{r.english_name||'—'}}</td><td v-for="f in spec.fields" :key="f[0]" :class="{'wrap-cell':f[0]==='content'}">{{val(r.data[f[0]],f[2])}}</td></tr></tbody></table><div v-if="!rows.total" class="empty-state compact">本期暂无有效明细，请先上传数据。</div></div><div class="workflow-footer"><span>共 {{rows.total}} 条</span><div class="pagination"><button class="btn small" :disabled="page<=1" @click="page--">上一页</button><span>{{page}} / {{maxPage}}</span><button class="btn small" :disabled="page>=maxPage" @click="page++">下一页</button></div></div></section></template>
    <template v-if="tab==='analysis'">
      <div class="metric-grid"><div v-for="m in [{name:'有效明细',value:summary.count,unit:'条'},{name:'涉及班级',value:summary.classes,unit:'个'},{name:'提交教师',value:summary.teachers,unit:'人'},{name:['classroom','habit'].includes(kind)?'星币总计':'统计范围',value:['classroom','habit'].includes(kind)?summary.stars:current?.label,unit:''}]" :key="m.name" class="metric-card"><span>{{m.name}}</span><div class="metric-value">{{m.value??'—'}}<small>{{m.unit}}</small></div></div></div>
      <section class="panel workflow-panel"><div class="workflow-toolbar"><h2>本期分析</h2><span class="toolbar-spacer"></span><button v-if="['habit','classroom'].includes(kind)" class="btn" :disabled="busy||!summary.count" @click="download('stars')"><Download :size="15"/>{{starName}}</button><button class="btn primary" :disabled="busy||!summary.count" @click="download('analysis')"><Download :size="15"/>下载{{reportName}}</button></div>
        <template v-if="['habit','classroom'].includes(kind)"><details class="inline-help"><summary>统计口径</summary><p>{{kind==='habit'?'空白等级按 D 计入，同时列出空白数。':'未开展的项目不参与该项等级占比。'}}</p></details><template v-for="section in [{name:'课型单位',key:'course_stats'},{name:'教师单位',key:'teacher_stats'}]" :key="section.key"><h3>{{section.name}}</h3><div class="table-scroll"><table><thead><tr><th>统计单位</th><th>指标</th><th>人数／有效／空白</th><th v-for="rank in ['A+','A','B','C','D']" :key="rank">{{rank}}</th></tr></thead><tbody><tr v-for="r in summary[section.key]||[]" :key="r.unit+r.metric"><td>{{r.unit}}</td><td>{{r.metric}}</td><td>{{r.count}} / {{r.valid}} / {{r.missing}}</td><td v-for="rank in ['A+','A','B','C','D']" :key="rank">{{r.ranks[rank].count}} 人 · {{val(r.ranks[rank].rate,'percent')}}</td></tr></tbody></table></div></template></template>
        <template v-if="kind==='monthly'"><details class="inline-help"><summary>评选规则</summary><p>超级班级：平均完成度至少 90%，按分组和班级数取名额，并列递增。明星候选：完成度 100% 且朗读分至少 90；最终名单由老师选择。</p></details><h3>超级班级 {{summary.super_classes?.length||0}} 个</h3><div class="table-scroll"><table><thead><tr><th>比较组</th><th>教师</th><th>课型</th><th>时间段</th><th>平均完成度</th></tr></thead><tbody><tr v-for="r in summary.super_classes||[]" :key="r.teacher+r.class_type+r.class_time"><td>{{r.group}}</td><td>{{r.teacher}}</td><td>{{r.class_type}}</td><td>{{r.class_time}}</td><td>{{r.completion}}%</td></tr></tbody></table></div><h3>明星学员符合名单 {{summary.star_students?.length||0}} 人</h3><div class="table-scroll"><table><thead><tr><th>学生</th><th>英文名</th><th>教师</th><th>课型／时间段</th><th>朗读分</th><th>月完成度</th></tr></thead><tbody><tr v-for="r in summary.star_students||[]" :key="r.teacher+r.class_type+r.class_time+r.student_name+r.english_name"><td>{{r.student_name}}</td><td>{{r.english_name}}</td><td>{{r.teacher}}</td><td>{{r.class_type}} / {{r.class_time}}</td><td>{{r.data.reading_score}}</td><td>100%</td></tr></tbody></table></div><h3>班级情况</h3><div class="table-scroll"><table><thead><tr><th>教师</th><th>课型</th><th>时间段</th><th>人数</th><th>平均朗读分</th><th>平均完成度</th></tr></thead><tbody><tr v-for="r in summary.class_stats||[]" :key="r.teacher+r.class_type+r.class_time"><td>{{r.teacher}}</td><td>{{r.class_type}}</td><td>{{r.class_time}}</td><td>{{r.count}}</td><td>{{val(r.reading_score)}}</td><td>{{val(r.completion,'percent')}}</td></tr></tbody></table></div></template>
        <template v-if="kind==='scores'"><details class="inline-help"><summary>统计口径</summary><p>分析排除空白和 0 分；原始 0 分仍保留在明细中。</p></details><div class="table-scroll"><table><thead><tr><th>课型</th><th>已填／总人数</th><th>平均分</th><th>100 分人数／占比</th><th>90 分及以上人数／占比</th><th>90 分以下人数／占比</th></tr></thead><tbody><tr v-for="r in summary.score_stats||[]" :key="r.unit"><td>{{r.unit}}</td><td>{{r.count}} / {{r.total}}</td><td>{{val(r.average)}}</td><td>{{r.perfect}} / {{val(r.perfect_rate,'percent')}}</td><td>{{r.high}} / {{val(r.high_rate,'percent')}}</td><td>{{r.low}} / {{val(r.low_rate,'percent')}}</td></tr></tbody></table></div></template>
        <template v-if="kind==='communication'"><div class="table-scroll"><table><thead><tr><th>教师</th><th>电教数量</th></tr></thead><tbody><tr v-for="r in summary.teacher_counts||[]" :key="r.teacher"><td>{{r.teacher}}</td><td>{{r.count}}</td></tr></tbody></table></div></template>
        <div v-if="!summary.count" class="empty-state compact">本期尚无可分析的数据。</div>
      </section>
    </template>
    <section v-if="tab==='history'" class="panel workflow-panel"><h2><History :size="18"/>本期提交历史</h2><details class="inline-help"><summary>版本说明</summary><p>替换和撤回保留原件，分析只使用当前有效版本。</p></details><div class="table-scroll"><table><thead><tr><th>提交教师</th><th>文件名</th><th>时间</th><th>明细数</th><th>状态</th><th>原件</th></tr></thead><tbody><tr v-for="b in history" :key="b.id"><td>{{b.teacher}}</td><td class="wrap-cell">{{b.filename}}</td><td>{{date(b.created_at)}}</td><td>{{b.count}}</td><td><span class="pill" :class="b.status==='active'?'green':'amber'">{{({active:'当前有效',superseded:'已替换',deleted:'已撤回'} as Item)[b.status]}}</span></td><td><button class="text-button" @click="original(b.id)">下载</button></td></tr></tbody></table><div v-if="!history.length" class="empty-state compact">暂无提交历史。</div></div></section>
  </div>
</template>
