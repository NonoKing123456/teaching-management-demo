<script setup lang="ts">
import {computed,ref} from 'vue'
import {classroomGroups} from './classroomColumns'
import ClassroomWorkbenchTableHeader from './ClassroomWorkbenchTableHeader.vue'
import PageTable from './PageTable.vue'
import FillingState from './FillingState.vue'

type Item=Record<string,any>
type Field=[string,string,string]
const props=defineProps<{items:Item[],fields:Field[],sort:string,direction:'asc'|'desc',stickyOffset?:number}>()
const emit=defineEmits<{sort:[key:string]}>()
const overview=ref(true)
const groups=computed(()=>classroomGroups(props.fields))
const compactLabels:Record<string,string>={initial_rate:'首音正确率',phonemic_rate:'音素正确率',phonics_rate:'拼读正确率',challenge_rate:'挑战正确率',reading_rate:'阅读正确率'}
const columns=computed(()=>groups.value.flatMap(g=>g.columns.filter(c=>!overview.value||!c.key.endsWith('_total')&&!c.key.endsWith('_correct')).map((c,i)=>({...c,fullLabel:g.label+' '+c.label,label:overview.value?(compactLabels[c.key]||c.label):c.label,width:overview.value?(c.key.endsWith('_rate')?112:c.width):c.width,first:i===0}))))
const tableWidth=computed(()=>170+columns.value.reduce((width,c)=>width+c.width,0)+108+210)
function value(v:any,type='number'){return v===null||v===undefined||v===''?'—':type==='percent'?`${v}%`:v}
function ratePrefix(key:string){return key.slice(0,-'_rate'.length)}
function studentTitle(s:Item){return [s.name,s.english_name].filter(Boolean).join(' / ')}
</script>

<template>
  <div class="classroom-workbench-students">
    <div class="classroom-table-tools">
      <div class="classroom-view-switch" role="group" aria-label="课堂明细显示方式"><button type="button" :aria-pressed="overview" @click="overview=true">结果总览</button><button type="button" :aria-pressed="!overview" @click="overview=false">全部字段</button></div>
      <span v-if="overview" class="classroom-view-help">点击正确率查看总数、正确数</span>
    </div>
    <PageTable :has-rows="items.length>0" :sticky-offset="stickyOffset" label="课堂过关学生明细" class="workbench-students classroom-students-scroll">
      <template #default="{docked}">
        <table class="classroom-students-table" :class="{'classroom-overview':overview}" :style="{width:`max(100%, ${tableWidth}px)`}">
          <colgroup><col style="width:170px"/><col v-for="c in columns" :key="c.key" :style="{width:c.width+'px'}"/><col style="width:108px"/><col style="width:210px"/></colgroup>
          <ClassroomWorkbenchTableHeader :overview="overview" :columns="columns" :groups="groups" :sort="sort" :direction="direction" :inactive="docked" @sort="emit('sort',$event)"/>
          <tbody><tr v-for="s in items" :key="s.key" :data-student-key="s.key">
            <td class="workbench-name-cell" :title="studentTitle(s)"><div class="workbench-name"><span>{{s.name}}</span><small v-if="s.english_name">{{s.english_name}}</small></div><small v-if="s.membership==='outside'" class="workbench-outside-mark">名单外</small></td>
            <td v-for="c in columns" :key="c.key" :data-field="c.key" :class="{'group-start':c.first&&!overview}">
              <details v-if="overview&&c.key.endsWith('_rate')" class="classroom-rate-details"><summary :aria-label="`${s.name} ${c.label} ${value(s.data?.[c.key],c.type)}，查看总数和正确数`">{{value(s.data?.[c.key],c.type)}}</summary><div><span>总数 {{value(s.data?.[ratePrefix(c.key)+'_total'])}}</span><span>正确数 {{value(s.data?.[ratePrefix(c.key)+'_correct'])}}</span></div></details>
              <template v-else>{{value(s.data?.[c.key],c.type)}}</template>
            </td>
            <td class="workbench-input-state"><FillingState :filled="s.status==='filled'"/><details v-if="s.records?.length>1"><summary>{{s.records.length}} 条记录</summary><p v-for="r in s.records" :key="r.id">{{r.data.call_date}} {{r.data.content}}</p></details></td>
            <td class="workbench-context-cell" data-column="teacher"><span>{{s.teacher}}</span><small>{{s.schedule}}<span v-if="s.schedule&&s.grade"> · </span>{{s.grade}}<span v-if="typeof s.is_experimental==='boolean'" class="workbench-cohort-mark" :aria-label="s.is_experimental?'实验班':'普通班'" :title="s.is_experimental?'实验班':'普通班'">{{s.is_experimental?'实':'普'}}</span></small></td>
          </tr></tbody>
        </table>
      </template>
      <template #header><ClassroomWorkbenchTableHeader :overview="overview" :columns="columns" :groups="groups" :sort="sort" :direction="direction" @sort="emit('sort',$event)"/></template>
    </PageTable>
  </div>
</template>

<style scoped>
.classroom-workbench-students{min-width:0;padding-inline:20px}.classroom-table-tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:0 0 12px;font-size:13px;color:#718096}.classroom-view-switch{display:flex;border:1px solid #dfe6ef;border-radius:6px;padding:2px;gap:2px}.classroom-view-switch button{padding:6px 10px;border:0;border-radius:4px;background:transparent;color:#64748b;font:inherit;cursor:pointer}.classroom-view-switch button[aria-pressed=true]{background:#edf3ff;color:#2459c6}.classroom-view-switch button:focus-visible{outline:2px solid #9fbceb;outline-offset:2px}.classroom-students-table{table-layout:fixed;border-collapse:separate;border-spacing:0;max-width:none}.classroom-students-table td{padding:11px 8px;text-align:center;border-bottom:1px solid #edf1f6;vertical-align:middle;font-variant-numeric:tabular-nums}.classroom-students-table td small{display:block;color:#758195;font-size:12px;margin-top:4px}.classroom-students-table .workbench-name-cell{position:sticky;left:0;z-index:1;background:#fff;box-shadow:1px 0 0 #dfe6ef;text-align:left;padding-left:14px}.workbench-name{min-width:0}.workbench-name>span,.workbench-name>small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.classroom-students-table .workbench-outside-mark{display:inline-block;color:#916b2d;background:#faf5eb;padding:2px 5px;border-radius:4px}.group-start{border-left:1px solid #dfe6ef}.classroom-students-table .workbench-context-cell{text-align:left;padding-left:12px;white-space:normal;overflow-wrap:anywhere}.workbench-cohort-mark{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;margin-left:5px;width:19px;height:19px;border:1px solid #b8c5d9;border-radius:50%;color:#536b8d;font-size:12px}.classroom-rate-details>summary{cursor:pointer;white-space:nowrap;color:#315b90;list-style-position:inside}.classroom-rate-details>div{display:grid;gap:4px;margin-top:8px;color:#64748b;font-size:12px}.workbench-input-state>details{margin-top:6px;font-size:12px;color:#718096}.workbench-input-state p{white-space:normal;overflow-wrap:anywhere}.classroom-rate-details>summary:focus-visible{outline:2px solid #9fbceb;outline-offset:3px}
@media(max-width:600px){.classroom-workbench-students{padding-inline:14px}}
@media(max-width:620px){.classroom-table-tools{padding-inline:0;gap:8px}.classroom-view-help{order:3;flex-basis:100%}}
.classroom-students-table .workbench-name{display:flex;align-items:center;gap:6px}.classroom-students-table .workbench-name>span{flex-shrink:0;max-width:65%}.classroom-students-table .workbench-name>small{min-width:0;margin-top:0}.classroom-students-table .workbench-context-cell>small{display:inline;margin-left:8px;margin-top:0}
.classroom-students-table tr:has(.classroom-rate-details[open])>td{vertical-align:top}
</style>
