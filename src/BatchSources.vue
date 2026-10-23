<script setup lang="ts">
import {computed,ref} from 'vue'
import {classLabel} from './classPresentation'
import {downloadFile} from './api'
type Item=Record<string,any>
const props=defineProps<{records:Item[],user?:Item,label?:string}>(),error=ref('')
const groups=computed(()=>{
 const map=new Map<string,Item>()
 for(const row of props.records){const key=`${row.batch_id}:${row.roster_class_id||row.sheet}`;if(!map.has(key))map.set(key,{...row,records:[]});map.get(key)!.records.push(row)}
 return [...map.values()]
})
async function original(id:number){error.value='';try{await downloadFile(`teaching/batches/${id}/`)}catch(e){error.value=(e as Error).message}}
</script>
<template><details v-if="records.length" class="batch-sources"><summary>{{label||`班级与提交信息（${groups.length} 组）`}}</summary><p v-if="error" class="validation-summary" role="alert">{{error}}</p><section v-for="g in groups" :key="`${g.batch_id}:${g.roster_class_id||g.sheet}`"><strong>{{classLabel(g,{teacher:true,term:true})}}</strong><p>{{g.roster_version?'名单版本 '+g.roster_version:'历史记录未关联完整名单'}} · {{g.filename||`提交 ${g.batch_id}`}}</p><details><summary>查看原件行定位</summary><p>班级编号：{{g.roster_class_id||'未关联'}} · 提交编号：{{g.batch_id}}</p><div class="table-scroll"><table><thead><tr><th>学生</th><th>原工作表</th><th>原行号</th></tr></thead><tbody><tr v-for="r in g.records" :key="r.id"><td>{{r.student_name}}</td><td>{{r.sheet}}</td><td>{{r.source_row}}</td></tr></tbody></table></div></details><button v-if="user?.role==='manager'||user?.id===g.teacher_id" type="button" class="text-button" @click="original(g.batch_id)">下载原件</button></section></details></template>
<style scoped>.batch-sources{margin:18px 0;padding:14px 0;border-top:1px solid #edf1f6;line-height:1.8}.batch-sources section{padding:16px 0;border-bottom:1px solid #edf1f6}.batch-sources summary{cursor:pointer}.batch-sources p{color:#667085;margin:5px 0}.batch-sources td{font-size:14px}</style>
