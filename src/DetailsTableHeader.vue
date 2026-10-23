<script setup lang="ts">
import SortableColumn from './SortableColumn.vue'
type Item=Record<string,any>
const props=defineProps<{fields:[string,string,string][],sortFields:Item[],sortField:string,direction:'asc'|'desc',inactive?:boolean,showRoster?:boolean,hideContext?:boolean}>()
defineEmits<{sort:[key:string]}>()
function option(key:string){if(/_(level|rate)$/.test(key))return undefined;return props.sortFields.find(field=>field.value===key)}
function aria(key:string){return !option(key)?undefined:props.sortField!==key?'none':props.direction==='asc'?'ascending':'descending'}
</script>

<template>
  <thead><tr><template v-if="!hideContext"><th>教师</th><th v-if="showRoster">班级／名单</th><th>{{showRoster?'年级':'课型'}}</th><th>时间段</th></template><th v-for="field in [['student_name','学生姓名','text'],['english_name','英文名','text'],...fields]" :key="field[0]" :aria-sort="aria(field[0])"><SortableColumn v-if="option(field[0])" :field="field[0]" :label="field[1]" :direction="sortField===field[0]?direction:''" :default-direction="option(field[0])?.default_direction||'desc'" :type="option(field[0])?.type||'number'" :inactive="inactive" @sort="$emit('sort',field[0])"/><template v-else>{{field[1]}}</template></th></tr></thead>
</template>
