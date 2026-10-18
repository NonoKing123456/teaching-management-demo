<script setup lang="ts">
import SortableColumn from './SortableColumn.vue'
type Item=Record<string,any>
const props=defineProps<{tableId:string,groups:Item[],columns:Item[],sortFields?:Item[],sortField?:string,direction?:'asc'|'desc',inactive?:boolean}>()
defineEmits<{sort:[key:string]}>()
function option(key:string){return props.sortFields?.find(field=>field.value===key)}
function aria(key:string){return !option(key)?undefined:props.sortField!==key?'none':props.direction==='asc'?'ascending':'descending'}
</script>

<template>
  <thead>
    <tr class="group-row">
      <th rowspan="2" scope="col" class="classroom-student-header" :aria-sort="aria('student_name')"><SortableColumn v-if="option('student_name')" field="student_name" label="学生" full-label="学生姓名" :direction="sortField==='student_name'?(direction||'asc'):''" default-direction="asc" type="text" :inactive="inactive" @sort="$emit('sort','student_name')"/><template v-else>学生</template></th><th rowspan="2" scope="col">教师</th><th rowspan="2" scope="col">课型</th><th rowspan="2" scope="col">时间段</th>
      <th v-for="(group,index) in groups" :id="`${tableId}-group-${index}`" :key="group.label" :colspan="group.columns.length" scope="colgroup" class="group-start">{{group.label}}</th>
    </tr>
    <tr class="metric-row"><th v-for="column in columns" :id="`${tableId}-${column.key}`" :key="column.key" :headers="`${tableId}-group-${column.group}`" scope="col" :class="{'group-start':column.first}" :aria-sort="aria(column.key)"><SortableColumn v-if="option(column.key)" :field="column.key" :label="column.label" :full-label="option(column.key)?.label" :direction="sortField===column.key?(direction||'desc'):''" :default-direction="option(column.key)?.default_direction||'desc'" :type="option(column.key)?.type||'number'" :inactive="inactive" @sort="$emit('sort',column.key)"/><template v-else>{{column.label}}</template></th></tr>
  </thead>
</template>

<style scoped>
th{padding:12px 8px;text-align:center;vertical-align:middle;border-bottom:1px solid #eaf0f6;white-space:nowrap;background:#f3f6fb}
.group-row th{height:44px;padding:10px 8px;color:#344258}
.metric-row th{height:38px;padding:8px;background:#f8fafc!important;font-weight:500!important}
.group-start{border-left:1px solid #dfe6ef}
.classroom-student-header{position:sticky;left:0;z-index:2;text-align:left;padding-left:16px!important;box-shadow:1px 0 0 #dfe6ef}
</style>
