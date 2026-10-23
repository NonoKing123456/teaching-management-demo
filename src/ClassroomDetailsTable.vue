<script setup lang="ts">
import {computed,useId} from 'vue'
import {teacherLabel} from './modules'
import PageTable from './PageTable.vue'
import ClassroomTableHeader from './ClassroomTableHeader.vue'
import {classroomGroups} from './classroomColumns'

type Field=[string,string,string]
type Item=Record<string,any>
const props=defineProps<{items:Item[],fields:Field[],teachers:{id:unknown,name:string}[],sortFields?:Item[],sortField?:string,sortDirection?:'asc'|'desc',showRoster?:boolean,hideContext?:boolean}>()
defineEmits<{sort:[key:string],trace:[row:Item]}>()
const tableId=useId()
const groups=computed(()=>classroomGroups(props.fields))
const columns=computed(()=>groups.value.flatMap((group,index)=>group.columns.map((column,i)=>({...column,group:index,first:i===0}))))
const tableWidth=computed(()=>(props.hideContext?144:436)+columns.value.reduce((total,column)=>total+column.width,0))
function val(value:unknown,type?:string){return value===null||value===undefined||value===''?'—':type==='percent'?`${value}%`:value}
</script>

<template>
  <PageTable class="classroom-table-scroll" label="课堂过关数据明细" role="region" aria-label="课堂过关数据明细" tabindex="0"><template #default="{docked}">
    <table class="classroom-details" :style="{width:`max(100%, ${tableWidth}px)`}">
      <colgroup><col style="width:144px"/><template v-if="!hideContext"><col style="width:108px"/><col style="width:100px"/><col style="width:84px"/></template></colgroup>
      <colgroup v-for="group in groups" :key="group.label"><col v-for="column in group.columns" :key="column.key" :style="{width:`${column.width}px`}"/></colgroup>
      <ClassroomTableHeader :show-roster="false" :hide-context="hideContext" :groups="groups" :columns="columns" :sort-fields="sortFields" :sort-field="sortField" :direction="sortDirection" @sort="$emit('sort',$event)" :table-id="tableId" :inactive="docked"/>
      <tbody>
        <tr v-for="row in items" :key="row.id">
          <th :id="`${tableId}-student-${row.id}`" scope="row" class="classroom-student-cell" :title="`${row.student_name}${row.english_name?' / '+row.english_name:''}`"><span class="student-name">{{row.student_name}}</span><span v-if="row.english_name" class="student-english" :aria-label="`英文名 ${row.english_name}`">{{row.english_name}}</span></th>
          <template v-if="!hideContext"><td data-column="teacher" class="context-cell" :title="teacherLabel(row,teachers)">{{teacherLabel(row,teachers)}}</td><td class="context-cell" :title="row.class_type">{{row.class_type}}</td><td class="context-cell" :title="row.class_time">{{row.class_time}}</td></template>
          <td v-for="column in columns" :key="column.key" :data-field="column.key" :headers="`${tableId}-student-${row.id} ${tableId}-group-${column.group} ${tableId}-${column.key}`" class="metric-cell" :class="{'group-start':column.first,'empty-metric':row.data[column.key]===null||row.data[column.key]===undefined}">{{val(row.data[column.key],column.type)}}</td>
        </tr>
      </tbody>
    </table></template><template #header><ClassroomTableHeader :show-roster="false" :hide-context="hideContext" :groups="groups" :columns="columns" :sort-fields="sortFields" :sort-field="sortField" :direction="sortDirection" @sort="$emit('sort',$event)" :table-id="tableId+'-floating'"/></template></PageTable>
</template>

<style scoped>
.classroom-table-scroll{overflow-x:auto;isolation:isolate}
.classroom-table-scroll:focus-visible{outline:2px solid #9fbceb;outline-offset:-2px}
.classroom-details{table-layout:fixed;border-collapse:separate;border-spacing:0}
.classroom-details th,.classroom-details td{min-width:0;padding:12px 8px;text-align:center;vertical-align:middle;border-bottom:1px solid #eaf0f6;white-space:nowrap}
.group-start{border-left:1px solid #dfe6ef}
.classroom-details tbody tr:nth-child(even)>*{background:#fafbfd}
.classroom-details tbody tr:nth-child(odd)>*{background:#fff}
.classroom-details tbody tr:hover>*{background:#f0f5fb}
.classroom-details .classroom-student-header,.classroom-details .classroom-student-cell{position:sticky;left:0;text-align:left;padding-left:16px;box-shadow:1px 0 0 #dfe6ef}
.classroom-details .classroom-student-cell{z-index:2;font-weight:500}
.student-name,.student-english{display:block;overflow:hidden;text-overflow:ellipsis}
.student-name{font-size:16px;color:#263349}
.student-english{font-size:14px;font-weight:400;color:#667085;margin-top:2px}
.metric-cell{font-variant-numeric:tabular-nums}
.context-cell{overflow:hidden;text-overflow:ellipsis}
.roster-context span{display:block;overflow:hidden;text-overflow:ellipsis}.roster-context small{font-size:13px}
.empty-metric{color:#8994a5}
</style>
