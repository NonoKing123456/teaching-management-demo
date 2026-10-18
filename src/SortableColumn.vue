<script setup lang="ts">
import {computed} from 'vue'

const props=defineProps<{field:string,label:string,fullLabel?:string,direction:''|'asc'|'desc',defaultDirection:'asc'|'desc',type:string,inactive?:boolean}>()
defineEmits<{sort:[]}>()
const nextDirection=computed(()=>!props.direction?props.defaultDirection:props.direction===props.defaultDirection?(props.direction==='asc'?'desc':'asc'):'')
const actionLabel=computed(()=>{
  const label=props.fullLabel||props.label
  if(!nextDirection.value)return `${label}：恢复原表顺序`
  const order=props.type==='number'?(nextDirection.value==='desc'?'从高到低':'从低到高'):props.type==='date'?(nextDirection.value==='desc'?'从新到旧':'从旧到新'):(nextDirection.value==='desc'?'倒序':'正序')
  return `${label}：${order}排序`
})
</script>

<template>
  <button type="button" class="column-sort" :data-sort-field="field" :aria-label="actionLabel" :title="actionLabel" :tabindex="inactive?-1:undefined" @click="$emit('sort')"><span>{{label}}</span><span class="sort-triangles" aria-hidden="true"><span class="sort-up" :class="{active:direction==='asc'}"></span><span class="sort-down" :class="{active:direction==='desc'}"></span></span></button>
</template>

<style scoped>
.column-sort{display:inline-flex;align-items:center;justify-content:center;gap:6px;max-width:100%;padding:4px 0;margin:-4px 0;border:0;border-radius:3px;background:transparent;color:inherit;font:inherit;line-height:inherit;white-space:nowrap;cursor:pointer}
.column-sort:hover{color:#2459c6}
.column-sort:focus-visible{outline:2px solid #9fbceb;outline-offset:3px}
.sort-triangles{display:inline-flex;flex-direction:column;gap:3px;flex-shrink:0}
.sort-up,.sort-down{width:0;height:0;border-left:3.5px solid transparent;border-right:3.5px solid transparent}
.sort-up{border-bottom:4px solid #b7c1cf}
.sort-down{border-top:4px solid #b7c1cf}
.sort-up.active{border-bottom-color:#2862db}
.sort-down.active{border-top-color:#2862db}
</style>
