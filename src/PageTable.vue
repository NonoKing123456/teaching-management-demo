<script setup lang="ts">
import {ref,shallowRef,onMounted,onUpdated,onBeforeUnmount,onActivated,onDeactivated,nextTick,useId} from 'vue'

const props=withDefaults(defineProps<{label?:string,stickyOffset?:number,hasRows?:boolean,enabled?:boolean}>(),{label:'数据明细',hasRows:true,enabled:true})
const root=ref<HTMLElement>(),floatingScroll=ref<HTMLElement>(),docked=ref(false),local=ref(false),id=useId()
// The body owns horizontal scrolling. Its native timeline also moves the copy
// during compositor scrolling, before JavaScript receives a scroll event.
const timeline=ref(false),timelineName=`--page-table-${id.replace(/[^a-z0-9_-]/gi,'-')}`
const geometry=shallowRef({left:0,top:0,width:0,height:0,tableWidth:0,columns:[] as number[],tableClass:'',collapse:'collapse',clip:0,travel:0})
let active=true
let frame=0,resize:ResizeObserver|undefined,mutations:MutationObserver|undefined
function syncScroll(){
  if(!timeline.value&&root.value&&floatingScroll.value){
    const table=floatingScroll.value.querySelector('table')
    if(table){
      const offset=root.value.scrollLeft+geometry.value.clip
      table.style.transform=`translateX(${-offset}px)`
      table.style.setProperty('--page-table-scroll-offset',`${offset}px`)
    }
  }
}
function headerWheel(event:WheelEvent){
  const element=root.value;if(!element)return
  const amount=event.deltaX||(event.shiftKey?event.deltaY:0)
  if(!amount)return
  const unit=event.deltaMode===1?16:event.deltaMode===2?element.clientWidth:1
  element.scrollLeft+=amount*unit
  // Keep native vertical page scrolling for diagonal trackpad gestures.
  if(!event.deltaY||event.shiftKey)event.preventDefault()
}
function scrolling(event:Event){
  if(event.target===root.value){syncScroll();return}
  if(event.target===document||event.target===window)measure()
}
function sourceHeader(hidden:boolean){
  const head=root.value?.querySelector<HTMLTableSectionElement>(':scope>table>thead')
  if(head){head.inert=hidden;if(hidden)head.setAttribute('aria-hidden','true');else head.removeAttribute('aria-hidden')}
}
function hide(){docked.value=false;sourceHeader(false)}
function measure(){
  cancelAnimationFrame(frame)
  frame=0
  const element=root.value,table=element?.querySelector<HTMLTableElement>(':scope>table'),head=table?.tHead
  if(local.value||!active||!props.enabled||!props.hasRows||!element||!table||!head||!element.getClientRects().length||getComputedStyle(element).visibility==='hidden'){hide();return}
  const box=element.getBoundingClientRect(),tableBox=table.getBoundingClientRect(),headBox=head.getBoundingClientRect()
  const navigation=document.querySelector<HTMLElement>('.topbar')?.getBoundingClientRect()
  const tabs=element.closest('.wb-query-workspace')?.querySelector<HTMLElement>(':scope>.wb-tabs')
  const offset=(navigation&&navigation.bottom>0?navigation.bottom:0)+(props.stickyOffset??tabs?.getBoundingClientRect().height??0)
  const style=getComputedStyle(element),origin=tableBox.left+element.scrollLeft
  const left=Math.max(0,origin),right=Math.min(innerWidth,tableBox.right,box.left+element.clientWidth-parseFloat(style.paddingRight||'0'))
  const visible=!!table.tBodies[0]?.rows.length&&headBox.top<offset&&tableBox.bottom>offset&&right>left
  if(!visible){hide();return}
  sourceHeader(true)
  const cells=Array.from(table.tBodies[0].rows[0].cells)
  const next={left,top:Math.min(offset,tableBox.bottom-headBox.height),width:right-left,height:headBox.height,
    tableWidth:tableBox.width,columns:cells.map(cell=>cell.getBoundingClientRect().width),tableClass:table.className,
    collapse:getComputedStyle(table).borderCollapse,clip:left-origin,travel:Math.max(0,element.scrollWidth-element.clientWidth)}
  if(JSON.stringify(next)!==JSON.stringify(geometry.value))geometry.value=next
  if(!docked.value)docked.value=true
  if(!timeline.value)void nextTick(syncScroll)
}
function schedule(){if(!frame)frame=requestAnimationFrame(measure)}
onMounted(()=>{
  timeline.value=CSS.supports('animation-timeline: --page-table-x')&&CSS.supports('scroll-timeline-name: --page-table-x')
  local.value=!!root.value?.closest('dialog')
  window.addEventListener('scroll',scrolling,true)
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
onActivated(()=>{active=true;schedule()})
onDeactivated(()=>{active=false;hide()})
onBeforeUnmount(()=>{hide();cancelAnimationFrame(frame);resize?.disconnect();mutations?.disconnect();window.removeEventListener('scroll',scrolling,true);window.removeEventListener('resize',schedule)})
</script>

<template>
  <div ref="root" class="table-scroll page-table-scroll" :class="{'page-table-local':local}" :data-page-table="id" :style="{'scroll-timeline-name':timelineName,'scroll-timeline-axis':'inline','--page-table-timeline':timelineName,'--page-table-clip':geometry.clip+'px','--page-table-end':geometry.travel+geometry.clip+'px'}"><slot :docked="docked"/>
    <div v-if="docked" class="page-table-header" :data-table-header="id" role="region" :aria-label="`${props.label}固定表头`" :style="{left:`${geometry.left}px`,top:`${geometry.top}px`,width:`${geometry.width}px`,height:`${geometry.height}px`}">
      <div ref="floatingScroll" class="page-table-header-scroll" @wheel="headerWheel">
        <table :class="[geometry.tableClass,{'page-table-native-pan':timeline&&geometry.travel>0}]" :style="{width:`${geometry.tableWidth}px`,tableLayout:'fixed',borderCollapse:geometry.collapse as 'collapse'|'separate',borderSpacing:'0',transform:timeline&&geometry.travel===0?`translateX(${-geometry.clip}px)`:undefined}"><colgroup><col v-for="(width,index) in geometry.columns" :key="index" :style="{width:`${width}px`}"/></colgroup><slot name="header"/></table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-table-scroll{min-width:0;max-height:none;overflow-x:auto;overscroll-behavior-x:none}
.page-table-scroll :deep(thead[aria-hidden=true]){visibility:hidden}
.page-table-local{overflow:visible}.page-table-local :deep(thead){position:sticky;top:0;z-index:2;background:#f3f6fb}
.page-table-header{position:fixed;z-index:18;overflow:hidden;background:#f3f6fb;box-shadow:0 2px 5px #24344c12}
.page-table-header-scroll{overflow:clip;height:100%}
.page-table-native-pan{animation:page-table-pan 1s linear both;animation-timeline:var(--page-table-timeline)}
.page-table-header :deep(.page-table-frozen-column){transform:translateX(var(--page-table-scroll-offset,0px))}
.page-table-native-pan :deep(.page-table-frozen-column){animation:page-table-freeze 1s linear both;animation-timeline:var(--page-table-timeline)}
@keyframes page-table-freeze{from{transform:translateX(var(--page-table-clip))}to{transform:translateX(var(--page-table-end))}}
@keyframes page-table-pan{from{transform:translateX(calc(-1 * var(--page-table-clip)))}to{transform:translateX(calc(-1 * var(--page-table-end)))}}
</style>
