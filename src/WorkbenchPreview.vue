<script setup lang="ts">
import {computed} from 'vue'
import RosterCheck from './RosterCheck.vue'

type Item=Record<string,any>
const props=withDefaults(defineProps<{kind?:string,check:Item,errors?:Item[]}>(),{kind:'habit',errors:()=>[]})
const mapping=defineModel<Record<string,string>>({default:()=>({})})
defineEmits<{recheck:[],manage:[]}>()
const verified=computed(()=>!props.errors.length&&props.check.classes.length&&props.check.classes.every((c:Item)=>c.class_id&&c.roster_count>0&&c.students?.length===c.roster_count&&!c.errors?.length&&!c.extra?.length&&!c.duplicates?.length&&c.students.every((s:Item)=>props.kind==='habit'?s.status==='complete':!s.needs_review&&['complete','recorded'].includes(s.status))))
const pending=computed(()=>props.check.classes.some((c:Item)=>!c.class_id||c.candidates?.length||c.extra?.some((s:Item)=>!s.allowed)))
const generalErrors=computed(()=>props.errors.filter(e=>!props.check.classes.some((c:Item)=>c.sheet===e.sheet)))
</script>
<template>
 <section class="workbench-preview" aria-label="本次上传覆盖与缺项">
  <p v-if="verified" class="preview-all-clear">✓ {{kind==='habit'?'名单学生均已填齐。':'名单对应完整，已填数据通过校验。'}}</p>
  <p v-else-if="pending" class="preview-pending">班级或学生待核对，请处理下方问题。</p>
  <ul v-if="generalErrors.length" class="preview-file-errors"><li v-for="(e,i) in generalErrors" :key="i">{{e.sheet?e.sheet+' · ':''}}{{e.row?'第 '+e.row+' 行 · ':''}}{{e.message}}</li></ul>
  <RosterCheck v-model="mapping" :check="check" :errors="errors" @manage="$emit('manage')" @recheck="$emit('recheck')"/>
 </section>
</template>
<style scoped>
.workbench-preview{min-width:0}.preview-all-clear{color:#27805e;font-size:14px;margin:14px 0}.preview-pending{color:#a36b20;font-size:14px;margin:14px 0}.preview-file-errors{list-style:none;margin:12px 0;padding:10px 13px;background:#fff5f4;border-radius:7px;font-size:13px;line-height:1.8;color:#b54746;overflow-wrap:anywhere}
</style>

