<script setup lang="ts">
import {computed,ref,nextTick,onMounted,onBeforeUnmount} from 'vue'
import {ChevronDown} from 'lucide-vue-next'
const props=defineProps<{modelValue:string[],options:string[],label:string}>()
const emit=defineEmits<{'update:modelValue':[value:string[]]}>()
const opened=ref(false),trigger=ref<HTMLButtonElement>(),panel=ref<HTMLDivElement>()
const text=computed(()=>props.modelValue.length?props.modelValue.join('、'):`全部${props.label}`)
function select(value:string){emit('update:modelValue',props.modelValue.includes(value)?props.modelValue.filter(x=>x!==value):[...props.modelValue,value])}
function close(){opened.value=false;panel.value?.hidePopover?.()}
async function toggle(){if(opened.value){close();return}opened.value=true;await nextTick();const r=trigger.value!.getBoundingClientRect(),p=panel.value!;p.showPopover?.();const width=Math.min(Math.max(r.width,210),innerWidth-24);Object.assign(p.style,{width:width+'px',left:Math.max(12,Math.min(r.left,innerWidth-width-12))+'px',top:Math.min(r.bottom+6,innerHeight-220)+'px',maxHeight:'210px'})}
function outside(e:Event){if(!panel.value?.contains(e.target as Node)&&!trigger.value?.contains(e.target as Node))close()}
function key(e:KeyboardEvent){if(e.key==='Escape'&&opened.value){e.preventDefault();e.stopPropagation();close();trigger.value?.focus()}}
onMounted(()=>{document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);window.addEventListener('resize',close)})
onBeforeUnmount(()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',close)})
</script>
<template><div class="multi-filter"><button ref="trigger" class="multi-trigger" type="button" :aria-label="label+'多选'" :aria-expanded="opened" @click="toggle"><span>{{text}}</span><ChevronDown :size="16"/></button><Teleport to="body"><div v-if="opened" ref="panel" class="multi-options" popover="manual" role="group" :aria-label="label+'选项'"><button class="text-button" type="button" @click="emit('update:modelValue',[])">全部{{label}}</button><label v-for="value in options" :key="value"><input type="checkbox" :checked="modelValue.includes(value)" @change="select(value)"/>{{value}}</label></div></Teleport></div></template>
<style>.multi-filter{min-width:0}.multi-trigger{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:44px;padding:9px 12px;border:1px solid #dfe5ee;border-radius:7px;background:#fff;font-size:16px;gap:10px;text-align:left}.multi-trigger span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.multi-trigger svg{flex-shrink:0;color:#718096}.multi-trigger:focus-visible{outline:2px solid #a5bff3}.multi-options{position:fixed;inset:auto;margin:0;padding:8px;border:1px solid #e1e7ef;border-radius:9px;background:white;box-shadow:0 6px 22px #1c2c4814;overflow:auto;z-index:1200;color:#344258}.multi-options label{display:flex;align-items:center;gap:10px;padding:9px;border-radius:5px;min-height:42px;font-size:16px}.multi-options label:hover{background:#f1f5fc}.multi-options input{width:16px;height:16px;accent-color:#2563eb}.multi-options>button{padding:7px 9px}</style>
