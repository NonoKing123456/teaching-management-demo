<script setup lang="ts">
import SortableColumn from './SortableColumn.vue'

type Column={key:string,label:string,type:string,width:number,first?:boolean,fullLabel?:string}
type Group={label:string,columns:Column[]}
const props=defineProps<{overview:boolean,columns:Column[],groups:Group[],sort:string,direction:'asc'|'desc',inactive?:boolean}>()
defineEmits<{sort:[key:string]}>()
function selected(key:string){return props.sort===key?props.direction:''}
function derived(key:string){return key.endsWith('_level')||(!props.overview&&key.endsWith('_rate'))}
function aria(key:string){if(derived(key))return undefined;return props.sort===key?(props.direction==='asc'?'ascending':'descending'):'none'}
</script>

<template>
  <thead class="classroom-workbench-header">
    <tr>
      <th class="page-table-frozen-column student-header" :rowspan="overview?1:2" scope="col" :aria-sort="aria('name')"><SortableColumn field="name" label="学生" :direction="selected('name')" default-direction="asc" type="text" :inactive="inactive" @sort="$emit('sort','name')"/></th>
      <template v-if="overview"><th v-for="c in columns" :key="c.key" scope="col" :aria-sort="aria(c.key)"><SortableColumn v-if="!derived(c.key)" :field="c.key" :label="c.label" :full-label="c.fullLabel" :direction="selected(c.key)" :default-direction="c.type==='rank'?'asc':'desc'" :type="c.type" :inactive="inactive" @sort="$emit('sort',c.key)"/><span v-else :title="c.fullLabel||c.label">{{c.label}}</span></th></template>
      <template v-else><th v-for="g in groups" :key="g.label" :colspan="g.columns.length" scope="colgroup" class="metric-group">{{g.label}}</th></template>
      <th :rowspan="overview?1:2" scope="col" :aria-sort="aria('status')"><SortableColumn field="status" label="填报情况" :direction="selected('status')" default-direction="asc" type="text" :inactive="inactive" @sort="$emit('sort','status')"/></th>
      <th :rowspan="overview?1:2" scope="col" class="context-header">教师／班级</th>
    </tr>
    <tr v-if="!overview"><template v-for="g in groups" :key="g.label"><th v-for="(c,i) in g.columns" :key="c.key" :class="{'group-start':i===0}" scope="col" :aria-sort="aria(c.key)"><SortableColumn v-if="!derived(c.key)" :field="c.key" :label="c.label" :full-label="g.label+' '+c.label" :direction="selected(c.key)" :default-direction="c.type==='rank'?'asc':'desc'" :type="c.type" :inactive="inactive" @sort="$emit('sort',c.key)"/><span v-else :title="c.fullLabel||c.label">{{c.label}}</span></th></template></tr>
  </thead>
</template>

<style scoped>
th{padding:11px 8px;text-align:center;white-space:nowrap;font-size:13px;background:#f3f6fb;border-bottom:1px solid #e1e7f0}
.student-header{position:sticky;left:0;z-index:2;text-align:left;padding-left:14px;box-shadow:1px 0 0 #dfe6ef}
.metric-group,.group-start{border-left:1px solid #dfe6ef}.context-header{text-align:left;padding-left:12px}
</style>
