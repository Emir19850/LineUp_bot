// server/index.js
const express = require('express')
const cors = require('cors')
const crypto = require('crypto')
const sqlite3 = require('sqlite3').verbose()
require('dotenv').config()

const app = express()
app.use(express.json())
app.use(cors())

const PORT = process.env.PORT || 8080  // <-- для Back4App
const BOT_TOKEN = process.env.BOT_TOKEN || 'demo-token'

// создаём базу (файл появится сам)
const db = new sqlite3.Database('./db.sqlite', (err) => {
  if (err) console.error('db error:', err)
  else console.log('✅ database connected')
})

db.run(`
  CREATE TABLE IF NOT EXISTS queues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    stake INTEGER,
    joined INTEGER DEFAULT 0
  )
`)

// простая проверка initData
function verifyInitData(initData) {
  try {
    const data = new URLSearchParams(initData)
    const hash = data.get('hash')
    data.delete('hash')
    const checkString = [...data.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')

    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest()
    const hmac = crypto.createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex')

    return hmac === hash
  } catch (e) {
    return false
  }
}

// api
app.get('/', (_, res) => res.send('backend ok'))

// получить все очереди
app.get('/api/queues', (req, res) => {
  db.all('SELECT * FROM queues', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
})

// создать новую очередь
app.post('/api/queue', (req, res) => {
  const { name, stake } = req.body
  db.run('INSERT INTO queues (name, stake, joined) VALUES (?, ?, 0)', [name, stake], function (err) {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ ok: true, id: this.lastID })
  })
})

// присоединиться к очереди
app.post('/api/join', (req, res) => {
  const { id } = req.body
  db.run('UPDATE queues SET joined = joined + 1 WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ ok: true })
  })
})

// auth через telegram initData с вытаскиванием username
app.post('/api/auth', (req, res) => {
  const { initData } = req.body
  const valid = verifyInitData(initData)
  if (!valid) return res.status(403).json({ error: 'invalid initData' })

  let username = 'anon'
  try {
    const params = new URLSearchParams(initData)
    const userStr = params.get('user') // Telegram WebApp передаёт user как JSON
    if (userStr) {
      const user = JSON.parse(userStr)
      username = user.username || user.first_name || 'anon'
    }
  } catch(e){ console.error(e) }

  res.json({ ok: true, user: { username } })
})

// demo-режим для теста
app.post('/api/demo-session', (req, res) => {
  res.json({
    ok: true,
    session: 'demo123',
    user: { id: 1, username: 'demo_user' }
  })
})

app.listen(PORT, () => console.log(`🚀 server running on ${PORT}`))
