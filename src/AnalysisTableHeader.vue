<script setup lang="ts">
import SortableColumn from './SortableColumn.vue'
defineProps<{columns:{key:string,label:string,type:string}[],sort:string,direction:'asc'|'desc',inactive?:boolean}>()
defineEmits<{sort:[key:string]}>()
</script>
<template><thead><tr><th v-for="c in columns" :key="c.key" scope="col" :aria-sort="sort===c.key?(direction==='asc'?'ascending':'descending'):'none'"><SortableColumn :field="c.key" :label="c.label" :direction="sort===c.key?direction:''" :default-direction="c.type==='text'?'asc':'desc'" :type="c.type" :inactive="inactive" @sort="$emit('sort',c.key)"/></th><th scope="col">学生</th></tr></thead></template>
