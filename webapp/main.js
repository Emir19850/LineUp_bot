// webapp/main.js
const API_BASE = 'https://lineup2-ieb3fdxl.b4a.run'

const state = {
  queues: [],
  user: { username: 'demo', balance: 100 },
  loading: false,
  activeTab: 'home',
  selectedStake: 1
}

// универсальная функция запроса к API
async function api(path, method = 'GET', body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${API_BASE}${path}`, opts)
  return res.json()
}

// загрузка всех очередей
async function loadQueues() {
  const data = await api('/api/queues')
  state.queues = data
  render()
}

// присоединение к очереди
async function joinQueue(id) {
  if (state.loading) return
  state.loading = true
  render()
  await api('/api/join', 'POST', { id })
  await loadQueues()
  state.loading = false
  render()
}

// отрисовка вкладок и контента
function render() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div style="flex:1; overflow:auto; padding-bottom:60px;">
      ${state.activeTab === 'home' ? renderHome() : ''}
      ${state.activeTab === 'ranking' ? renderRanking() : ''}
      ${state.activeTab === 'profile' ? renderProfile() : ''}
      ${state.activeTab === 'wallet' ? renderWallet() : ''}
    </div>
    <div style="position:fixed; bottom:0; left:0; right:0; display:flex; background:#111; border-top:1px solid #222;">
      ${renderTabs()}
    </div>
  `
}

// главная вкладка с очередями
function renderHome() {
  const queues = state.queues
    .filter(q => q.stake == state.selectedStake)
    .map(q => `
      <div class="queue-item">
        <div style="flex:1">
          <div>${q.name}</div>
          <div>${q.stake} TON</div>
          <div>${q.joined}/10</div>
        </div>
        <button ${q.joined>=10 || state.loading ? 'disabled' : ''} onclick="joinQueue(${q.id})">
          ${q.joined>=10 ? 'полная' : 'встать'}
        </button>
      </div>
    `).join('')
  return `
    <div style="padding:10px;">
      <h2>Выберите ставку:</h2>
      <div style="display:flex; gap:5px; margin-bottom:10px;">
        ${[1,10,100].map(s=>`<button onclick="setStake(${s})" style="flex:1; background:${state.selectedStake===s?'#2b7dfa':'#333'}">${s} TON</button>`).join('')}
      </div>
      <div>${queues || '<p>Очереди пусты</p>'}</div>
    </div>
  `
}

// вкладка рейтинг
function renderRanking() {
  return `<div style="padding:10px;"><h2>Рейтинг</h2><p>Пока пусто</p></div>`
}

// вкладка профиль
function renderProfile() {
  return `<div style="padding:10px;"><h2>Профиль</h2><p>Имя: ${state.user.username}</p></div>`
}

// вкладка кошелёк
function renderWallet() {
  return `<div style="padding:10px;"><h2>Кошелёк</h2><p>Баланс: ${state.user.balance} TON</p></div>`
}

// нижние вкладки
function renderTabs() {
  const tabs = [
    {id:'home', label:'Главная'},
    {id:'ranking', label:'Рейтинг'},
    {id:'profile', label:'Профиль'},
    {id:'wallet', label:'Кошелёк'}
  ]
  return tabs.map(t=>`
    <div style="flex:1; text-align:center; padding:10px; color:${state.activeTab===t.id?'#2b7dfa':'#888'}; cursor:pointer;" onclick="switchTab('${t.id}')">
      ${t.label}
    </div>
  `).join('')
}

// смена активной вкладки
function switchTab(tab) {
  state.activeTab = tab
  render()
}

// выбор ставки
function setStake(value) {
  state.selectedStake = value
  render()
}

// инициализация MiniApp
async function init() {
  try {
    if (window.Telegram?.WebApp?.initData) {
      await api('/api/auth', 'POST', { initData: window.Telegram.WebApp.initData })
      state.user.username = 'tg_user'
    } else {
      const demo = await api('/api/demo-session', 'POST')
      state.user = demo.user
    }
  } catch(e) { console.error(e) }
  await loadQueues()
}

// старт
window.onload = init
