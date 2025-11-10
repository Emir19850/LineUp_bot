// webapp/main.js
const API_BASE = 'https://lineup2-ieb3fdxl.b4a.run'

const state = {
  queues: [],
  user: { username: 'demo' },
  loading: false,
  activeTab: 'queues',
  activeStake: 1
}

async function api(path, method = 'GET', body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${API_BASE}${path}`, opts)
  return res.json()
}

// ======================== Рендер вкладок ========================
function renderTabs() {
  const tabs = document.getElementById('tabs')
  tabs.innerHTML = ''
  const tabList = ['queues','profile','wallet']
  tabList.forEach(tab => {
    const el = document.createElement('div')
    el.textContent = tab === 'queues' ? 'Игры' : tab === 'profile' ? 'Профиль' : 'Кошелёк'
    el.className = state.activeTab === tab ? 'active' : ''
    el.onclick = () => { state.activeTab = tab; renderContent(); renderTabs(); }
    tabs.appendChild(el)
  })
}

// ======================== Рендер контента ========================
function renderContent() {
  const container = document.getElementById('content')
  if (!container) return console.error('#content not found')
  container.innerHTML = ''

  if (state.activeTab === 'queues') {
    // выбор ставки
    const stakesDiv = document.createElement('div')
    stakesDiv.className = 'stakes'
    [1,10,100].forEach(val => {
      const btn = document.createElement('button')
      btn.className = 'stake-button' + (state.activeStake===val?' active':'')
      btn.textContent = val+' TON'
      btn.onclick = () => { state.activeStake=val; renderContent() }
      stakesDiv.appendChild(btn)
    })
    container.appendChild(stakesDiv)

    // очереди
    state.queues.forEach(q=>{
      const item = document.createElement('div')
      item.className = 'queue-item'
      item.innerHTML = `
        <div>${q.name}</div>
        <div>${q.stake} TON</div>
        <div>${q.joined}/10</div>
        <button onclick="joinQueue(${q.id})">встать</button>
      `
      container.appendChild(item)
    })
  } else if (state.activeTab === 'profile') {
    const p = document.createElement('div')
    p.textContent = `Имя: ${state.user.username}` // теперь берём username из state
    container.appendChild(p)
  } else if (state.activeTab === 'wallet') {
    const w = document.createElement('div')
    w.textContent = `TON: 100 (демо)` // пока статично
    container.appendChild(w)
  }
}

// ======================== API ========================
async function loadQueues() {
  const data = await api('/api/queues')
  state.queues = data
  renderContent()
}

async function joinQueue(id) {
  await api('/api/join','POST',{id})
  loadQueues()
}

async function init() {
  console.log('miniapp loaded')
  try {
    let userData
    if (window.Telegram?.WebApp?.initData) {
      const res = await api('/api/auth','POST',{initData: window.Telegram.WebApp.initData})
      if(res.ok && res.user) userData = res.user
    } else {
      const res = await api('/api/demo-session','POST')
      if(res.ok && res.user) userData = res.user
    }
    if(userData) state.user = userData
  } catch(e){console.error(e)}
  
  renderTabs()
  loadQueues()
}

window.onload = init
