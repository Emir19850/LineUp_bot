// webapp/main.js
const API_BASE = '{{API_BASE}}' // потом заменишь

const state = {
  queues: [],
  user: { username: 'demo' },
  loading: false
}

async function api(path, method = 'GET', body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${API_BASE}${path}`, opts)
  return res.json()
}

async function loadQueues() {
  const data = await api('/api/queues')
  state.queues = data
  renderQueues()
}

async function joinQueue(id) {
  await api('/api/join', 'POST', { id })
  loadQueues()
}

function renderQueues() {
  const list = document.getElementById('queue-list')
  list.innerHTML = ''
  state.queues.forEach(q => {
    const item = document.createElement('div')
    item.className = 'queue-item'
    item.innerHTML = `
      <div class="queue-name">${q.name}</div>
      <div class="queue-stake">${q.stake} TON</div>
      <div class="queue-joined">${q.joined}/10</div>
      <button onclick="joinQueue(${q.id})">встать</button>
    `
    list.appendChild(item)
  })
}

async function init() {
  console.log('miniapp loaded')
  try {
    if (window.Telegram?.WebApp?.initData) {
      await api('/api/auth', 'POST', { initData: window.Telegram.WebApp.initData })
    } else {
      await api('/api/demo-session', 'POST')
    }
  } catch (e) {
    console.error(e)
  }
  loadQueues()
}

window.onload = init
