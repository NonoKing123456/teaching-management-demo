<script setup lang="ts">
import { AlertCircle, CheckCircle2, X } from 'lucide-vue-next'
import { feedbackMessages } from './feedback'
</script>

<template>
  <Teleport to="body">
    <div class="feedback-stack" aria-label="操作提示">
      <section v-for="item in feedbackMessages" :key="item.id"
        class="feedback-card" :class="item.kind"
        :role="item.kind === 'error' ? 'alert' : 'status'" aria-atomic="true">
        <component :is="item.kind === 'error' ? AlertCircle : CheckCircle2" :size="22" aria-hidden="true"/>
        <div class="feedback-copy">
          <strong>{{item.kind === 'error' ? '操作未完成' : '操作完成'}}</strong>
          <p>{{item.message}}</p>
        </div>
        <button type="button" class="icon-button" :aria-label="item.kind === 'error' ? '关闭错误提示' : '关闭成功提示'" @click="item.dismiss">
          <X :size="18"/>
        </button>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.feedback-stack {
  position: fixed;
  top: 80px;
  right: 24px;
  z-index: 100;
  display: grid;
  gap: 12px;
  width: 460px;
  max-width: calc(100vw - 32px);
  max-height: calc(100dvh - 104px);
  overflow-y: auto;
  pointer-events: none;
}
.feedback-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px;
  border: 1px solid #efbfc3;
  border-left: 4px solid #d44450;
  border-radius: 10px;
  background: #fff5f5;
  color: #9d2934;
  box-shadow: 0 8px 30px #26334924;
  pointer-events: auto;
}
.feedback-card.success { background: #f0fcf6; color: #226747; border-color: #b8ddca; border-left-color: #27845a }
.feedback-card > svg { flex-shrink: 0; margin-top: 3px }
.feedback-copy { flex: 1; min-width: 0; font-size: 16px; line-height: 1.7 }
.feedback-copy strong { display: block; font-weight: 600; margin-bottom: 4px }
.feedback-copy p { white-space: pre-wrap; overflow-wrap: anywhere }
.feedback-card .icon-button { flex-shrink: 0; color: inherit }
@media (max-width: 600px) {
  .feedback-stack { right: 12px; max-width: calc(100vw - 24px) }
  .feedback-card { padding: 14px; gap: 10px }
}
</style>
