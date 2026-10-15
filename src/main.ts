import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

async function start() {
  if (!location.hostname.endsWith('.github.io')) {
    createApp(App).mount('#app')
    return
  }
  const root = document.querySelector<HTMLElement>('#app')!
  root.innerHTML = '<main class="boot-screen">正在进入教学数据系统…</main>'
  try {
    const response = await fetch(new URL(`service.json?t=${Date.now()}`, location.href), { cache: 'no-store' })
    if (!response.ok) throw new Error('Unavailable')
    const config = await response.json()
    const destination = new URL(config.url)
    if (!config.enabled || destination.protocol !== 'https:' || !destination.hostname.endsWith('.trycloudflare.com')) throw new Error('Unavailable')
    destination.hash = location.hash
    location.replace(destination.href)
  } catch {
    root.innerHTML = '<main class="boot-screen"><div><h1>教学数据系统</h1><p style="margin:16px 0">服务暂未开启，请稍后重试或联系管理员。</p><button class="btn primary" id="retry-service">重新连接</button></div></main>'
    document.querySelector('#retry-service')?.addEventListener('click', () => location.reload())
  }
}
start()
