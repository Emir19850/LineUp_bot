// server/index.js
// demo backend: node + express + sqlite
// verifies telegram webapp initData (basic) and manages queues, users
const express = require('express')
const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')
const bodyParser = require('body-parser')
require('dotenv').config()

const PORT = process.env.PORT || 3000
const BOT_TOKEN = process.env.BOT_TOKEN || '' // telegram bot token
const app = express()
app.use(bodyParser.json())

// db
const db = new Database(path.join(__dirname, '..', 'db.sqlite'))
db.prepare(`CREATE TABLE IF NOT EXISTS users (tg_id INTEGER PRIMARY KEY, name TEXT, balance REAL DEFAULT 0, session TEXT)`).run()
db.prepare(`CREATE TABLE IF NOT EXISTS queues (id INTEGER PRIMARY KEY AUTOINCREMENT, bet INTEGER)`).run()
db.prepare(`CREATE TABLE IF NOT EXISTS queue_players (id INTEGER PRIMARY KEY AUTOINCREMENT, queue_id INTEGER, tg_id INTEGER, name TEXT, joined_at INTEGER)`).run()

// initialize some queues (bets)
const bets = [1,10,100]
bets.forEach(b=>{
  const row = db.prepare('SELECT * FROM queues WHERE bet = ?').get(b)
  if(!row) db.prepare('INSERT INTO queues(bet) VALUES(?)').run(b)
})

// helper: verify initData from telegram
function verifyInitData(initData){
  // initData is string like "key=val\nkey2=val2..."
  // algorithm: build data_check_string from initData fields, compute hmac sha256 with secret = sha256(bot_token)
  try{
    const parsed = {}
    initData.split('\n').forEach(line=>{
      const [k,v] = line.split('=')
      if(k && v!==undefined) parsed[k]=v
    })
    const hash = parsed['hash']
    // build data_check_string from other keys sorted
    const kv = []
    Object.keys(parsed).filter(k=>k!=='hash').sort().forEach(k=>{
      kv.push(`${k}=${parsed[k]}`)
    })
    const data_check_string = kv.join('\n')
    const secret = crypto.createHash('sha256').update(BOT_TOKEN).digest()
    const hmac = crypto.createHmac('sha256', secret).update(data_check_string).digest('hex')
    return hmac === hash
  }catch(e){
    console.warn('verifyInitData err', e.message)
    return false
  }
}

// route: auth (frontend sends tg initData string)
app.post('/api/auth', (req,res)=>{
  const { initData } = req.body
  if(!initData) return res.json({ok:false, msg:'no initData'})
  // verify
  const ok = verifyInitData(initData)
  if(!ok) return res.json({ok:false, msg:'initData invalid'})

  // parse user info from initDataUnsafe style (quick parse)
  const parsed = {}
  initData.split('\n').forEach(line=>{
    const [k,v] = line.split('=')
    if(k && v!==undefined) parsed[k]=v
  })
  // tg provides user object encoded as JSON in initDataUnsafe? depends — for demo expect "user" entry
  let userObj = null
  if(parsed.user){
    try{ userObj = JSON.parse(decodeURIComponent(parsed.user)) }catch(e){}
  }

  // fallback demo
  const tg_id = userObj ? userObj.id : (100000 + Math.floor(Math.random()*900000))
  const name = userObj ? (userObj.username || userObj.first_name || `u${tg_id}`) : `demo${tg_id}`

  // upsert user
  const existing = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tg_id)
  const session = crypto.randomBytes(12).toString('hex')
  if(existing){
    db.prepare('UPDATE users SET name = ?, session = ? WHERE tg_id = ?').run(name, session, tg_id)
  } else {
    db.prepare('INSERT INTO users(tg_id,name,balance,session) VALUES(?,?,?,?)').run(tg_id, name, 0, session)
  }
  const user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tg_id)

  // return session and user
  return res.json({ok:true, session, user:{id:user.tg_id, name:user.name, balance:user.balance}})
})

// demo-session for browser debug
app.post('/api/demo-session', (req,res)=>{
  const tg_id = 900000 + Math.floor(Math.random()*90000)
  const name = `demo${tg_id}`
  const session = crypto.randomBytes(12).toString('hex')
  db.prepare('INSERT OR REPLACE INTO users(tg_id,name,balance,session) VALUES(?,?,?,?)').run(tg_id, name, 100, session)
  const user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tg_id)
  res.json({ok:true, session, user:{id:user.tg_id, name:user.name, balance:user.balance}})
})

// get queues summary
app.get('/api/queues', (req,res)=>{
  // return all queues and players
  const qs = db.prepare('SELECT * FROM queues').all()
  const result = []
  qs.forEach(q=>{
    const players = db.prepare('SELECT * FROM queue_players WHERE queue_id = ? ORDER BY joined_at ASC').all(q.id)
    result.push({bet:q.bet, queue_id:q.id, players})
  })
  // also ranking and optional me
  const ranking = db.prepare('SELECT name, balance FROM users ORDER BY balance DESC LIMIT 50').all()
  // if session provided, return me
  let me = null
  const session = req.headers['x-session'] || req.query.session
  if(session){
    const u = db.prepare('SELECT * FROM users WHERE session = ?').get(session)
    if(u) me = {id:u.tg_id, name:u.name, balance:u.balance}
  }
  res.json({ok:true, queues: result, ranking, me})
})

// join queue
app.post('/api/join', (req,res)=>{
  const { session, name, bet } = req.body
  if(!session) return res.json({ok:false, msg:'no session'})
  const user = db.prepare('SELECT * FROM users WHERE session = ?').get(session)
  if(!user) return res.json({ok:false, msg:'invalid session'})
  const queueRow = db.prepare('SELECT * FROM queues WHERE bet = ?').get(bet)
  if(!queueRow) return res.json({ok:false, msg:'no such bet'})

  // check not already in same queue
  const already = db.prepare('SELECT * FROM queue_players WHERE queue_id = ? AND tg_id = ?').get(queueRow.id, user.tg_id)
  if(already) return res.json({ok:false, msg:'уже в очереди'})

  // check balance (demo: require balance >= bet)
  if(user.balance < bet) {
    return res.json({ok:false, msg:'недостаточно баланса (в демо пополните кошелёк)'} )
  }

  // debit the bet from balance (demo)
  db.prepare('UPDATE users SET balance = balance - ? WHERE tg_id = ?').run(bet, user.tg_id)

  // add to queue
  db.prepare('INSERT INTO queue_players(queue_id,tg_id,name,joined_at) VALUES(?,?,?,?)')
    .run(queueRow.id, user.tg_id, name || user.name, Math.floor(Date.now()/1000))

  // get updated queue
  const players = db.prepare('SELECT * FROM queue_players WHERE queue_id = ? ORDER BY joined_at ASC').all(queueRow.id)
  // if capacity reached (10) -> resolve round
  if(players.length >= 10){
    // choose loser
    const loserIdx = Math.floor(Math.random()*players.length)
    const loser = players[loserIdx]
    const winners = players.filter((_,i)=>i!==loserIdx)
    // credit winners 1.1x bet
    winners.forEach(w=>{
      db.prepare('UPDATE users SET balance = balance + ? WHERE tg_id = ?').run(bet * 1.1, w.tg_id)
    })
    // option: record round (skipped for brevity)
    // clear players for this queue
    db.prepare('DELETE FROM queue_players WHERE queue_id = ?').run(queueRow.id)
    // prepare response
    const resultText = `проиграл: ${loser.name}. победители: ${winners.map(w=>w.name).join(', ')}`
    // return updated me
    const me = db.prepare('SELECT * FROM users WHERE session = ?').get(session)
    return res.json({ok:true, roundClosed:true, resultText, queue:{players:[]}, me:{id:me.tg_id, name:me.name, balance:me.balance}})
  } else {
    const me = db.prepare('SELECT * FROM users WHERE session = ?').get(session)
    return res.json({ok:true, roundClosed:false, queue:{players}, me:{id:me.tg_id, name:me.name, balance:me.balance}})
  }
})

// deposit (demo)
app.post('/api/deposit', (req,res)=>{
  const { session, amount } = req.body
  if(!session) return res.json({ok:false, msg:'no session'})
  const user = db.prepare('SELECT * FROM users WHERE session = ?').get(session)
  if(!user) return res.json({ok:false, msg:'invalid session'})
  db.prepare('UPDATE users SET balance = balance + ? WHERE tg_id = ?').run(amount, user.tg_id)
  const me = db.prepare('SELECT * FROM users WHERE session = ?').get(session)
  res.json({ok:true, me:{id:me.tg_id, name:me.name, balance:me.balance}})
})

/* static serve optional if you want to host webapp from this server */
app.use('/', express.static(path.join(__dirname, '..', 'webapp')))

app.listen(PORT, ()=> console.log('server listening on', PORT))
