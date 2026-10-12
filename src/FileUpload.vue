<script setup lang="ts">
import { ref, watch } from 'vue'
import { Upload, LoaderCircle } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  busy?: boolean
  disabled?: boolean
  filename?: string
  title?: string
  buttonText?: string
}>(), {
  busy: false,
  disabled: false,
  filename: '',
  title: '上传本期 Excel 数据',
  buttonText: '选择文件并校验',
})
const emit = defineEmits<{ select: [file: File], invalid: [message: string] }>()
const input = ref<HTMLInputElement | null>(null)
const dragDepth = ref(0)
const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types || []).includes('Files')

function select(files: FileList | null) {
  if (props.busy || props.disabled || !files?.length) return
  if (files.length !== 1) {
    emit('invalid', '请一次上传一份 Excel，多班级放在同一文件的不同工作表。')
    return
  }
  const file = files[0]!
  if (!/\.xlsx$/i.test(file.name)) {
    emit('invalid', '仅支持 .xlsx 文件，请选择 Excel 工作簿。')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    emit('invalid', '文件超过 10 MB，请缩小文件后重新上传。')
    return
  }
  emit('select', file)
}

function choose(event: Event) {
  const element = event.target as HTMLInputElement
  select(element.files)
  element.value = ''
}

function dragEnter(event: DragEvent) {
  if (!props.busy && !props.disabled && hasFiles(event)) dragDepth.value++
}

function dragOver(event: DragEvent) {
  if (!event.dataTransfer) return
  const allowed = !props.busy && !props.disabled && hasFiles(event)
  event.dataTransfer.dropEffect = allowed ? 'copy' : 'none'
  if (allowed && !dragDepth.value) dragDepth.value = 1
}

function drop(event: DragEvent) {
  dragDepth.value = 0
  select(event.dataTransfer?.files || null)
}

watch(() => props.busy || props.disabled, () => { dragDepth.value = 0 })
</script>

<template>
  <div class="upload-zone" :class="{'is-dragging':dragDepth>0,'is-disabled':disabled||busy}"
    role="group" :aria-label="title" :aria-busy="busy" :aria-disabled="disabled||busy"
    @dragenter.prevent.stop="dragEnter" @dragover.prevent.stop="dragOver"
    @dragleave.prevent.stop="dragDepth=Math.max(0,dragDepth-1)" @drop.prevent.stop="drop">
    <LoaderCircle v-if="busy" class="spin" :size="30"/><Upload v-else :size="30"/>
    <strong>{{busy?'正在处理文件…':dragDepth?'松开鼠标，上传 Excel 文件':filename||title}}</strong>
    <span>拖入文件或点击选择 · .xlsx · 最大 10 MB</span>
    <input ref="input" type="file" accept=".xlsx" class="hidden-input" :disabled="busy||disabled" @change="choose"/>
    <button type="button" class="btn primary" :disabled="busy||disabled" @click="input?.click()">
      <LoaderCircle v-if="busy" class="spin" :size="16"/>{{buttonText}}
    </button>
  </div>
</template>
