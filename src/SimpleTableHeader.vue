<script setup lang="ts">
defineProps<{columns:string[],titles?:(string|undefined)[]}>()
</script>
<template><thead><tr><th v-for="(column,index) in columns" :key="index" scope="col" :title="titles?.[index]">{{column}}</th></tr></thead></template>
