<script setup lang="ts">
import {ref,computed,onMounted} from 'vue'
import {api,query} from './api'
import UiSelect from './UiSelect.vue'
import CoveragePanel from './CoveragePanel.vue'
import {classLabel,sortedClasses} from './classPresentation'
type Item=Record<string,any>
const props=defineProps<{batch:Item,meta:Item,user:Item}>()
defineEmits<{close:[]}>()
const dialog=ref<HTMLDialogElement>(),classes=ref<Item[]>([]),selected=ref(''),error=ref('')
const params=computed(()=>({kind:props.batch.kind,year:props.batch.year,term:props.batch.term,period:props.batch.period,batch_id:props.batch.id}))
onMounted(async()=>{dialog.value?.showModal();try{const data=await api(`teaching/coverage/?${query(params.value)}`);classes.value=data.classes||[];selected.value=String(classes.value[0]?.id||'');if(!classes.value.length)error.value=data.unavailable?.[0]?.message||'该历史提交没有可用的完整名单。'}catch(e){error.value=(e as Error).message}})
</script>
<template><dialog ref="dialog" class="batch-roster-dialog" @cancel="$emit('close')"><header><h2>历史提交的名单核对</h2><button type="button" class="btn small" @click="$emit('close')">关闭</button></header><p>{{batch.filename}}</p><p v-if="error" class="info-banner">{{error}}</p><label v-if="classes.length">选择时段<UiSelect wide v-model="selected" aria-label="历史名单班级" :options="sortedClasses(classes).map(c=>({value:String(c.id),label:classLabel(c,{teacher:true,term:true})}))"/></label><CoveragePanel v-if="selected" :params="{...params,class_id:selected}" :fields="meta.kinds[batch.kind].fields" :sort-fields="meta.kinds[batch.kind].sort_fields" :user="user"/></dialog></template>
<style scoped>.batch-roster-dialog{width:min(1200px,calc(100% - 24px));max-height:92dvh;border:1px solid #dfe5ee;border-radius:12px;padding:22px}.batch-roster-dialog::backdrop{background:#17263a55}.batch-roster-dialog header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}.batch-roster-dialog>p{margin:12px 0}.batch-roster-dialog>label{display:flex;align-items:center;gap:12px}</style>
