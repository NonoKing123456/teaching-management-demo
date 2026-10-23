<script setup lang="ts">
import {computed,ref,watch,nextTick} from 'vue'
import PageTable from './PageTable.vue'
import StudentCheckHeader from './StudentCheckHeader.vue'
import {usePaginationScroll} from './usePaginationScroll'
type Item=Record<string,any>
const props=withDefaults(defineProps<{students:Item[],fields?:Item[],sortFields?:Item[],problemsFirst?:boolean,hideControls?:boolean,externalSearch?:string,externalProblems?:boolean}>(),{fields:()=>[],sortFields:()=>[]})
const area=ref<HTMLElement>(),pagination=usePaginationScroll(()=>area.value?.querySelector<HTMLElement>('[data-page-table]')||undefined)
const onlyProblems=ref(false),search=ref(''),page=ref(1),sortField=ref(''),direction=ref<'asc'|'desc'>('asc')
const problems=computed(()=>props.students.filter(s=>s.needs_review).length)
const selected=computed(()=>{
 const find=props.hideControls?props.externalSearch||'':search.value
 const problemsOnly=props.hideControls?props.externalProblems:onlyProblems.value
 const list=props.students.filter(s=>(!problemsOnly||s.needs_review)&&(!find||`${s.name} ${s.english_name}`.toLocaleLowerCase().includes(find.trim().toLocaleLowerCase())))
 if(!sortField.value)return list
 const text=['student_name','english_name'].includes(sortField.value)
 const value=(s:Item)=>sortField.value==='student_name'?s.name:sortField.value==='english_name'?s.english_name:s.data?.[sortField.value]
 return list.map((item,index)=>({item,index})).sort((a,b)=>{const x=value(a.item),y=value(b.item);if(x===y)return a.index-b.index;if(x==null||x==='')return 1;if(y==null||y==='')return -1;const result=text?String(x).localeCompare(String(y),'zh-CN'):Number(x)-Number(y);return (direction.value==='asc'?1:-1)*result||a.index-b.index}).map(s=>s.item)
})
const maxPage=computed(()=>Math.max(1,Math.ceil(selected.value.length/30))),visible=computed(()=>selected.value.slice((page.value-1)*30,page.value*30))
watch(()=>props.students,()=>{pagination.cancel();page.value=1;onlyProblems.value=!!props.problemsFirst&&problems.value>0},{immediate:true})
watch([onlyProblems,search],()=>{pagination.cancel();page.value=1})
watch(()=>[props.externalSearch,props.externalProblems],()=>{pagination.cancel();page.value=1})
async function sort(key:string){pagination.cancel();const y=window.scrollY,x=window.scrollX;const initial=['student_name','english_name'].includes(key)?'asc':props.sortFields.find(f=>f.value===key)?.default_direction||'desc';if(sortField.value!==key){sortField.value=key;direction.value=initial}else if(direction.value===initial)direction.value=initial==='asc'?'desc':'asc';else sortField.value='';await nextTick();window.scrollTo({left:x,top:y,behavior:'instant'})}
async function turn(next:number){const ticket=pagination.prepare();page.value=next;await nextTick();void pagination.finish(ticket,()=>page.value===next)}
function value(v:any,type:string){return v===null||v===undefined||v===''?'—':type==='percent'?`${v}%`:v}
</script>
<template>
 <div ref="area" class="student-check-table">
  <div v-if="!hideControls" class="check-controls"><label class="check-toggle"><input v-model="onlyProblems" type="checkbox"/>只看未填／有问题的学生（{{problems}}）</label><label>查找学生<input v-model="search" aria-label="名单核对学生姓名" placeholder="姓名或英文名"/></label><span>展示 {{selected.length}} / 名单 {{students.length}} 人</span></div>
  <PageTable label="学生填写情况" :has-rows="visible.length>0"><template #default="{docked}"><table class="student-check-compact"><StudentCheckHeader :fields="fields" :sort-fields="sortFields" :sort-field="sortField" :direction="direction" :inactive="docked" @sort="sort"/><tbody><tr v-for="s in visible" :key="s.id" :data-student-id="s.id"><td class="student-check-name">{{s.name}}<span v-if="s.english_name" class="student-check-english">{{s.english_name}}</span></td><td class="student-input-problems"><span class="input-state" :class="`state-${s.status}`">{{s.status_label}}</span><p v-if="s.status==='missing'">该学生没有文件记录</p><p v-else-if="s.status==='empty'">教学指标尚未填写</p><p v-else-if="s.missing_fields?.length">缺：{{s.missing_fields.join('、')}}</p><details v-if="s.unfilled_fields?.length&&!s.policy_confirmed&&s.status!=='missing'&&s.status!=='empty'"><summary>{{s.unfilled_fields.length}} 项未填，核对适用性</summary><p>{{s.unfilled_fields.join('、')}}</p></details><p v-for="issue in s.issues||[]" :key="issue">{{issue}}</p></td><td v-for="f in fields" :key="f[0]" :class="{'wrap-cell':f[0]==='content'}">{{value(s.data?.[f[0]],f[2])}}</td><td class="student-check-source"><span v-if="!s.locations?.length">{{s.status==='no_record'?'—':'整行缺失'}}</span><details v-else><summary>{{s.locations.length===1?`第${s.locations[0].row}行`:`${s.locations.length} 条定位`}}</summary><p v-for="loc in s.locations" :key="loc.sheet+loc.row">{{loc.sheet}} · 第{{loc.row}}行</p></details><details v-if="s.records?.length>1"><summary>查看 {{s.records.length}} 条实际记录</summary><p v-for="r in s.records" :key="r.id">{{r.data.call_date}} {{r.data.method}}：{{r.data.content}}</p></details></td></tr></tbody></table></template><template #header><StudentCheckHeader :fields="fields" :sort-fields="sortFields" :sort-field="sortField" :direction="direction" @sort="sort"/></template></PageTable>
  <p v-if="!selected.length" class="empty-state compact">{{onlyProblems?'当前没有未填或待核对学生。':'没有符合条件的学生。'}}</p>
  <div v-if="selected.length>30" class="check-pagination"><button class="btn small" :disabled="page<=1" @click="turn(page-1)">上一页</button><span>{{page}} / {{maxPage}}</span><button class="btn small" :disabled="page>=maxPage" @click="turn(page+1)">下一页</button></div>
 </div>
</template>
<style scoped>
.student-check-table :deep(.student-check-compact){width:100%;min-width:0;max-width:none;margin-inline:auto;table-layout:auto}
.student-check-table :deep(.student-check-compact th){padding-inline:12px}
.student-check-compact .student-check-name{min-width:155px;max-width:220px;white-space:normal;overflow-wrap:anywhere}
.student-check-english{margin-left:7px;color:#748094;font-size:13px}
.student-check-compact .student-input-problems{min-width:160px;max-width:260px;overflow-wrap:anywhere}
.student-check-compact .wrap-cell,.student-check-compact .student-check-source{min-width:100px;max-width:320px;white-space:normal;overflow-wrap:anywhere}
.student-check-source p{white-space:pre-wrap}
</style>
<style scoped>.student-check-table :deep(td){padding:10px 12px}.check-controls{display:flex;align-items:center;gap:14px 22px;flex-wrap:wrap;margin:14px 0}.check-controls label{display:flex;align-items:center;gap:8px}.check-toggle input{width:16px;height:16px}.check-controls input:not([type=checkbox]){max-width:200px}.input-state{display:inline-block;white-space:nowrap;padding:3px 8px;border-radius:5px;color:#667085;background:#f1f4f8}.state-complete{color:#3f7865;background:#edf5f1}.state-empty,.state-incomplete{color:#936a3e;background:#faf4e9}.state-issue{color:#955e66;background:#f9f0f1}.student-input-problems{min-width:190px;max-width:340px;white-space:normal}.student-input-problems p{line-height:1.7;margin:5px 0}.check-pagination{display:flex;justify-content:flex-end;align-items:center;gap:16px;margin-top:14px}summary{cursor:pointer}td small{display:block;color:#667085}@media(max-width:600px){.check-controls label:not(.check-toggle){width:100%}.check-controls input:not([type=checkbox]){flex:1;max-width:none}}</style>
