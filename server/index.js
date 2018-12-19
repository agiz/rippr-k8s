/* jshint esversion: 6 */

// Express App Setup

const axios = require('axios')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const dns = require('dns')
const express = require('express')
const LRU = require('lru-cache')
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
// store amember local IP address

const cache = {}
cache.pin_crawl = new LRU({ max: 10000 })
cache.pin = new LRU({ max: 10000 })
cache.promoter = new LRU({ max: 10000 })
cache.profile = {}

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

app.get('/values/ip', async (req, res) => {
  console.log("GET /values/ip", keys.aMemberHost)

  const phpsessid = 'PHPSESSID' in req.cookies ? req.cookies.PHPSESSID : '1'

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

apiRoutes.get('/user', async (req, res) => {
  console.log("(route) GET /user", amemberIp)

  const phpsessid = 'PHPSESSID' in req.cookies ? req.cookies.PHPSESSID : '1'

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

  res.header("Access-Control-Allow-Origin", "http://localhost:8089")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header('Access-Control-Allow-Credentials', true)

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

// get all keywords (for auto complete purposes)
apiRoutes.get('/keywords', async (req, res) => {
  console.log("(route) GET /keywords")

  const values = await pgClient.query('SELECT DISTINCT keyword FROM pin_crawl;')
  res.json(values.rows)
})

// get all pins matching the keyword
apiRoutes.post('/search', async (req, res) => {
  console.log("(route) GET /search")

  // TODO: check for injections

  const cutoff_id = 'id' in req.body ? `id < ${req.body.id} AND` : ''
  // TODO: check for injections

  const term = 'term' in req.body ? req.body.term : ''
  // TODO: check for injections

  const sql_pin_crawl = `SELECT t1.id, t1.pin_id, t1.profile_id, t1.saves, t1.repin_count, t1.created_at, t1.last_repin_date, t1.keyword, t1.position, t1.crawled_at
    FROM pin_crawl t1
    JOIN (
        SELECT pin_id, max(id) AS max_id
        FROM pin_crawl
        WHERE
        ${cutoff_id}
        keyword ILIKE '%${term}%'
        GROUP BY pin_id
    ) t2
    ON t1.id = t2.max_id
    ORDER BY t1.id DESC
    FETCH FIRST 100 ROWS ONLY;
  `

  const values_pin_crawl = await pgClient.query(sql_pin_crawl)
  const pin_ids = values_pin_crawl.rows.map(row => row.pin_id) // we only get unique ids here
  const pin_ids_str = pin_ids.map(x => `'${x}'`).join(',')
  // values_pin_crawl.rows.forEach(row => cache.pin_crawl.set(row.id, row))

  const sql_pin = `SELECT id, promoter_id, description, ad_url, image, mobile_link, is_video, title, is_shopify FROM pin WHERE id IN (${pin_ids_str});`
  const values_pin = await pgClient.query(sql_pin)

  const promoter_ids = new Set(values_pin.rows.map(row => row.promoter_id))
  const promoter_ids_str = [...promoter_ids].map(x => `'${x}'`).join(',')

  const sql_promoter = `SELECT id, username, location, external_url, description, image FROM promoter WHERE id IN (${promoter_ids_str});`
  const values_promoter = await pgClient.query(sql_promoter)
  values_promoter.rows.forEach(row => cache.promoter.set(row.id, row))

  values_pin.rows.forEach((row) => {
    const promoter = cache.promoter.has(row.promoter_id) ? cache.promoter.get(row.promoter_id) : {}

    if (!cache.pin.has(row.id)) {
      cache.pin.set(row.id, { ...row, promoter })
    }
  })

  const out = []

  values_pin_crawl.rows.forEach((row) => {
    const pin = cache.pin.has(row.pin_id) ? cache.pin.get(row.pin_id) : {}
    out.push({ ...row, pin, profile: cache.profile[row.profile_id] })
  })

  res.json(out)
})

// get pin(s) by id (by an array of ids)
apiRoutes.post('/pindetails', async (req, res) => {
  console.log("(route) POST /pindetails")

  const id = 'id' in req.body ? req.body.id : ''
  // TODO: check for injections

  const keyword = 'keyword' in req.body ? req.body.keyword : ''
  // TODO: check for injections

  if (id === '' || keyword === '') {
    return res.json([])
  }

  const sql = `SELECT DATE(crawled_at) crawled_date, COUNT(DISTINCT profile_id) unique_profiles, COUNT(profile_id) cumulative_profiles,
    ROUND(AVG(position)::numeric, 2) "position",
    MAX(saves) saves, MAX(repin_count) repin_count
    FROM pin_crawl
    WHERE keyword = '${keyword}' AND
    pin_id = '${id}'
    GROUP BY 1
    ORDER BY crawled_date;`

  const values = await pgClient.query(sql)
  res.json(values.rows)
})

// get all pins matching the keyword
apiRoutes.post('/search2', async (req, res) => {
  console.log("(route) GET /search")

  const cutoff_id = 'id' in req.body ? `id < ${req.body.id} AND` : ''
  // TODO: check for injections

  const term = 'term' in req.body ? req.body.term : ''
  // TODO: check for injections

  const sql = `SELECT t1.id, t1.pin_id, t1.profile_id, t1.saves, t1.repin_count, t1.created_at, t1.last_repin_date, t1.keyword, t1.position, t1.crawled_at
    FROM pin_crawl t1
    JOIN (
        SELECT pin_id, max(id) AS max_id
        FROM pin_crawl
        WHERE
        ${cutoff_id}
        keyword ILIKE '%${term}%'
        GROUP BY pin_id
    ) t2
    ON t1.id = t2.max_id
    ORDER BY t1.id DESC
    FETCH FIRST 100 ROWS ONLY;
  `
  // This sql query first retrieves only unique entries, then filters them by keyword and offsets them from id.

  // const sql = `SELECT id, pin_id, profile_id, saves, repin_count, created_at, last_repin_date, keyword, position, crawled_at FROM pin_crawl WHERE ${cutoff_id} keyword ILIKE '%${term}%' ORDER BY id DESC FETCH FIRST 100 ROWS ONLY;`

  const values = await pgClient.query(sql)
  res.json(values.rows)
})

// get all profiles (match with ads for country, user agent, gender...)
apiRoutes.get('/profiles', async (req, res) => {
  console.log("(route) GET /profiles")

  const values = await pgClient.query('SELECT profile.id, profile.gender, profile.country_code, profile.interest, user_agent.user_agent FROM profile LEFT JOIN user_agent ON profile.user_agent_id = user_agent.id;')
  res.json(values.rows)
})

// get pin(s) by id (by an array of ids)
apiRoutes.post('/pin', async (req, res) => {
  console.log("(route) POST /pin")

  const ids = req.body.map(x => `'${x}'`).join(',')
  const sql = `SELECT id, promoter_id, description, ad_url, image, mobile_link, is_video, title, is_shopify FROM pin WHERE id IN (${ids});`

  const values = await pgClient.query(sql)
  res.json(values.rows)
})

// get promoter(s) by id (by an array of ids)
apiRoutes.post('/promoter', async (req, res) => {
  console.log("(route) POST /promoter")

  const ids = req.body.map(x => `'${x}'`).join(',')
  const sql = `SELECT id, username, location, external_url, description, image FROM promoter WHERE id IN (${ids});`

  const values = await pgClient.query(sql)
  res.json(values.rows)
})

// get promoter details by id (by an array of ids)
// get latest details for the current month of requested provider
apiRoutes.post('/promoterdetails', async (req, res) => {
  console.log("(route) POST /promoterdetails")

  const ids = req.body.map(x => `'${x}'`).join(',')
  const sql = `SELECT DISTINCT ON (promoter_id) promoter_id, followers, monthly_views FROM promoter_crawl WHERE promoter_id IN (${ids}) ORDER BY promoter_id, crawled_at DESC;`

  const values = await pgClient.query(sql)
  res.json(values.rows)
})

app.use('/v1', apiRoutes)

app.listen(5000, (err) => {
  dns.lookup(keys.aMemberHost, async (err2, result2) => {
    amemberIp = result2
    const values_profile = await pgClient.query('SELECT profile.id, profile.gender, profile.country_code, profile.interest, user_agent.user_agent FROM profile LEFT JOIN user_agent ON profile.user_agent_id = user_agent.id;')

    values_profile.rows.forEach(row => cache.profile[row.id] = row)

    console.log('Listening on 5000')
  })
})
