<script setup lang="ts">
import {ref,shallowRef,onMounted,onUpdated,onBeforeUnmount,nextTick,useId} from 'vue'

const props=withDefaults(defineProps<{label?:string}>(),{label:'数据明细'})
const root=ref<HTMLElement>(),floatingScroll=ref<HTMLElement>(),docked=ref(false),id=useId()
const geometry=shallowRef({left:0,top:0,width:0,height:0,tableWidth:0,columns:[] as number[],tableClass:'',collapse:'collapse',clip:0})
let frame=0,resize:ResizeObserver|undefined,mutations:MutationObserver|undefined
function syncScroll(){
  if(root.value&&floatingScroll.value){
    const left=root.value.scrollLeft+geometry.value.clip
    if(Math.abs(floatingScroll.value.scrollLeft-left)>.5)floatingScroll.value.scrollLeft=left
  }
}
function headerScroll(){
  if(root.value&&floatingScroll.value){
    const left=floatingScroll.value.scrollLeft-geometry.value.clip
    if(Math.abs(root.value.scrollLeft-left)>.5)root.value.scrollLeft=left
  }
}
function measure(){
  frame=0
  const element=root.value,table=element?.querySelector<HTMLTableElement>(':scope>table'),head=table?.tHead
  if(!element||!table||!head)return
  const box=element.getBoundingClientRect(),tableBox=table.getBoundingClientRect(),headBox=head.getBoundingClientRect()
  const navigation=document.querySelector<HTMLElement>('.topbar')?.getBoundingClientRect()
  const offset=navigation&&navigation.bottom>0?navigation.bottom:0
  const left=Math.max(0,box.left),right=Math.min(innerWidth,box.left+element.clientWidth)
  const active=!!table.tBodies[0]?.rows.length&&headBox.top<offset&&tableBox.bottom>offset&&right>left
  if(!active){docked.value=false;return}
  const cells=Array.from(table.tBodies[0].rows[0].cells)
  const next={left,top:Math.min(offset,tableBox.bottom-headBox.height),width:right-left,height:headBox.height,
    tableWidth:tableBox.width,columns:cells.map(cell=>cell.getBoundingClientRect().width),tableClass:table.className,
    collapse:getComputedStyle(table).borderCollapse,clip:left-box.left}
  if(JSON.stringify(next)!==JSON.stringify(geometry.value))geometry.value=next
  if(!docked.value){docked.value=true;void nextTick(syncScroll)}
  else syncScroll()
}
function schedule(){if(!frame)frame=requestAnimationFrame(measure);syncScroll()}
onMounted(()=>{
  window.addEventListener('scroll',schedule,true)
  window.addEventListener('resize',schedule)
  resize=new ResizeObserver(schedule)
  mutations=new MutationObserver(schedule)
  if(root.value){
    resize.observe(root.value)
    const table=root.value.querySelector('table');if(table)resize.observe(table)
    mutations.observe(root.value,{childList:true,subtree:true,characterData:true})
  }
  schedule()
})
onUpdated(schedule)
onBeforeUnmount(()=>{cancelAnimationFrame(frame);resize?.disconnect();mutations?.disconnect();window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule)})
</script>

<template>
  <div ref="root" class="table-scroll page-table-scroll" :data-page-table="id"><slot :docked="docked"/>
  <Teleport to="body">
    <div v-if="docked" class="page-table-header" :data-table-header="id" role="region" :aria-label="`${props.label}固定表头`" :style="{left:`${geometry.left}px`,top:`${geometry.top}px`,width:`${geometry.width}px`,height:`${geometry.height}px`}">
      <div ref="floatingScroll" class="page-table-header-scroll" @scroll="headerScroll">
        <table :class="geometry.tableClass" :style="{width:`${geometry.tableWidth}px`,tableLayout:'fixed',borderCollapse:geometry.collapse as 'collapse'|'separate',borderSpacing:'0'}"><colgroup><col v-for="(width,index) in geometry.columns" :key="index" :style="{width:`${width}px`}"/></colgroup><slot name="header"/></table>
      </div>
    </div>
  </Teleport>
  </div>
</template>

<style scoped>
.page-table-scroll{max-height:none;overflow-x:auto}
.page-table-header{position:fixed;z-index:18;overflow:hidden;background:#f3f6fb;box-shadow:0 2px 5px #24344c12}
.page-table-header-scroll{overflow-x:auto;scrollbar-width:none;height:100%}
.page-table-header-scroll::-webkit-scrollbar{display:none}
.page-table-header :deep(th){background:#f3f6fb}
</style>
