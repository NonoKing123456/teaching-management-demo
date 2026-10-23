<script setup lang="ts">
import {CheckCircle2,Circle,CircleDot} from 'lucide-vue-next'
defineProps<{state:string}>()
</script>
<template><span class="submission-state" :class="`submission-${state}`"><CheckCircle2 v-if="state==='complete'" :size="16"/><CircleDot v-else-if="state==='partial'||state==='unknown'" :size="15"/><Circle v-else :size="15"/>{{state==='complete'?'已完成':state==='partial'?'待补全':state==='unknown'?'已提交 · 待核对':state==='not_required'?'无需填报':'未提交'}}</span></template>
<style scoped>.submission-state{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;font-size:14px;color:#778397}.submission-complete{color:#2e7c5a}.submission-partial,.submission-unknown{color:#946c2e}.submission-state svg{flex-shrink:0}</style>
