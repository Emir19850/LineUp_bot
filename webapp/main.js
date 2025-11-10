// main.js — demo frontend that integrates with server via API
// it expects server endpoints described below
console.log('miniapp front loaded')

/* -------- helpers -------- */
const $ = sel => document.querySelector(sel)
const $$ = sel => Array.from(document.querySelectorAll(sel))

/* -------- ui refs -------- */
const queueList = $('#queueList')
const joinBtn = $('#joinBtn')
const playerNameInput = $('#playerName')
const customBet = $('#customBet')
const betBtns = $$('.betBtn')
const resultBox = $('#roundResult')
const resultText = $('#resultText')
const newRoundBtn = $('#newRoundBtn')

const meNameEl = $('#meName')
const meBalEl = $('#meBal')
const walletBalEl = $('#walletBal')
const depositBtn = $('#depositBtn')
const depositVal = $('#depositVal')
const rankingEl = $('#ranking')

/* ---- tabs ---- */
const navBtns = $$('.navBtn')
const tabs = $$('.tab')
navBtns.forEach(b=>{
  b.addEventListener('click', ()=> {
    navBtns.forEach(x=>x.classList.remove('active'))
    b.classList.add('active')
    tabs.forEach(t=>t.classList.remove('active'))
    document.getElementById(b.dataset.tab).classList.add('active')
  })
})

/* -------- state -------- */
let session = null       // session token from backend
let me = { id: null, name: null, balance: 0 }
let currentQueue = []    // local mirror
let currentBet = 1

/* -------- pick default bet UI -------- */
betBtns.forEach(btn=>{
  btn.addEventListener('click', ()=> {
    betBtns.forEach(x=>x.classList.remove('active'))
    btn.classList.add('active')
    currentBet = parseInt(btn.dataset.bet,10)
    customBet.value = ''
  })
})
customBet.addEventListener('input', ()=> {
  const v = parseInt(customBet.value,10)
  if(v>0) currentBet = v
})

/* -------- server config (set this in deploy) -------- */
const API_BASE = '{{API_BASE}}' // replace with real backend url on deploy, e.g. https://your-app.onrender.com

/* -------- init: if opened inside telegram webapp -> get initData and authenticate -------- */
async function initAuth(){
  try{
    if(window.Telegram?.WebApp){
      const tg = window.Telegram.WebApp
      tg.ready()
      const initData = tg.initData || null
      // send initData to backend for verification and session creation
      if(initData){
        const res = await fetch(API_BASE + '/api/auth', {
          method:'POST',
          headers:{'content-type':'application/json'},
          body: JSON.stringify({initData})
        })
        const j = await res.json()
        if(j.ok){
          session = j.session
          me = j.user
          playerNameInput.value = me.name || ''
          meNameEl.textContent = me.name || '-'
          meBalEl.textContent = me.balance
          walletBalEl.textContent = me.balance
          refreshQueues()
        } else {
          console.warn('auth failed', j)
        }
      }
    } else {
      // opened in browser (debug): create demo session
      const res = await fetch(API_BASE + '/api/demo-session', {method:'POST'})
      const j = await res.json()
      session = j.session
      me = j.user
      playerNameInput.value = me.name || ''
      meNameEl.textContent = me.name || '-'
      meBalEl.textContent = me.balance
      walletBalEl.textContent = me.balance
      refreshQueues()
    }
  }catch(e){
    console.error('initAuth err',e)
  }
}

/* -------- queue UI update -------- */
function renderQueue(list){
  queueList.innerHTML = ''
  if(!list || list.length===0){
    queueList.innerHTML = '<li class="muted">нет игроков</li>'
    return
  }
  list.forEach((p,i)=>{
    const li = document.createElement('li')
    li.textContent = `${i+1}. ${p.name} (${p.bet} TON)`
    queueList.appendChild(li)
  })
}

/* -------- refresh from server -------- */
async function refreshQueues(){
  if(!API_BASE) return
  try{
    const res = await fetch(API_BASE + '/api/queues')
    const j = await res.json()
    // server returns list of queues (by bet) and session user balance
    if(j.ok){
      // find queue for current bet
      const q = j.queues.find(x=>x.bet === currentBet) || {players:[]}
      renderQueue(q.players)
      // update me balance if provided
      if(j.me) {
        me = j.me
        meNameEl.textContent = me.name
        meBalEl.textContent = me.balance
        walletBalEl.textContent = me.balance
      }
      // ranking
      rankingEl.innerHTML = ''
      j.ranking.slice(0,20).forEach(r=>{
        const li = document.createElement('li')
        li.textContent = `${r.name} — ${r.balance} TON`
        rankingEl.appendChild(li)
      })
    }
  }catch(e){
    console.warn('refreshQueues err', e)
  }
}

/* -------- join queue -------- */
joinBtn.addEventListener('click', async ()=>{
  const name = playerNameInput.value.trim()
  if(!name) return alert('введи ник')
  if(!session) return alert('нет сессии, обнови страницу')
  const payload = { session, name, bet: currentBet }
  try{
    const res = await fetch(API_BASE + '/api/join', {
      method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload)
    })
    const j = await res.json()
    if(j.ok){
      renderQueue(j.queue.players)
      if(j.roundClosed){
        resultText.innerHTML = j.resultText
        resultBoxShow(true)
      }
      // update local me balance if any
      if(j.me) { me = j.me; meBalEl.textContent = me.balance; walletBalEl.textContent = me.balance }
    } else alert(j.msg || 'ошибка')
  }catch(e){ console.error(e); alert('ошибка запроса') }
})

function resultBoxShow(show){
  if(show) resultBox.classList.remove('hidden')
  else resultBox.classList.add('hidden')
}

/* -------- deposit demo -------- */
depositBtn.addEventListener('click', async ()=>{
  const v = parseFloat(depositVal.value)
  if(isNaN(v) || v<=0) return alert('введи сумму')
  const res = await fetch(API_BASE + '/api/deposit', {
    method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({session, amount: v})
  })
  const j = await res.json()
  if(j.ok){
    me = j.me
    meBalEl.textContent = me.balance
    walletBalEl.textContent = me.balance
    depositVal.value = ''
  } else alert('не удалось пополнить')
})

/* -------- new round btn -------- */
newRoundBtn.addEventListener('click', ()=>{
  resultBoxShow(false)
})

/* -------- boot -------- */
window.addEventListener('load', ()=> {
  // replace placeholder API_BASE
  if(API_BASE.includes('{{API_BASE}}')) {
    console.warn('api base not set, replace placeholder before deploy')
  }
  initAuth()
  setInterval(refreshQueues, 4000) // poll every 4s
})
