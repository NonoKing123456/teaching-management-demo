import {nextTick,onBeforeUnmount} from 'vue'

type Ticket={id:number,container:HTMLElement|null,spacer:HTMLDivElement,target:HTMLElement,left:number,table:HTMLElement|null,tableLeft:number}
// Reserve only the scrolling tail while rows change. Remove it after landing at a
// position the natural, unreserved document can support; short last pages never snap.
export function usePaginationScroll(target:()=>HTMLElement|null|undefined){
 let serial=0,current:Ticket|undefined,frame=0,resolve:((value:void)=>void)|undefined
 function cancel(){
  ++serial;cancelAnimationFrame(frame)
  if(current){const c=current.container;if(c)c.scrollTo({top:c.scrollTop,left:c.scrollLeft,behavior:'instant'});else window.scrollTo({top:scrollY,left:scrollX,behavior:'instant'});current.spacer.remove();current=undefined}
  resolve?.();resolve=undefined
 }
 function prepare(){
  cancel();const element=target();if(!element)return
  const dialog=element.closest('dialog');let container:HTMLElement|null=null
  if(dialog){for(let p=element.parentElement;p;p=p.parentElement){if(/auto|scroll/.test(getComputedStyle(p).overflowY)){container=p;break}if(p===dialog)break}container ||= dialog}
  const table=element.matches('[data-page-table]')?element:element.querySelector<HTMLElement>('[data-page-table]')
  const spacer=document.createElement('div');spacer.setAttribute('aria-hidden','true');spacer.dataset.paginationSpace='';spacer.style.cssText=`height:${container?container.scrollHeight:document.documentElement.scrollHeight}px;min-height:0;flex:none;pointer-events:none;overflow-anchor:none`
  const ticket={id:serial,container,spacer,target:element,left:container?container.scrollLeft:scrollX,table,tableLeft:table?.scrollLeft||0};(container||document.body).append(spacer);current=ticket;return ticket
 }
 async function finish(ticket:Ticket|undefined,valid:()=>boolean=()=>true){
  await nextTick()
  // Callers clear loading indicators in finally; let that DOM update settle too.
  await new Promise<void>(done=>requestAnimationFrame(()=>done()))
  if(!ticket||current!==ticket)return
  if(!valid()||!ticket.target.isConnected||!ticket.target.getClientRects().length){cancel();return}
  const c=ticket.container,rect=ticket.target.getBoundingClientRect(),height=ticket.spacer.getBoundingClientRect().height
  const tabs=ticket.target.closest('.wb-query-workspace')?.querySelector<HTMLElement>(':scope>.wb-tabs')
  const offset=c?c.getBoundingClientRect().top+c.clientTop+parseFloat(getComputedStyle(c).paddingTop||'0'):(document.querySelector<HTMLElement>('.topbar')?.getBoundingClientRect().bottom||0)+(tabs?.getBoundingClientRect().height||0)+8
  const top=(c?c.scrollTop:scrollY)+rect.top-offset
  const maximum=Math.max(0,(c?c.scrollHeight:document.documentElement.scrollHeight)-height-(c?c.clientHeight:innerHeight))
  const destination=Math.max(0,Math.min(top,maximum))
  if(ticket.table)ticket.table.scrollLeft=ticket.tableLeft
  const scrollTo=(behavior:ScrollBehavior)=>{if(c)c.scrollTo({top:destination,left:ticket.left,behavior});else window.scrollTo({top:destination,left:ticket.left,behavior})}
  scrollTo(matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth')
  await new Promise<void>(done=>{resolve=done;const started=performance.now();let stable=0,last=c?c.scrollTop:scrollY
   const tick=()=>{
    if(current!==ticket)return
    if(!valid()||!ticket.target.isConnected||!ticket.target.getClientRects().length){cancel();return}
    const position=c?c.scrollTop:scrollY;stable=Math.abs(position-last)<.5?stable+1:0;last=position
    if((stable>=3&&Math.abs(position-destination)<2)||performance.now()-started>1800){ticket.spacer.remove();current=undefined;resolve=undefined;done();return}
    frame=requestAnimationFrame(tick)
   };frame=requestAnimationFrame(tick)
  })
 }
 onBeforeUnmount(cancel)
 return {prepare,finish,cancel}
}
