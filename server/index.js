/* jshint esversion: 6 */

// Express App Setup

const axios = require('axios')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const dns = require('dns')
const express = require('express')
const morgan = require('morgan')
const Router = require('express-promise-router')
const { Pool } = require('pg')

const keys = require('./keys')

const app = express()

app.use(cors())

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.use(cookieParser())

app.use(morgan('dev'))
// log requests to the console


// Postgres Client Setup

const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort
})

pgClient.on('error', () => console.log('Lost PG connection'))

let amemberIp

// pgClient
//     .query('CREATE TABLE IF NOT EXISTS values (number INT)')
//     .catch(err => console.log(err))
// console.log('Table values created')
console.log('pg://'+keys.pgUser+":"+keys.pgPassword+'@'+keys.pgDatabase)

// Express route handlers

app.get('/', (req, res) => {
  res.send('Hi')
})

app.get('/values/api', async (req, res) => {
  console.log("GET /values/api", keys.aMemberHost)

  try {
    const result = await axios.get(`http://${keys.aMemberHost}/amember/api/check-access/by-login?_key=Mk4ga6B8bonz2x409Blq&login=d5b7e8010264478a0017e1a22309cf5b`)
    // console.log(result)
    res.send(result.data)
  } catch (error) {
    console.log(error)
    res.send([])
  }
})

app.get('/values/ip', (req, res) => {
  console.log("GET /values/ip", keys.aMemberHost)

  try {
    const result = await axios.get(`http://${amemberIp}/amember/api/check-access/by-login?_key=Mk4ga6B8bonz2x409Blq&login=${phpsessid}`)
    res.json(result.data)
  } catch (error) {
    console.error(error)
    res.status(500).json({
      ok: false,
      code: -2,
      msg: error,
    })
  }

  // dns.lookup(keys.aMemberHost, async (err2, result2) => {
  //   // console.log('res2:', result2)
  //   // console.log('cookie:', req.cookies)
  //   // console.log('Signed Cookies: ', req.signedCookies)
  //   const phpsessid = 'PHPSESSID' in req.cookies ? req.cookies.PHPSESSID : '1'
  //   console.log('phpsessid:', phpsessid)
  //
  //   try {
  //     const result = await axios.get(`http://${result2}/amember/api/check-access/by-login?_key=Mk4ga6B8bonz2x409Blq&login=${phpsessid}`)
  //     res.json(result.data)
  //   } catch (error) {
  //     console.error(error)
  //     res.json({
  //       ok: false,
  //       code: -2,
  //       msg: error,
  //     })
  //   }
  // })
})

app.get('/values/all', async (req, res) => {
  console.log("GET /values/all")
  const values = await pgClient.query('SELECT * from profile')
  res.json(values.rows)
})

app.get('/values/current', async (req, res) => {
  console.log("GET /values/current")
  res.json([2,])
})

app.post('/values', async (req, res) => {
  console.log("POST /values")
  const index = req.body.index

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high')
  }

  // pgClient.query('INSERT INTO values(number) VALUES($1)', [index])

  res.json({ working: true })
})

//
// routes
//

const apiRoutes = new Router()

apiRoutes.get('/user', (req, res) => {
  console.log("(route) GET /user", keys.aMemberHost)

  try {
    const result = await axios.get(`http://${amemberIp}/amember/api/check-access/by-login?_key=Mk4ga6B8bonz2x409Blq&login=${phpsessid}`)
    res.json(result.data)
  } catch (error) {
    console.error(error)
    res.status(500).json({
      ok: false,
      code: -2,
      msg: error,
    })
  }
})

// route middleware to authenticate and check token
apiRoutes.use(async (req, res, next) => {
  console.log('middleware')

  const phpsessid = 'PHPSESSID' in req.cookies ? req.cookies.PHPSESSID : '1'
  // console.log('phpsessid:', phpsessid)

  try {
    const result = await axios.get(`http://${amemberIp}/amember/api/check-access/by-login?_key=Mk4ga6B8bonz2x409Blq&login=${phpsessid}`)
    if (result.data.ok) {
      next()
    } else {
      res.status(401).json({
        ok: false,
        code: -2,
        msg: 'PHPSESSID is invalid.',
      })
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({
      ok: false,
      code: -3,
      msg: error,
    })
  }
})

apiRoutes.get('/ads', async (req, res) => {
  console.log("(route) GET /ads")

  const values = await pgClient.query('SELECT * from profile')
  res.json(values.rows)
})

app.use('/v1', apiRoutes)

app.listen(5000, err => {
  dns.lookup(keys.aMemberHost, (err2, result2) => {
    amemberIp = result2
    console.log('Listening on 5000')
  })
})
