<script setup lang="ts">
import {ref,computed,onMounted,watch,nextTick} from 'vue'
import {BookOpen,Download,Upload,ArrowRight,Menu,Search,History,LogOut,ChevronRight,CircleHelp,LoaderCircle,CheckCircle2,Home,ClipboardCheck,Phone,GraduationCap,CalendarDays} from 'lucide-vue-next'
import {UsersRound} from 'lucide-vue-next'
import {api,ApiError} from './api'
import {moduleCatalog,primaryModules,supportedPages} from './modules'
import WorkflowPage from './WorkflowPage.vue'
import GeneratorPage from './GeneratorPage.vue'
import DataSearch from './DataSearch.vue'
import TeacherManagement from './TeacherManagement.vue'
import FeedbackMessages from './FeedbackMessages.vue'
import {useFeedback} from './feedback'
type Item=Record<string,any>
const initial=window.location.hash.slice(1),active=ref(supportedPages.has(initial)?initial:'dashboard'),user=ref<Item|null>(null),meta=ref<Item|null>(null),loading=ref(true),busy=ref(false),sidebarOpen=ref(false),logs=ref<Item[]>([])
const {error}=useFeedback(computed(()=>!!user.value))
const loginForm=ref({username:'',password:''})
const loginElement=ref<HTMLFormElement>()
const loginHint=ref('')
function loginInput(){loginHint.value='';error.value=''}
const icons:Item={'weekly-checkin':BookOpen,'monthly-checkin':CalendarDays,classroom:ClipboardCheck,habit:Upload,monthly:Upload,scores:GraduationCap,communication:Phone}
const entry=computed(()=>moduleCatalog.find(m=>m.id===active.value)),title=computed(()=>entry.value?.name||({dashboard:'教学数据中心',students:'数据搜索',audit:'操作记录',settings:'系统说明',teachers:'教师账号管理'} as Item)[active.value]||'首页')
function navigate(id:string){if(id==='teachers'&&user.value?.role!=='manager')id='dashboard';active.value=supportedPages.has(id)?id:'dashboard';window.location.hash=active.value;sidebarOpen.value=false;error.value=''}
async function loadMeta(){meta.value=await api('teaching/metadata/')}
async function retryMeta(){error.value='';try{await loadMeta()}catch(e){error.value=(e as Error).message}}
async function signIn(){
  if(busy.value)return
  error.value='';loginHint.value=''
  const missingAccount=!loginForm.value.username.trim(),missingPassword=!loginForm.value.password.trim()
  if(missingAccount||missingPassword){
    loginHint.value=missingAccount&&missingPassword?'请输入账号和密码。':missingAccount?'请输入账号。':'请输入密码。'
    await nextTick()
    loginElement.value?.querySelector<HTMLInputElement>(`[name="${missingAccount?'username':'password'}"]`)?.focus()
    return
  }
  busy.value=true
  try{const data=await api('login/',{method:'POST',body:JSON.stringify(loginForm.value)});user.value=data.user;loginForm.value.password='';await loadMeta();navigate('dashboard')}catch(e){error.value=(e as Error).message}finally{busy.value=false}
}
async function signOut(){try{await api('logout/',{method:'POST'});user.value=null;meta.value=null;loginForm.value.password='';loginHint.value='';await api('csrf/')}catch(e){error.value=(e as Error).message}}
async function loadLogs(){try{logs.value=(await api('audit/')).items}catch(e){error.value=(e as Error).message}}
watch(active,()=>{if(active.value==='audit')loadLogs()})
onMounted(async()=>{window.addEventListener('hashchange',()=>navigate(window.location.hash.slice(1)));try{await api('csrf/');user.value=await api('me/');await loadMeta();if(active.value==='teachers'&&user.value?.role!=='manager')navigate('dashboard');if(active.value==='audit')await loadLogs()}catch(e){if(!(e instanceof ApiError&&[401,403].includes(e.status)))error.value=(e as Error).message}finally{loading.value=false}})
</script>

<template>
  <div v-if="loading" class="boot-screen"><BookOpen :size="26"/><LoaderCircle class="spin" :size="22"/>正在加载教学数据…</div>
  <main v-else-if="!user" class="login-page">
    <div class="login-intro"><div class="brand"><div class="brand-mark"><BookOpen :size="26"/></div><div><strong>易成教学数据</strong></div></div><div class="login-copy"><div class="eyebrow">上传、整理、分析、下载</div><h1>让每一份数据，<br/>清晰、有序、可追溯。</h1><div class="login-features"><span><CheckCircle2 :size="18"/>多班级 Excel 上传</span><span><CheckCircle2 :size="18"/>周期提交与报表下载</span><span><CheckCircle2 :size="18"/>教师、学生历史查询</span></div></div><small>易成教学数据系统</small></div>
    <div class="login-panel">
      <form ref="loginElement" class="login-form" novalidate @submit.prevent="signIn" @input="loginInput">
        <span class="pill blue">欢迎回来</span><h2>登录工作空间</h2>
        <label>账号<input v-model="loginForm.username" name="username" aria-label="账号" placeholder="请输入账号" autocomplete="username" required :aria-describedby="loginHint||error?'login-feedback':undefined"/></label>
        <label>密码<input v-model="loginForm.password" name="password" aria-label="密码" placeholder="请输入密码" type="password" autocomplete="current-password" required :aria-describedby="loginHint||error?'login-feedback':undefined"/></label>
        <div id="login-feedback" class="login-feedback" :class="{'login-feedback-error':!!error}" role="alert">{{loginHint||error}}</div>
        <button type="submit" class="btn primary login-button" :disabled="busy"><LoaderCircle v-if="busy" class="spin" :size="17"/>进入工作空间<ArrowRight :size="17"/></button>
      </form>
    </div>
  </main>
  <div v-else class="app-shell"><div v-if="sidebarOpen" class="sidebar-backdrop" @click="sidebarOpen=false"></div><aside class="sidebar" :class="{open:sidebarOpen}"><button class="brand brand-button" @click="navigate('dashboard')"><div class="brand-mark"><BookOpen :size="23"/></div><div><strong>易成教学数据</strong></div></button><nav aria-label="主导航"><div class="nav-section"><div class="nav-label">工作空间</div><button class="nav-item" :class="{active:active==='dashboard'}" @click="navigate('dashboard')"><Home :size="18"/>首页</button></div><div class="nav-section"><div class="nav-label">数据模块</div><button v-for="m in primaryModules" :key="m.id" class="nav-item" :class="{active:active===m.id}" @click="navigate(m.id)"><component :is="icons[m.id]" :size="18"/><span>{{m.name}}</span></button></div><div v-if="user.role==='manager'" class="nav-section"><div class="nav-label">管理</div><button class="nav-item" :class="{active:active==='teachers'}" @click="navigate('teachers')"><UsersRound :size="18"/>教师账号管理</button></div></nav><div class="sidebar-bottom"><div class="utility-links"><button class="text-button" @click="navigate('audit')"><History :size="15"/>操作记录</button></div><button class="nav-item" :class="{active:active==='settings'}" @click="navigate('settings')"><CircleHelp :size="18"/>系统说明</button><div class="profile"><div class="avatar">{{user.name.slice(0,1).toUpperCase()}}</div><div><strong>{{user.name}}</strong><span>{{user.role_label}}</span></div><button class="icon-button" aria-label="退出登录" @click="signOut"><LogOut :size="17"/></button></div></div></aside>
    <div class="main-shell"><header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-menu" aria-label="打开导航" @click="sidebarOpen=true"><Menu :size="22"/></button><span class="breadcrumb-root">教学数据工作空间</span><ChevronRight :size="14"/><strong>{{title}}</strong></div><div class="topbar-right"><button class="text-button" @click="navigate('students')"><Search :size="16"/>搜索</button><div class="avatar small">{{user.name.slice(0,1).toUpperCase()}}</div></div></header><main class="content"><div class="page-heading"><div><h1>{{title}}</h1></div></div><div v-if="!meta" class="panel workflow-panel"><p>资料配置加载失败。</p><button class="btn" @click="retryMeta">重试</button></div>
      <section v-if="active==='dashboard'" class="module-grid" aria-label="教学数据模块"><button v-for="(m,index) in primaryModules" :key="m.id" class="module-card" :class="{'module-card-wide':m.id==='classroom'}" :aria-label="m.name" @click="navigate(m.id)"><div class="module-card-top"><span class="module-card-icon" :class="m.id==='weekly-checkin'?'download-tone':'upload-tone'"><component :is="icons[m.id]" :size="25"/></span><span class="module-card-number">{{String(index+1).padStart(2,'0')}}</span></div><h2>{{m.name}}</h2><span class="module-card-action">{{m.action}}<ArrowRight :size="16"/></span></button></section>
      <GeneratorPage v-else-if="meta&&['weekly-checkin','monthly-checkin'].includes(active)" :key="active" :kind="active==='weekly-checkin'?'habit':'monthly'" :user="user" :meta="meta" @navigate="navigate"/>
      <WorkflowPage v-else-if="meta&&meta.kinds[active]" :key="active" :kind="active" :user="user" :meta="meta"/>
      <TeacherManagement v-else-if="meta&&active==='teachers'&&user.role==='manager'" @changed="retryMeta"/>
      <DataSearch v-else-if="meta&&active==='students'" :meta="meta"/>
      <section v-else-if="active==='audit'" class="panel workflow-panel"><div class="workflow-toolbar"><h2>最近 100 次操作</h2><span class="toolbar-spacer"></span><button class="btn" @click="loadLogs">刷新</button></div><div class="table-scroll"><table><thead><tr><th>时间</th><th>操作人</th><th>操作</th><th>说明</th></tr></thead><tbody><tr v-for="l in logs" :key="l.id"><td>{{new Date(l.date).toLocaleString('zh-CN')}}</td><td>{{l.actor}}</td><td>{{({preview:'校验',import:'提交',replace:'替换',delete:'撤回',download:'下载',export:'导出',source:'取源数据',generate:'生成',block_class:'屏蔽班级',restore_class:'恢复班级',create:'新增',update:'修改',reset_password:'重置密码',disable:'停用',enable:'启用'} as Item)[l.action]||l.action}}</td><td class="wrap-cell">{{l.summary}}</td></tr></tbody></table></div></section>
      <section v-else-if="active==='settings'" class="panel workflow-panel help-page"><h2>七个入口的使用流程</h2><ol><li>周习惯取得平台数据并粘贴接龙；月阅读量先导入源数据表。屏蔽班级可在已屏蔽列表恢复。</li><li>补齐课型、时间段并选择提交周期，可直接生成并提交；也可仅下载 Excel。</li><li>手动上传时选择文件并确认入库；本期已有提交须明确确认替换，旧版本保留。</li><li>查看本期明细、课型／教师分析，下载原件、分析表、星币表或个人期末数据。</li><li>搜索工具按学生或教师查询五类有效明细；月阅读量按年级评选超级班级，并按班级评选、轮换明星学员。</li></ol><h2>数据与历史</h2><p>数据库保存有效明细、批次和操作记录；原 Excel 单独保存。替换、撤回保留旧版本，统计只使用当前有效提交。原项目的两份数据库仍作为参考资料保存，本版没有自动迁移真实历史数据。</p><p>老师可查看全体提交人数、本人提交状态、当期分析总表和搜索结果；个人上传、原件下载、删除和个人期末数据跟随本人账号。管理员可代选教师处理；年级干事／组长按授权年级查询。</p><h2>打卡平台连接</h2><p>服务端设置 AUOK_TOKEN 或 AUOK_TOKEN_FILE，以及 AUOK_ORG_ID 后重新启动服务。令牌保留在服务器，不传给浏览器。未配置或取数失败时，可导入源数据 Excel；页面不会用模拟平台数据冒充取数结果。</p><p>源数据模板包含班级、课型、时间段、姓名、英文名、完成度、朗读分和未完成日期。空白保留为未采集，0 为真实零值。成绩等级分析沿用排除 0 的口径；跨期分数比较保留真实 0 分。</p><a v-if="user.role==='manager'" class="btn" href="/admin/" target="_blank" rel="noopener">账号与基础名单后台<ArrowRight :size="16"/></a></section>
    </main></div>
  </div>
  <FeedbackMessages/>
</template>
