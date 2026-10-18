<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, useId, watch } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'

defineOptions({ inheritAttrs: false })
type Value = string | number
type Option = { value: Value; label: string; disabled?: boolean }
const props = defineProps<{ modelValue: Value; options: Option[]; disabled?: boolean; required?: boolean; name?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: Value]; change: [value: Value] }>()
const attrs = useAttrs(), id = useId(), listId = `select-list-${id}`
const trigger = ref<HTMLButtonElement>(), panel = ref<HTMLUListElement>()
const opened = ref(false), active = ref(-1), target = ref<HTMLElement | string>('body')
const side = ref('bottom')
const selected = computed(() => props.options.findIndex(option => option.value === props.modelValue))
const label = computed(() => props.options[selected.value]?.label || '请选择')
const unavailable = computed(() => props.disabled || !props.options.some(option => !option.disabled))
let frame = 0, search = '', lastKey = 0
const optionId = (index: number) => `${listId}-option-${index}`

function close() { opened.value = false; search = '' }
function keepVisible() {
  const list = panel.value, option = list?.children[active.value] as HTMLElement | undefined
  if (!list || !option) return
  if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop
  else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight)
    list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight
}
function position(element = panel.value) {
  if (!opened.value || !element || !trigger.value) return
  const rect = trigger.value.getBoundingClientRect(), viewport = window.visualViewport
  const leftEdge = (viewport?.offsetLeft || 0) + 8, topEdge = (viewport?.offsetTop || 0) + 8
  const rightEdge = leftEdge + (viewport?.width || document.documentElement.clientWidth) - 16
  const bottomEdge = topEdge + (viewport?.height || window.innerHeight) - 16
  if (rect.bottom < topEdge || rect.top > bottomEdge || rect.right < leftEdge || rect.left > rightEdge) { close(); return }
  const width = Math.min(Math.max(rect.width, 180), rightEdge - leftEdge)
  element.style.width = `${width}px`
  const below = bottomEdge - rect.bottom - 6, above = rect.top - topEdge - 6
  const aboveTrigger = below < Math.min(288, element.scrollHeight + 2) && above > below
  const maxHeight = Math.max(0, Math.min(288, aboveTrigger ? above : below))
  element.style.maxHeight = `${maxHeight}px`
  side.value = aboveTrigger ? 'top' : 'bottom'
  Object.assign(element.style, {
    width: `${width}px`, maxHeight: `${maxHeight}px`,
    left: `${Math.max(leftEdge, Math.min(rect.left, rightEdge - width))}px`,
    top: `${aboveTrigger ? Math.max(topEdge, rect.top - 6 - element.offsetHeight) : rect.bottom + 6}px`,
    visibility: 'visible',
  })
}
function schedulePosition(event?: Event) {
  if (!opened.value || event?.target === panel.value) return
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => position())
}
function enter(element: Element) {
  const list = element as HTMLUListElement
  list.inert = false
  list.removeAttribute('aria-hidden')
  if (typeof list.showPopover === 'function') list.showPopover()
  position(list)
  keepVisible()
}
async function open() {
  if (unavailable.value || opened.value) return
  target.value = trigger.value?.closest('dialog') || document.body
  window.dispatchEvent(new CustomEvent('teaching-select-open', { detail: id }))
  active.value = selected.value >= 0 && !props.options[selected.value]?.disabled
    ? selected.value : props.options.findIndex(option => !option.disabled)
  opened.value = true
  await nextTick()
  keepVisible()
}
function choose(index: number) {
  const option = props.options[index]
  if (!opened.value || unavailable.value || !option || option.disabled) return
  close()
  trigger.value?.focus({ preventScroll: true })
  if (option.value !== props.modelValue) {
    emit('update:modelValue', option.value)
    emit('change', option.value)
  }
}
function move(direction: number) {
  let index = active.value + direction
  while (index >= 0 && index < props.options.length) {
    if (!props.options[index]?.disabled) { active.value = index; void nextTick(keepVisible); return }
    index += direction
  }
}
function keydown(event: KeyboardEvent) {
  if (unavailable.value) return
  if (event.key === 'Tab') { close(); return }
  if (event.key === 'Escape') {
    if (opened.value) { event.preventDefault(); event.stopPropagation(); close() }
    return
  }
  if (['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault()
    if (event.key === 'Enter' || event.key === ' ') { if (opened.value) choose(active.value); else void open(); return }
    if (event.key === 'Home' || event.key === 'End') {
      if (!opened.value) void open()
      const indices = props.options.map((_, index) => index).filter(index => !props.options[index]?.disabled)
      active.value = (event.key === 'Home' ? indices[0] : indices.at(-1)) ?? -1
      void nextTick(keepVisible)
    } else if (!opened.value) void open()
    else move(event.key === 'ArrowDown' ? 1 : -1)
  } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    if (!opened.value) void open()
    const now = Date.now()
    search = now - lastKey < 700 ? search + event.key.toLocaleLowerCase() : event.key.toLocaleLowerCase()
    lastKey = now
    const index = props.options.findIndex(option => !option.disabled && option.label.toLocaleLowerCase().startsWith(search))
    if (index >= 0) { active.value = index; void nextTick(keepVisible) }
  }
}
function outside(event: Event) {
  const node = event.target as Node
  if (opened.value && !trigger.value?.contains(node) && !panel.value?.contains(node)) close()
}
function otherOpened(event: Event) { if ((event as CustomEvent).detail !== id) close() }
const observer = new ResizeObserver(() => schedulePosition())
onMounted(() => {
  document.addEventListener('pointerdown', outside, true)
  document.addEventListener('focusin', outside)
  window.addEventListener('teaching-select-open', otherOpened)
  window.addEventListener('scroll', schedulePosition, true)
  window.addEventListener('resize', schedulePosition)
  window.visualViewport?.addEventListener('resize', schedulePosition)
  window.visualViewport?.addEventListener('scroll', schedulePosition)
  if (trigger.value) observer.observe(trigger.value)
})
onBeforeUnmount(() => {
  close(); observer.disconnect(); cancelAnimationFrame(frame)
  document.removeEventListener('pointerdown', outside, true)
  document.removeEventListener('focusin', outside)
  window.removeEventListener('teaching-select-open', otherOpened)
  window.removeEventListener('scroll', schedulePosition, true)
  window.removeEventListener('resize', schedulePosition)
  window.visualViewport?.removeEventListener('resize', schedulePosition)
  window.visualViewport?.removeEventListener('scroll', schedulePosition)
})
watch(() => props.disabled, disabled => { if (disabled) close() })
watch(() => props.options, () => {
  if (unavailable.value) close()
  if (opened.value) { active.value = selected.value; void nextTick(() => { position(); keepVisible() }) }
}, { deep: true })
defineExpose({ focus: () => trigger.value?.focus() })
</script>

<template>
  <span class="ui-select">
    <button ref="trigger" v-bind="attrs" class="ui-select-trigger" type="button" role="combobox"
      :name="name" :disabled="unavailable" aria-haspopup="listbox" :aria-expanded="opened"
      :aria-controls="opened ? listId : undefined" :aria-activedescendant="opened && active >= 0 ? optionId(active) : undefined"
      :aria-required="required || undefined" @click="opened ? close() : open()" @keydown="keydown">
      <span class="ui-select-value">{{label}}</span><ChevronDown :size="17" aria-hidden="true" :class="{'ui-select-arrow-open':opened}"/>
    </button>
    <input v-if="name" type="hidden" :name="name" :value="modelValue" :disabled="disabled"/>
    <Teleport :to="target">
      <Transition name="select-popup" @enter="enter" @before-leave="element => { element.setAttribute('aria-hidden','true'); (element as HTMLElement).inert=true }">
        <ul v-if="opened" :id="listId" ref="panel" class="ui-select-popup" role="listbox" popover="manual"
          :aria-label="String(attrs['aria-label'] || '选项')" :data-side="side"
          @pointerdown="$event.pointerType === 'mouse' && $event.preventDefault()">
          <li v-for="(option,index) in options" :id="optionId(index)" :key="`${typeof option.value}:${option.value}`"
            role="option" :aria-selected="index === selected" :aria-disabled="option.disabled || undefined"
            class="ui-select-option" :class="{'is-selected': index === selected, 'is-active':index === active}"
            @pointermove="!option.disabled && (active=index)" @click="choose(index)">
            <span>{{option.label}}</span><Check v-if="index === selected" :size="17" aria-hidden="true"/>
          </li>
        </ul>
      </Transition>
    </Teleport>
  </span>
</template>

<style>
.ui-select{display:inline-block;vertical-align:middle;min-width:0;max-width:100%}
.ui-select-trigger{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:44px;padding:10px 12px;border:1px solid #dfe5ee;border-radius:7px;background:#fff;color:#344258;font-size:16px;line-height:1.4;text-align:left;transition:border-color .15s,box-shadow .15s}
.ui-select-trigger:not(:disabled):hover{border-color:#b8c9e3}.ui-select-trigger:focus-visible,.ui-select-trigger[aria-expanded="true"]{outline:none;border-color:#89aef9;box-shadow:0 0 0 3px #2563eb12}
.ui-select-trigger:disabled{opacity:1;color:#778397;background:#f7f9fc;cursor:not-allowed}.ui-select-trigger>svg{flex-shrink:0;color:#718096;transition:transform .14s}
.ui-select-arrow-open{transform:rotate(180deg)}.ui-select-value{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ui-select-trigger[aria-invalid="true"]{border-color:#d9a4ab}.ui-select-trigger[aria-invalid="true"]:focus-visible{border-color:#89aef9}
.ui-select-popup{position:fixed;inset:auto;margin:0;padding:4px;box-sizing:border-box;list-style:none;border:1px solid #e1e7ef;border-radius:8px;background:#fff;color:#344258;box-shadow:0 6px 22px #1c2c4814;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;z-index:1000;visibility:hidden;font-size:16px;line-height:1.5}
.ui-select-popup::backdrop{background:transparent}.ui-select-option{display:flex;justify-content:space-between;align-items:center;gap:14px;min-height:44px;padding:9px 10px;border-radius:5px;cursor:pointer;overflow-wrap:anywhere}
.ui-select-option>span{min-width:0}.ui-select-option>svg{flex-shrink:0;color:#2563eb}.ui-select-option.is-selected{background:#f1f5fc;color:#2455a4}
.ui-select-option.is-active{background:#edf3fc;outline:1px solid #dce7f7;outline-offset:-1px}.ui-select-option[aria-disabled="true"]{background:transparent;color:#8691a1;cursor:not-allowed}
.select-popup-enter-active,.select-popup-leave-active{transition:opacity .14s ease,transform .14s ease}.select-popup-enter-from,.select-popup-leave-to{opacity:0;transform:translateY(4px)}
.select-popup-enter-from[data-side="top"],.select-popup-leave-to[data-side="top"]{transform:translateY(-4px)}.select-popup-leave-active{pointer-events:none}
.workflow-toolbar label>.ui-select{width:160px}.workflow-toolbar>.ui-select{min-width:126px}.field>.ui-select{width:100%}
@media(max-width:600px){.workflow-toolbar label:has(>.ui-select){flex:1 1 140px;min-width:140px}.workflow-toolbar label>.ui-select{width:100%}.ui-select-popup{max-width:calc(100vw - 16px)}}
@media(prefers-reduced-motion:reduce){.select-popup-enter-active,.select-popup-leave-active,.ui-select-trigger>svg{transition:none}.select-popup-enter-from,.select-popup-leave-to{transform:none!important}}
</style>
