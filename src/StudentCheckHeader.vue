<script setup lang="ts">
import SortableColumn from './SortableColumn.vue'
type Item=Record<string,any>
const props=defineProps<{fields:Item[],sortFields?:Item[],sortField:string,direction:'asc'|'desc',inactive?:boolean}>()
defineEmits<{sort:[key:string]}>()
function option(key:string){if(key.endsWith('_level')||key.endsWith('_rate'))return undefined;return ['student_name','english_name'].includes(key)?{type:'text',default_direction:'asc'}:props.sortFields?.find(f=>f.value===key)}
function aria(key:string){return option(key)?props.sortField===key?(props.direction==='asc'?'ascending':'descending'):'none':undefined}
</script>
<template><thead><tr><th :aria-sort="aria(sortField==='english_name'?'english_name':'student_name')"><div class="student-check-name-heading"><SortableColumn field="student_name" label="学生" :direction="sortField==='student_name'?direction:''" default-direction="asc" type="text" :inactive="inactive" @sort="$emit('sort','student_name')"/><span class="student-check-english-sort"><SortableColumn field="english_name" label="英文名" :direction="sortField==='english_name'?direction:''" default-direction="asc" type="text" :inactive="inactive" @sort="$emit('sort','english_name')"/></span></div></th><th>填写状态／待处理问题</th><th v-for="f in fields" :key="f[0]" :aria-sort="aria(f[0])"><SortableColumn v-if="option(f[0])" :field="f[0]" :label="f[1]" :direction="sortField===f[0]?direction:''" :default-direction="option(f[0])?.default_direction" :type="option(f[0])?.type" :inactive="inactive" @sort="$emit('sort',f[0])"/><template v-else>{{f[1]}}</template></th><th>原件定位</th></tr></thead></template>
<style scoped>.student-check-name-heading{display:flex;align-items:center;gap:12px}.student-check-english-sort{font-size:12px;color:#748094}</style>
