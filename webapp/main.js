// webapp/main.js
const API_BASE = 'https://lineup2-ieb3fdxl.b4a.run'

const state = {
  queues: [],
  user: { username: 'demo' },
  loading: false
}

// функция обращения к API
async function api(path, method = 'GET', body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${API_BASE}${path}`, opts)
  return res.json()
}

// загрузка всех очередей
async function loadQueues() {
  state.queues = await api('/api/queues')
  renderQueues()
}

// присоединение к очереди
async function joinQueue(id) {
  state.loading = true
  renderQueues()
  await api('/api/join', 'POST', { id })
  await loadQueues()
  state.loading = false
}

// отрисовка очередей на странице
function renderQueues() {
  const list = document.getElementById('queue-list')
  list.innerHTML = ''
  state.queues.forEach(q => {
    const item = document.createElement('div')
    item.className = 'queue-item'
    const joined = q.joined || 0
    item.innerHTML = `
      <div style="flex:1">
        <div class="queue-name">${q.name}</div>
        <div class="queue-stake">${q.stake} TON</div>
        <div class="queue-joined">${joined}/10</div>
      </div>
      <button ${joined>=10 || state.loading ? 'disabled' : ''} onclick="joinQueue(${q.id})">
        ${joined>=10 ? 'полная' : 'встать'}
      </button>
    `
    list.appendChild(item)
  })
}

// инициализация MiniApp
async function init() {
  console.log('miniapp loaded')
  try {
    if (window.Telegram?.WebApp?.initData) {
      await api('/api/auth', 'POST', { initData: window.Telegram.WebApp.initData })
      state.user.username = window.Telegram.WebApp.initData.split('&').find(s=>s.startsWith('user='))?.split('=')[1] || 'user'
    } else {
      const demo = await api('/api/demo-session', 'POST')
      state.user = demo.user
    }
  } catch (e) {
    console.error(e)
  }
  loadQueues()
}

// автозапуск
window.onload = init
