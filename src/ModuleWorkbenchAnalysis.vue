<script setup lang="ts">
import {computed,ref} from 'vue'
import UiSelect from './UiSelect.vue'
import PageTable from './PageTable.vue'
import SimpleTableHeader from './SimpleTableHeader.vue'
import {Download} from 'lucide-vue-next'
import {query} from './api'
import {teacherLabel} from './modules'
type Item=Record<string,any>
const props=defineProps<{kind:string,summary:Item,scope:Item,user:Item,meta:Item}>()
const emit=defineEmits<{download:[path:string]}>()
const dimension=ref('course_stats'),classroomMetric=ref('首音／听音／词汇正确率')
const classroomColumns=computed(()=>[dimension.value==='course_stats'?'年级':'教师','人数 / 有效 / 空白','A+','A','B','C','D'])
const superColumns=['年级','排名','教师','课型 / 时间段','班均泛读数量'],starColumns=['学生','泛读数量','学习天数','轮换情况','教师／班级'],classColumns=['教师','课型 / 时间段','人数','平均泛读数量','平均学习天数','阅读量未填'],scoreColumns=['年级','参与分析 / 总人数','平均分','100分人数 / 占比','90分及以上 / 占比','90分以下 / 占比']
const metricOptions=computed(()=>[...new Set<string>((props.summary.course_stats||props.summary.teacher_stats||[]).map((r:Item)=>r.metric))].map(value=>({value,label:value})))
const classroomRows=computed(()=>(props.summary[dimension.value]||[]).filter((r:Item)=>r.metric===classroomMetric.value))
const finalTeacher=computed(()=>props.user.role==='teacher'?props.user.id:props.scope.teacher_id)
function download(mode:string){emit('download',`teaching/export/?${query({...props.scope,mode,...(mode==='final'?{period:'',teacher_id:finalTeacher.value}:{})})}`)}
function value(v:any,type=''){return v===null||v===undefined||v===''?'—':type==='percent'?`${v}%`:v}
function classKey(r:Item){return `${r.teacher_id}:${r.roster_class_id||r.class_type+':'+r.class_time}`}
</script>
<template>
 <div class="module-analysis">
  <div class="analysis-tools"><span>{{summary.count}} 条有效明细 · {{summary.classes}} 个班级 · {{summary.teachers}} 位教师<span v-if="kind==='classroom'"> · 星币 {{summary.stars}}</span></span><div><button class="btn small" :disabled="!summary.count" @click="download('analysis')"><Download :size="15"/>下载分析总表</button><button v-if="kind==='classroom'" class="btn small" :disabled="!summary.count" @click="download('stars')">下载星币总表</button><button v-if="kind==='classroom'&&finalTeacher" class="btn small" @click="download('final')">{{user.role==='teacher'?'我的期末课堂数据':'该教师期末课堂数据'}}</button></div></div>
  <template v-if="kind==='classroom'">
   <details class="analysis-help"><summary>统计口径</summary><p>只填写实际开展的项目；空白不参与该项目的等级占比。星币、年级及教师统计沿用原有规则。</p></details>
   <div class="classroom-analysis-controls"><label>统计范围<UiSelect v-model="dimension" aria-label="课堂统计范围" :options="[{value:'course_stats',label:'按年级'},{value:'teacher_stats',label:'按教师'}]"/></label><label>课堂指标<UiSelect wide v-model="classroomMetric" aria-label="课堂分析指标" :options="metricOptions"/></label></div>
   <PageTable label="课堂分组分析" :has-rows="!!classroomRows.length"><table><SimpleTableHeader :columns="classroomColumns"/><tbody><tr v-for="r in classroomRows" :key="r.unit"><td>{{r.unit}}</td><td>{{r.count}} / {{r.valid}} / {{r.missing}}</td><td v-for="rank in ['A+','A','B','C','D']" :key="rank">{{r.ranks[rank].count}} 人 · {{value(r.ranks[rank].rate,'percent')}}</td></tr></tbody></table><template #header><SimpleTableHeader :columns="classroomColumns"/></template></PageTable>
   <p class="analysis-help">完整教师及年级统计可下载分析总表。</p>
  </template>
  <template v-if="kind==='monthly'">
   <details class="analysis-help"><summary>评选规则</summary><p>超级班级按年级的班均泛读数量排名，名额为班级数的20%向上取整，至少3班，不超过实际班级数；同分比较平均学习天数。明星学员每班2名，优先其他学生，不足时由上月获奖者补位；同分比较学习天数。</p></details>
   <p v-if="summary.legacy_count" class="legacy-note">{{summary.legacy_count}} 条旧版月习惯记录不参加阅读量评选，原表仍可在提交历史查看。</p>
   <h3>超级班级 {{summary.super_classes?.length||0}} 个</h3><PageTable label="超级班级" :has-rows="!!summary.super_classes?.length"><table><SimpleTableHeader :columns="superColumns"/><tbody><tr v-for="r in summary.super_classes||[]" :key="classKey(r)"><td>{{r.group}}</td><td>{{r.rank}}</td><td>{{teacherLabel(r,meta.teachers)}}</td><td>{{r.class_type}}{{r.is_experimental?' · 实验班':''}} · {{r.class_time}}</td><td>{{value(r.reading_count)}}</td></tr></tbody></table><template #header><SimpleTableHeader :columns="superColumns"/></template></PageTable>
   <h3>明星学员 {{summary.star_students?.length||0}} 人</h3><PageTable label="明星学员" :has-rows="!!summary.star_students?.length"><table class="star-students-table"><SimpleTableHeader :columns="starColumns"/><tbody><tr v-for="r in summary.star_students||[]" :key="classKey(r)+':'+(r.roster_student_id||r.student_name+r.english_name)"><td>{{r.student_name}}<small v-if="r.english_name">{{r.english_name}}</small></td><td>{{value(r.data.reading_count)}}</td><td>{{value(r.data.study_days)}}</td><td>{{r.data.repeat_star?'上月获奖补位':'本月入选'}}</td><td class="star-context">{{teacherLabel(r,meta.teachers)}} · {{r.class_type}} · {{r.class_time}}<span v-if="typeof r.is_experimental==='boolean'"> · {{r.is_experimental?'实验班':'普通班'}}</span></td></tr></tbody></table><template #header><SimpleTableHeader :columns="starColumns"/></template></PageTable>
   <h3>班级情况</h3><PageTable label="班级情况" :has-rows="!!summary.class_stats?.length"><table><SimpleTableHeader :columns="classColumns"/><tbody><tr v-for="r in summary.class_stats||[]" :key="classKey(r)"><td>{{teacherLabel(r,meta.teachers)}}</td><td>{{r.class_type}}{{r.is_experimental?' · 实验班':''}} · {{r.class_time}}</td><td>{{r.count}}</td><td>{{value(r.reading_count)}}</td><td>{{value(r.study_days)}}</td><td>{{r.missing}} 人</td></tr></tbody></table><template #header><SimpleTableHeader :columns="classColumns"/></template></PageTable>
  </template>
  <template v-if="kind==='scores'"><details class="analysis-help"><summary>统计口径</summary><p>分析沿用原口径，排除空白和0分；真实0分仍在学生明细中计为已填，并参与跨期比较。</p></details><PageTable label="成绩年级分析" :has-rows="!!summary.score_stats?.length"><table><SimpleTableHeader :columns="scoreColumns"/><tbody><tr v-for="r in summary.score_stats||[]" :key="r.unit"><td>{{r.unit}}</td><td>{{r.count}} / {{r.total}}</td><td>{{value(r.average)}}</td><td>{{r.perfect}} / {{value(r.perfect_rate,'percent')}}</td><td>{{r.high}} / {{value(r.high_rate,'percent')}}</td><td>{{r.low}} / {{value(r.low_rate,'percent')}}</td></tr></tbody></table><template #header><SimpleTableHeader :columns="scoreColumns"/></template></PageTable></template>
  <p v-if="!summary.count" class="empty-state compact">本期尚无可分析的数据。</p>
 </div>
</template>
<style scoped>
.module-analysis table{max-width:none}
.classroom-analysis-controls{display:flex;gap:18px;flex-wrap:wrap;margin:18px 0}.classroom-analysis-controls label{display:grid;gap:7px;min-width:150px;font-size:14px;color:#64748b}
.module-analysis{padding:0 20px 22px;min-width:0}.analysis-tools{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;font-size:14px;color:#667085}.analysis-tools>div{display:flex;gap:8px;flex-wrap:wrap}.analysis-help{font-size:13px;color:#718096;margin:16px 0}.analysis-help summary{cursor:pointer}.analysis-help p{line-height:1.8;margin:8px 0}.module-analysis h3{font-size:16px;margin:22px 0 12px}.module-analysis table{width:100%;font-size:14px;border-collapse:collapse}.module-analysis :deep(th),.module-analysis td{padding:12px;white-space:nowrap;border-bottom:1px solid #edf1f6;text-align:left}.module-analysis td small{display:inline;color:#718096;margin-left:7px;font-size:13px}.legacy-note{font-size:14px;color:#916b2d;line-height:1.8;background:#faf5eb;border-radius:5px;padding:10px 12px}@media(max-width:620px){.module-analysis{padding:0 14px 16px}.analysis-tools>.btn{font-size:13px}}
.module-analysis .star-students-table{width:100%;max-width:none;min-width:640px;margin-inline:auto}.star-students-table :deep(th:nth-child(2)),.star-students-table :deep(th:nth-child(3)),.star-students-table td:nth-child(2),.star-students-table td:nth-child(3){text-align:center}.star-students-table .star-context{max-width:280px;white-space:normal;line-height:1.6}
</style>
