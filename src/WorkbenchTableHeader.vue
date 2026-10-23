<script setup lang="ts">
import {computed} from 'vue'
import SortableColumn from './SortableColumn.vue'
import {studentMetricColumns,type WorkbenchField} from './workbenchStudentColumns'

const props=withDefaults(defineProps<{kind?:string,fields:WorkbenchField[],sort:string,direction:'asc'|'desc',inactive?:boolean}>(),{kind:'habit'})
defineEmits<{sort:[field:string]}>()
const columns=computed(()=>studentMetricColumns(props.kind,props.fields).map(column=>({...column,primary:column.fields.find(field=>!derived(field[0]))})))
function selected(key:string){return props.sort===key?props.direction:''}
function derived(key:string){return /_(level|rate)$/.test(key)}
function aria(keys:string[]){return keys.includes(props.sort)?(props.direction==='asc'?'ascending':'descending'):'none'}
</script>

<template>
 <thead><tr>
  <th scope="col" class="student-heading" :aria-sort="aria(['name'])"><SortableColumn field="name" label="学生" :direction="selected('name')" default-direction="asc" type="text" :inactive="inactive" @sort="$emit('sort','name')"/></th>
  <th v-for="column in columns" :key="column.key" scope="col" :aria-sort="aria(column.primary?[column.primary[0]]:[])" :data-metric="column.key">
   <SortableColumn v-if="column.primary" :field="column.primary[0]" :label="column.label" :full-label="column.primary[1]" :direction="selected(column.primary[0])" :default-direction="['text','rank'].includes(column.primary[2])?'asc':'desc'" :type="column.primary[2]" :inactive="inactive" @sort="$emit('sort',column.primary[0])"/><span v-else>{{column.label}}</span>
  </th>
  <th scope="col" :aria-sort="aria(['status'])"><SortableColumn field="status" label="填报情况" :direction="selected('status')" default-direction="asc" type="text" :inactive="inactive" @sort="$emit('sort','status')"/></th>
  <th scope="col" class="context-heading" :aria-sort="aria(['teacher','schedule','grade'])">教师／班级</th>
 </tr></thead>
</template>

<style scoped>
th{padding:11px 12px;text-align:left;white-space:nowrap;vertical-align:middle}th:not(:first-child):not(:last-child){text-align:center}
</style>
