<script setup lang="ts">
import {computed} from 'vue'
import PageTable from './PageTable.vue'
import WorkbenchTableHeader from './WorkbenchTableHeader.vue'
import ClassroomWorkbenchStudents from './ClassroomWorkbenchStudents.vue'
import FillingState from './FillingState.vue'
import {studentMetricColumns,type WorkbenchField} from './workbenchStudentColumns'

type Item=Record<string,any>
const props=withDefaults(defineProps<{kind?:string,items:Item[],fields:WorkbenchField[],sort:string,direction:'asc'|'desc',stickyOffset?:number}>(),{kind:'habit'})
defineEmits<{sort:[key:string]}>()
const columns=computed(()=>studentMetricColumns(props.kind,props.fields))
function value(v:any,type:string){return v===null||v===undefined||v===''?'—':type==='percent'?`${v}%`:v}
function metricValue(student:Item,field:WorkbenchField){
 const formatted=value(student.data?.[field[0]],field[2])
 return field[0]==='days'&&formatted!=='—'?`${formatted} 天`:formatted
}
function studentTitle(student:Item){return [student.name,student.english_name].filter(Boolean).join(' · ')}
</script>

<template>
 <ClassroomWorkbenchStudents v-if="kind==='classroom'" :items="items" :fields="fields" :sort="sort" :direction="direction" :sticky-offset="stickyOffset" @sort="$emit('sort',$event)"/>
 <div v-else class="workbench-students-area" :class="`student-area-${kind}`">
 <PageTable :has-rows="items.length>0" :sticky-offset="stickyOffset" label="本期学生名单与填报情况" class="workbench-students">
  <template #default="{docked}">
   <table class="compact-student-table" :class="{'habit-student-table':kind==='habit'}"><colgroup><col class="student-col"/><col v-for="column in columns" :key="column.key" class="metric-col" :class="{'stars-col':column.key==='stars'}"/><col class="state-col"/><col class="context-col"/></colgroup>
    <WorkbenchTableHeader :kind="kind" :fields="fields" :sort="sort" :direction="direction" :inactive="docked" @sort="$emit('sort',$event)"/>
    <tbody><tr v-for="s in items" :key="s.key" :data-student-key="s.key">
     <td class="workbench-name-cell"><div class="workbench-name" :title="studentTitle(s)"><span>{{s.name}}</span><small v-if="s.english_name">{{s.english_name}}</small><small v-if="s.membership==='outside'" class="workbench-outside-mark">名单外</small></div></td>
     <td v-for="column in columns" :key="column.key" class="workbench-metric" :data-metric="column.key"><span v-for="(field,index) in column.fields" :key="field[0]" :data-field="field[0]" :title="field[1]" :aria-label="`${field[1]}：${metricValue(s,field)}`" :class="{'metric-secondary':index>0}"><span v-if="index" class="metric-separator" aria-hidden="true"> · </span>{{metricValue(s,field)}}</span></td>
     <td class="workbench-input-state"><FillingState :filled="s.status==='filled'"/><details v-if="s.records?.length>1"><summary>{{s.records.length}} 条记录</summary><p v-for="r in s.records" :key="r.id">{{r.data.call_date}} {{r.data.content}}</p></details></td>
     <td class="workbench-context" data-column="teacher"><span>{{s.teacher||'—'}}</span><small class="workbench-class"><span>{{s.schedule||'—'}}</span><span v-if="s.grade"> · {{s.grade}}</span><span v-if="typeof s.is_experimental==='boolean'" class="workbench-cohort-mark" :aria-label="s.is_experimental?'实验班':'普通班'" :title="s.is_experimental?'实验班':'普通班'">{{s.is_experimental?'实':'普'}}</span></small></td>
    </tr></tbody>
   </table>
  </template>
  <template #header><WorkbenchTableHeader :kind="kind" :fields="fields" :sort="sort" :direction="direction" @sort="$emit('sort',$event)"/></template>
 </PageTable></div>
</template>

<style scoped>
.workbench-students-area{width:100%;min-width:0;padding-inline:20px}table.compact-student-table{width:100%;min-width:680px;border-collapse:collapse;table-layout:fixed}.student-area-monthly table{min-width:800px}.habit-student-table{min-width:1040px!important}.student-col{width:200px}.metric-col{width:24%}.state-col{width:16%}.student-area-monthly .metric-col{width:20%}.student-area-monthly .state-col{width:14%}.habit-student-table .metric-col{width:12%}.habit-student-table .stars-col{width:7%}.habit-student-table .state-col{width:10%}.compact-student-table :deep(th:not(:first-child):not(:last-child)),.compact-student-table td:not(:first-child):not(:last-child){text-align:center}
td{padding:11px 12px;white-space:nowrap;border-bottom:1px solid #edf1f6;vertical-align:middle;min-width:0!important}
.workbench-name-cell{min-width:150px!important}
.workbench-name{display:flex;align-items:center;gap:8px;max-width:176px}
.workbench-name>span,.workbench-name>small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.workbench-name>span{flex-shrink:0;max-width:130px}
.workbench-name small{color:#64748b;font-size:13px}
.workbench-name .workbench-outside-mark{flex-shrink:0;color:#916b2d;background:#faf5eb;padding:2px 5px;border-radius:4px}
.workbench-metric{min-width:102px!important;font-variant-numeric:tabular-nums}
.habit-student-table .workbench-metric{min-width:110px!important}
.habit-student-table .workbench-metric[data-metric=stars]{min-width:65px!important}
.metric-secondary{color:#64748b;font-size:14px}.metric-separator{color:#94a3b8}
.workbench-input-state{min-width:105px!important;max-width:145px}
.workbench-input-state details{font-size:13px;color:#64748b}
.workbench-context{min-width:0!important;max-width:400px;white-space:normal;line-height:1.6}
.workbench-class{display:inline-flex;align-items:center;gap:4px;color:#64748b;font-size:13px;line-height:1.6;margin-left:8px}
.workbench-cohort-mark{display:inline-flex;align-items:center;justify-content:center;flex:none;width:19px;height:19px;border:1px solid #b8c5d9;border-radius:50%;color:#536b8d;font-size:12px;font-weight:500;line-height:1;margin-left:2px}
@media(max-width:600px){.workbench-students-area{padding-inline:14px}}
</style>
