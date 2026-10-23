<script setup lang="ts">
defineProps<{filled:boolean}>()
</script>

<template><span class="filling-state" :class="filled?'filling-state-filled':'filling-state-unfilled'">{{filled?'已填':'未填'}}</span></template>

<style scoped>
.filling-state{display:inline-flex;align-items:center;gap:5px;padding:3px 6px;border-radius:4px;font-size:13px;font-weight:400;line-height:1.5;white-space:nowrap;vertical-align:middle}
.filling-state::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor;flex:none}
.filling-state-filled{color:#34735a;background:#eef7f1}
.filling-state-unfilled{color:#748094;background:#f2f4f7}
</style>
