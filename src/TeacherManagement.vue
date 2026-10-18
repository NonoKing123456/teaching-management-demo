<script setup lang="ts">
import UiSelect from './UiSelect.vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { LoaderCircle, Plus, Search, X } from 'lucide-vue-next'
import { api, query } from './api'
import { useFeedback } from './feedback'
import FieldError from './FieldError.vue'
import { useFormValidation, required, passwordError } from './formValidation'

type Teacher = { id: number; username: string; display_name: string; platform_name: string; is_active: boolean }
type Mode = 'create' | 'password' | 'status'
const emit = defineEmits<{ changed: [] }>()
const { error, notice } = useFeedback()
const search = ref(''), status = ref(''), page = ref(1), total = ref(0)
const teachers = ref<Teacher[]>([]), loading = ref(false), saving = ref(false)
const dialog = ref<HTMLDialogElement>(), firstInput = ref<HTMLInputElement>()
const mode = ref<Mode>('create'), selected = ref<Teacher | null>(null), formError = ref('')
const form = ref({ username: '', display_name: '', platform_name: '', password: '', confirm: '' })
const formElement = ref<HTMLFormElement>()
const validation = useFormValidation(() => mode.value === 'status' ? {} : {
  ...(mode.value === 'create' ? {
    username: () => required(form.value.username, '登录账号') || (!/^[\p{L}\p{N}\p{M}@.+_-]+$/u.test(form.value.username.trim()) ? '账号不能含空格，可使用文字、数字和 @ . + - _。' : ''),
    display_name: () => required(form.value.display_name, '教师姓名'),
    platform_name: () => form.value.platform_name.length > 60 ? '平台教师姓名最多 60 个字符。' : '',
  } : {}),
  password: () => passwordError(form.value.password),
  confirm: () => required(form.value.confirm, '确认密码') || (form.value.password !== form.value.confirm ? '两次输入的密码不一致，请重新输入。' : ''),
}, {password: ['confirm']})
function inputChanged(event: Event) { validation.change((event.target as HTMLInputElement).name); formError.value = '' }
const pages = computed(() => Math.max(1, Math.ceil(total.value / 30)))
const title = computed(() => mode.value === 'create' ? '新增教师' : mode.value === 'password' ? '重置密码' : selected.value?.is_active ? '停用教师账号' : '启用教师账号')
let version = 0

async function load() {
  const current = ++version
  loading.value = true; error.value = ''
  try {
    const data = await api<{ items: Teacher[]; total: number }>(`teachers/?${query({search: search.value, status: status.value, offset: (page.value - 1) * 30})}`)
    if (current !== version) return
    teachers.value = data.items; total.value = data.total
    if (page.value > pages.value) page.value = pages.value
  } catch (e) { if (current === version) error.value = (e as Error).message }
  finally { if (current === version) loading.value = false }
}
function applySearch() { if (page.value === 1) load(); else page.value = 1 }
watch(status, applySearch); watch(page, load); onMounted(load)

async function open(action: Mode, teacher: Teacher | null = null) {
  mode.value = action; selected.value = teacher; formError.value = ''; error.value = ''; notice.value = ''
  form.value = {username: teacher?.username || '', display_name: teacher?.display_name || '', platform_name: teacher?.platform_name || '', password: '', confirm: ''}
  validation.reset()
  dialog.value?.showModal()
  await nextTick(); firstInput.value?.focus()
}
function close() { if (!saving.value) dialog.value?.close() }
function clearPasswords() { form.value.password = ''; form.value.confirm = ''; formError.value = ''; validation.reset() }
async function save() {
  if (saving.value) return
  formError.value = ''
  if (!validation.validate(formElement.value)) return
  saving.value = true
  const action = title.value
  try {
    if (mode.value === 'create') {
      await api('teachers/', {method: 'POST', body: JSON.stringify({username: form.value.username, display_name: form.value.display_name, platform_name: form.value.platform_name, password: form.value.password})})
    } else if (mode.value === 'password') {
      await api(`teachers/${selected.value!.id}/password/`, {method: 'POST', body: JSON.stringify({password: form.value.password})})
    } else {
      const data = {is_active: !selected.value!.is_active}
      await api(`teachers/${selected.value!.id}/`, {method: 'PATCH', body: JSON.stringify(data)})
    }
    dialog.value?.close(); clearPasswords(); notice.value = `${action}成功。`
    emit('changed'); await load()
  } catch (e) { if (!validation.applyServerErrors(e, formElement.value)) formError.value = (e as Error).message }
  finally { saving.value = false }
}
</script>

<template>
  <section class="panel workflow-panel teacher-management" aria-label="教师账号列表">
    <p>账号与教师姓名创建后固定。离职请停用原账号，新员工请新增账号。</p>
    <form class="workflow-toolbar" role="search" @submit.prevent="applySearch">
      <label class="search-grow">查找教师<input v-model="search" placeholder="登录账号或教师姓名" maxlength="150"/></label>
      <label>账号状态<UiSelect v-model="status" aria-label="账号状态" :options="[{value:'',label:'全部状态'},{value:'active',label:'已启用'},{value:'inactive',label:'已停用'}]"/></label>
      <button class="btn" :disabled="loading"><Search :size="17"/>查询</button>
      <span class="toolbar-spacer"></span>
      <button class="btn primary" type="button" @click="open('create')"><Plus :size="18"/>新增教师</button>
    </form>
    <div v-if="loading" class="loading-inline"><LoaderCircle class="spin" :size="18"/>正在加载教师…</div>
    <div class="table-scroll"><table><thead><tr><th>账号 ID</th><th>登录账号</th><th>教师姓名</th><th>平台教师姓名</th><th>状态</th><th>操作</th></tr></thead>
      <tbody><tr v-for="teacher in teachers" :key="teacher.id">
        <td>{{teacher.id}}</td><td>{{teacher.username}}</td><td>{{teacher.display_name}}</td><td>{{teacher.platform_name || teacher.display_name}}</td>
        <td><span class="account-status" :class="teacher.is_active ? 'enabled' : 'disabled'">{{teacher.is_active ? '已启用' : '已停用'}}</span></td>
        <td><div class="teacher-actions"><button class="text-button" @click="open('password', teacher)">重置密码</button><button class="text-button" :class="{'danger-text': teacher.is_active}" @click="open('status', teacher)">{{teacher.is_active ? '停用' : '启用'}}</button></div></td>
      </tr></tbody></table>
      <div v-if="!loading && !teachers.length" class="empty-state compact">暂无符合条件的教师账号。</div>
    </div>
    <div class="workflow-footer"><span>共 {{total}} 位教师</span><div class="pagination"><button class="btn small" :disabled="page <= 1 || loading" @click="page--">上一页</button><span>{{page}} / {{pages}}</span><button class="btn small" :disabled="page >= pages || loading" @click="page++">下一页</button></div></div>
  </section>
  <dialog ref="dialog" class="teacher-dialog" aria-labelledby="teacher-dialog-title" @cancel="saving ? $event.preventDefault() : undefined" @close="clearPasswords">
    <form ref="formElement" novalidate @submit.prevent="save" @input="inputChanged" @focusout="validation.touch(($event.target as HTMLInputElement).name)">
      <header class="modal-header"><h2 id="teacher-dialog-title">{{title}}</h2><button type="button" class="icon-button" aria-label="关闭窗口" :disabled="saving" @click="close"><X :size="21"/></button></header>
      <div class="modal-body teacher-form">
        <template v-if="mode === 'create'">
          <p>账号、教师姓名及平台姓名创建后不可修改。</p>
          <label class="field">登录账号 <span class="required-mark" aria-hidden="true">*</span><input ref="firstInput" v-model="form.username" name="username" aria-label="登录账号" required maxlength="150" autocomplete="off" :aria-invalid="!!validation.errors.username" :aria-describedby="validation.errors.username ? 'teacher-username-error' : undefined"/><FieldError id="teacher-username-error" :message="validation.errors.username"/></label>
          <label class="field">教师姓名 <span class="required-mark" aria-hidden="true">*</span><input v-model="form.display_name" name="display_name" aria-label="教师姓名" required maxlength="60" autocomplete="off" :aria-invalid="!!validation.errors.display_name" :aria-describedby="validation.errors.display_name ? 'teacher-name-error' : undefined"/><FieldError id="teacher-name-error" :message="validation.errors.display_name"/></label>
          <label class="field">平台教师姓名（选填）<input v-model="form.platform_name" name="platform_name" aria-label="平台教师姓名（选填）" maxlength="60" placeholder="留空则使用教师姓名" autocomplete="off" :aria-invalid="!!validation.errors.platform_name" :aria-describedby="validation.errors.platform_name ? 'teacher-platform-error' : undefined"/><FieldError id="teacher-platform-error" :message="validation.errors.platform_name"/></label>
        </template>
        <p v-if="mode === 'password'">为 <strong>{{selected?.display_name}}</strong>（{{selected?.username}}）设置新密码，原密码及已有登录会话将失效。</p>
        <template v-if="mode === 'create' || mode === 'password'">
          <label class="field">{{mode === 'create' ? '初始密码' : '新密码'}} <span class="required-mark" aria-hidden="true">*</span><input v-model="form.password" name="password" :aria-label="mode === 'create' ? '初始密码' : '新密码'" type="password" required minlength="8" maxlength="128" autocomplete="new-password" :aria-invalid="!!validation.errors.password" :aria-describedby="validation.errors.password ? 'teacher-password-error' : undefined"/><FieldError id="teacher-password-error" :message="validation.errors.password"/></label>
          <label class="field">确认密码 <span class="required-mark" aria-hidden="true">*</span><input v-model="form.confirm" name="confirm" aria-label="确认密码" type="password" required minlength="8" maxlength="128" autocomplete="new-password" :aria-invalid="!!validation.errors.confirm" :aria-describedby="validation.errors.confirm ? 'teacher-confirm-error' : undefined"/><FieldError id="teacher-confirm-error" :message="validation.errors.confirm"/></label>
          <p class="password-rule">至少 8 位，避免全数字、常见密码或与账号相似。</p>
        </template>
        <template v-if="mode === 'status'">
          <p>确认{{selected?.is_active ? '停用' : '启用'}} <strong>{{selected?.display_name}}</strong>（{{selected?.username}}）？</p>
          <p v-if="selected?.is_active">停用后将退出当前登录，不再列入未交名单。原件、历史提交和操作记录继续保留。</p>
          <p v-else>启用后可使用原账号密码登录，并重新纳入应交名单。</p>
        </template>
        <p v-if="formError" class="error-inline" role="alert">{{formError}}</p>
      </div>
      <footer class="modal-footer validation-footer"><button type="button" class="btn" :disabled="saving" @click="close">取消</button><button class="btn primary" @pointerdown="!validation.validate(formElement) && $event.preventDefault()" :class="{danger: mode === 'status' && selected?.is_active}" :disabled="saving"><LoaderCircle v-if="saving" class="spin" :size="17"/>{{saving ? '正在保存…' : mode === 'create' ? '创建账号' : mode === 'status' ? '确认' : '保存'}}</button></footer>
    </form>
  </dialog>
</template>

<style scoped>
.teacher-actions {display:flex;gap:22px;align-items:center}
.account-status {display:inline-flex;align-items:center;gap:7px;padding:4px 11px;border-radius:6px;font-size:15px}
.account-status::before {content:'';width:7px;height:7px;border-radius:50%;background:currentColor}
.account-status.enabled {color:#20754d;background:#edf8f2}
.account-status.disabled {color:#526075;background:#eef1f5}
.teacher-dialog {width:560px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 40px);padding:0;border:0;border-radius:12px;color:#263349;box-shadow:0 20px 80px #1c2c4840;margin:auto;overflow:hidden}
.teacher-dialog::backdrop {background:#1c2c4866}
.teacher-dialog form {display:flex;flex-direction:column;max-height:calc(100dvh - 40px)}
.teacher-dialog h2 {font-size:21px}
.teacher-form {display:grid;gap:18px}
.teacher-form p {line-height:1.8;font-size:16px}
.teacher-form input {width:100%;font-size:16px;min-height:44px}
.teacher-form input[readonly] {background:#f3f6fb;color:#526075}
.teacher-form .password-rule {font-size:15px;color:#526075}
.teacher-form .error-inline {margin:0}
.teacher-management>.loading-inline {margin-bottom:16px}
@media(max-width:600px) {.teacher-actions{gap:18px}.teacher-dialog .modal-header{padding:18px}.teacher-dialog .modal-body{padding:18px}.teacher-dialog .modal-footer{padding:15px 18px}.teacher-management .search-grow{min-width:100%}}
</style>
