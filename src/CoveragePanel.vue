<script setup lang="ts">
import {computed,ref,watch,onBeforeUnmount} from 'vue'
import {api,query,downloadFile} from './api'
import {classLabel} from './classPresentation'
import StudentCheckTable from './StudentCheckTable.vue'
import BatchSources from './BatchSources.vue'
type Item=Record<string,any>
const props=defineProps<{params:Item,fields:Item[],sortFields?:Item[],user?:Item}>()
const result=ref<Item|null>(null),loading=ref(false),error=ref('')
const search=ref(''),onlyProblems=ref(false)
const problems=computed(()=>result.value?.groups.reduce((n:number,g:Item)=>n+g.students.filter((s:Item)=>s.needs_review).length,0)||0)
const key=computed(()=>JSON.stringify(props.params))
let version=0
watch(key,async()=>{const current=++version;loading.value=true;result.value=null;error.value='';try{const data=await api(`teaching/coverage/?${query(props.params)}`);if(current===version)result.value=data}catch(e){if(current===version){result.value=null;error.value=(e as Error).message}}finally{if(current===version)loading.value=false}},{immediate:true})
onBeforeUnmount(()=>++version)
function facts(g:Item){const labels:Item={complete:'填写完整',recorded:'已有数据',empty:'尚未填写',missing:'缺少记录',incomplete:'填写不完整',issue:'待核对',no_record:'本期暂无记录'};const counts=g.status_counts||g.students.reduce((c:Item,s:Item)=>(c[s.status]=(c[s.status]||0)+1,c),{});return Object.entries(counts).filter(([,n])=>!!n).map(([key,n])=>`${n} 人${labels[key]||key}`).join(' · ')}
async function download(){error.value='';try{await downloadFile(`teaching/coverage/export/?${query(props.params)}`)}catch(e){error.value=(e as Error).message}}
</script>
<template>
<section class="coverage-panel" aria-label="班级学生与数据" :aria-busy="loading">
 <div class="coverage-heading"><h2>学生与数据</h2><button class="btn" :disabled="loading||!result?.groups.length" @click="download">下载名单核对表</button></div>
 <p v-if="loading" class="loading-inline">正在读取学生与数据…</p><p v-if="error" class="validation-summary" role="alert">{{error}}</p>
 <p v-if="result?.unavailable?.length" class="info-banner">{{result.unavailable[0].message}}</p>
 <div v-if="result?.groups.length" class="student-controls"><label>查找学生<input v-model="search" aria-label="名单核对学生姓名" placeholder="姓名或英文名"/></label><label class="problem-toggle"><input v-model="onlyProblems" type="checkbox"/>只看未填／有问题的学生（{{problems}}）</label></div>
 <p v-if="result&&!loading&&!result.groups.length" class="empty-state compact">本期暂无已提交记录。完整名单仅向有权限的账号展示。</p>
 <section v-for="(g,index) in result?.groups||[]" :key="`${g.batch_id||g.basis}:${g.class_id}:${index}`" class="coverage-class">
  <h3>{{g.basis==='legacy'?'已有记录 · 未关联历史名单':classLabel(g.snapshot,{teacher:true,term:true})}}</h3>
  <p class="coverage-summary"><template v-if="g.roster_count!==null">{{g.basis==='current'?'当前名单参考':'名单'}} {{g.roster_count}} 人 · </template>{{g.record_count}} 条实际教学记录</p>
  <p class="coverage-facts">{{facts(g)}}</p>
  <StudentCheckTable :students="g.students" :fields="fields" :sort-fields="sortFields" hide-controls :external-search="search" :external-problems="onlyProblems"/>
  <BatchSources :records="g.students.flatMap((s:Item)=>s.records||[])" :user="user"/>
  <details v-if="g.basis!=='legacy'" class="coverage-provenance"><summary>名单来源与历史版本</summary><p>{{g.note}}</p><p>{{g.basis==='current'?'当前名单参考':'提交时保存的历史名单'}} · 版本 {{g.snapshot.version}} · 班级编号 {{g.class_id}}</p><p v-if="!g.input_policy.confirmed">必填及适用范围待确认，仅展示填写事实。</p><p v-if="g.filename">{{g.filename}} · 提交编号 {{g.batch_id}}</p><div v-if="g.snapshot.source_name">来源原班名：{{g.snapshot.source_name}}</div></details>
 </section>
</section>
</template>
<style scoped>.coverage-panel{padding:0 20px 18px}.coverage-facts{margin:8px 0 14px;color:#344258;line-height:1.8}@media(max-width:600px){.coverage-panel{padding:0 14px 14px}}.student-controls{display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin:12px 0}.student-controls label{display:flex;gap:8px;align-items:center}.student-controls input:not([type=checkbox]){max-width:220px}.problem-toggle input{width:16px;height:16px}.coverage-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin:16px 0}.coverage-class{padding:20px 0;border-top:1px solid #edf1f6}.coverage-summary{margin:8px 0;line-height:1.8}.coverage-note{font-size:14px;color:#667085;line-height:1.8;margin:8px 0}.coverage-provenance{margin:14px 0;line-height:1.8}.coverage-provenance summary{cursor:pointer}</style>
