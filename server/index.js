/* jshint esversion: 6 */

// Express App Setup

const axios = require('axios')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const dns = require('dns')
const express = require('express')
const Joi = require('@hapi/joi')
const LRU = require('lru-cache')
const morgan = require('morgan')
const Router = require('express-promise-router')
const sqlstring = require('sqlstring')
const { Pool } = require('pg')

const keys = require('./keys')

const app = express()

// app.use(cors({ credentials: true, origin: 'http://adnalytics.io:8089' }))
// app.use(cors({ credentials: true, origin: 'https://adnalytics.io' }))
app.use(cors({ credentials: true, origin: true }))

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

// Express route handlers

app.get('/', (req, res) => {
  res.send('Hi')
})

app.get('/values/api', async (req, res) => {
  console.log("GET /values/api", keys.aMemberHost)

  try {
    const result = await axios.get(`http://${keys.aMemberHost}/amember/api/check-access/by-login?_key=Mk4ga6B8bonz2x409Blq&login=d5b7e8010264478a0017e1a22309cf5b`)
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
})

app.get('/newpins/profile', async (req, res) => {
  console.log("GET /newpins/profile")

  const out = []

  const profile_query = `
    select date(crawled_at) crawled_at, array_agg(distinct profile_id) profiles
    from pin_crawl
    group by 1
    order by 1 desc
    limit 1
  `

  const profile_values = await pgClient.query(profile_query)

  for (const row of profile_values.rows) {
    const crawled_at = new Date(row.crawled_at).toISOString().split('T')[0]

    for (const profile of row.profiles) {
      console.log('profile:', profile)
      const query = `
        select count(t1.*)
        from (
        select distinct pin_id from pin_crawl
        where date(crawled_at) = '${crawled_at}'
        and profile_id = '${profile}'
        except
        select distinct pin_id from pin_crawl
        where date(crawled_at) < '${crawled_at}'
        ) t1
      `

      const values = await pgClient.query(query)
      const [pinCount] = values.rows

      console.log('pinCount:', pinCount)

      out.push({ date: crawled_at, profile, pinCount: pinCount.count })
    }
  }

  res.json(out)
})

app.get('/newpins', async (req, res) => {
  console.log("GET /newpins")

  const out = []

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterday_iso = yesterday.toISOString().split('T')[0]

  const query = `
    select count(t1.*)
    from (
    select distinct pin_id from pin_crawl
    where date(crawled_at) = '${yesterday_iso}'
    except
    select distinct pin_id from pin_crawl
    where date(crawled_at) < '${yesterday_iso}'
    ) t1
  `

  const values = await pgClient.query(query)
  const [pinCount] = values.rows

  out.push({ date: yesterday_iso, pinCount })

  res.json(out)
})

app.get('/newpromoters', async (req, res) => {
  console.log("GET /newpromoters")

  const out = []

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterday_iso = yesterday.toISOString().split('T')[0]

  const query = `
    select count(t1.*)
    from (
      select distinct promoter_id from promoter_crawl
      where date(crawled_at) = '${yesterday_iso}'
      except
      select distinct promoter_id from promoter_crawl
      where date(crawled_at) < '${yesterday_iso}'
    ) t1
  `

  const values = await pgClient.query(query)
  const [promoterCount] = values.rows

  out.push({ date: yesterday_iso, promoterCount })

  res.json(out)
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

  res.json({ working: true })
})

//
// routes
//

const apiRoutes = new Router()

apiRoutes.get('/user', async (req, res) => {
  console.log("(route) GET /user", amemberIp)
  // res.header("Access-Control-Allow-Origin", "http://adnalytics.io:8089")
  // res.header("Access-Control-Allow-Origin", "https://adnalytics.io")
  res.header("Access-Control-Allow-Origin", req.headers.origin)
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header('Access-Control-Allow-Credentials', true)

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

  // res.header("Access-Control-Allow-Origin", "http://adnalytics.io:8089")
  // res.header("Access-Control-Allow-Origin", "https://adnalytics.io")
  res.header("Access-Control-Allow-Origin", req.headers.origin)
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header('Access-Control-Allow-Credentials', true)

  const phpsessid = 'PHPSESSID' in req.cookies ? req.cookies.PHPSESSID : '1'
  // console.log('phpsessid:', phpsessid)

  try {
    const result = await axios.get(`http://${amemberIp}/amember/api/check-access/by-login?_key=Mk4ga6B8bonz2x409Blq&login=${phpsessid}`)
    if (result.data.ok) {
      req.amemberId = sqlstring.escape(result.data.user_id)
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

// get all search terms for a user
apiRoutes.get('/search', async (req, res) => {
  console.log("(route) GET /search")

  const values = await pgClient.query(`SELECT created_at, term, sort_by, cutoff_id, cutoff_value, date_from, date_to, days_active, is_shopify, country FROM user_search WHERE id = '${req.amemberId}';`)
  res.json(values.rows)
})

// get all keywords (for auto complete purposes)
apiRoutes.get('/keywords', async (req, res) => {
  console.log("(route) GET /keywords")

  const values = await pgClient.query('SELECT DISTINCT keyword FROM pin_crawl;')
  res.json(values.rows)
})

apiRoutes.get('/usersearch', async (req, res) => {
  console.log("(route) GET /usersearch")

  const values = await pgClient.query(`select * from user_search where id = '${req.amemberId}' order by created_at desc`)
  res.json(values.rows)
})

apiRoutes.get('/userpin/ids', async (req, res) => {
  console.log("(route) GET /userpin/ids")

  const sql = sqlstring.format('select pin_id from user_pin where user_id = ?', [req.amemberId,])

  const values = await pgClient.query(sql)

  res.json(values.rows.length > 0 ? values.rows.map(x => x.pin_id) : [])
})

apiRoutes.get('/userpin', async (req, res) => {
  console.log("(route) GET /userpin")

  const sql = `
    select pin.id pin_id, pin.promoter_id, pin.description,
    pin.ad_url, pin.image, pin.mobile_link, pin.is_video,
    pin.title, pin.is_shopify,
    promoter.id promoter_id, promoter.username promoter_username,
    promoter.external_url promoter_external_url, promoter.description promoter_description,
    promoter.image promoter_image, promoter.is_big_advertiser promoter_is_big_advertiser,
    promoter.location promoter_location,
    user_pin.created_at saved_at
    from user_pin, pin, promoter
    where true
    and user_pin.pin_id = pin.id
    and pin.promoter_id = promoter.id
    and user_pin.user_id = ${req.amemberId}
  `
  const values = await pgClient.query(sql)

  if (values.rows.length === 0) {
    return res.json([])
  }

  const pin_ids = new Set(values.rows.map(row => row.pin_id))
  const pin_ids_str = [...pin_ids].map(x => `'${x}'`).join(',')

  console.log('pin_ids_str:', pin_ids_str)

  const sql_pin_crawl = `
    SELECT pin_id, MAX(saves) saves, MAX(repin_count) repin_count, ARRAY_AGG(DISTINCT keyword) keywords, MAX(crawled_at) crawled_at, COUNT(DISTINCT DATE(crawled_at)) days_active, MIN(created_at) created_at
    FROM pin_crawl
    WHERE pin_id IN (${pin_ids_str})
    GROUP BY 1
  `
  const values_pin_crawl = await pgClient.query(sql_pin_crawl)

  const pin_crawl_dict = {}

  values_pin_crawl.rows.forEach((row) => {
    pin_crawl_dict[row.pin_id] = row
  })

  const out = []

  values.rows.forEach((row) => {
    out.push({
     ...row, ...pin_crawl_dict[row.pin_id],
     promoter: {
       description: row.promoter_description,
       external_url: row.promoter_external_url,
       id: row.promoter_id,
       image: row.promoter_image,
       location: row.promoter_location,
       username: row.promoter_username,
     },
    })
  })

  res.json(out)
})

apiRoutes.post('/userpin', async (req, res) => {
  console.log("(route) POST /userpin")

  const vals = [
    req.amemberId,
    'pin_id' in req.body ? req.body.pin_id : '0',
    'comment' in req.body ? req.body.comment : '',
  ]

  const sql = sqlstring.format('INSERT INTO user_pin(user_id, pin_id, comment) VALUES(?, ?, ?)', vals)

  console.log(vals)
  pgClient.query(sql)

  res.status(204).send()
})

apiRoutes.delete('/userpin', async (req, res) => {
  console.log("(route) DELETE /userpin")

  const vals = [
    req.amemberId,
    'pin_id' in req.body ? req.body.pin_id : '0',
  ]

  console.log(vals)

  if (vals[1] !== '0') {
    const sql = sqlstring.format('DELETE FROM user_pin WHERE user_id = ? AND pin_id = ?', vals)

    pgClient.query(sql)
  }

  res.status(204).send()
})

apiRoutes.post('/promoter', async (req, res) => {
  console.log("(route) POST /promoter")

  const id = 'id' in req.body ? sqlstring.escape(req.body.id) : ''
  const sql = `select * from promoter where id = ${id}`
  const promoter_values = await pgClient.query(sql)

  if (promoter_values.rows.length !== 1) {
    return res.json({})
  }

  const promoter = promoter_values.rows.length === 1 ? promoter_values.rows[0] : {}

  let promoterSocial = {}
  try {
    const url = promoter.external_url.match(/.*:\/\/([^\/]*)/)[1].replace(/^www\./, '')
    console.log('promoter url:', url)

    const sql_site_meta = `
      select s.id, s.url, ssm.traffic_social, ssm.total_visits
      from site s, sw_site_meta ssm
      where true
      and s.id = ssm.site_id
      and s.url = '${url}' 
    `

    const values_site_meta = await pgClient.query(sql_site_meta)
    // console.log(values_site_meta)
    promoterSocial = values_site_meta.rows.length === 1 ? values_site_meta.rows[0] : {}

    const sql_site_social = `
      select platform, "share"
      from sw_site_social
      where true
      and site_id = '${promoterSocial.id}'
      and platform = 'Pinterest'
    `

    const values_site_social = await pgClient.query(sql_site_social)
    console.log(values_site_social)
    const socialShare = values_site_social.rows.length === 1 ? values_site_social.rows[0] : {}
    promoterSocial = { ...promoterSocial, ...socialShare }
    // console.log('promoterSocial:', promoterSocial)
  } catch (err) {
    console.error(err)
  }

  const promoter_trend_sql = `select distinct date(crawled_at) crawled_at, followers from promoter_crawl where promoter_id = ${id} ORDER BY crawled_at DESC LIMIT 30`
  const promoter_trend_values = await pgClient.query(promoter_trend_sql)
  const promoterTrend = promoter_trend_values.rows.length > 0 ? promoter_trend_values.rows : []

  const cover_sql = `SELECT image FROM pin WHERE promoter_id = ${id} LIMIT 6`
  const cover_values = await pgClient.query(cover_sql)
  const cover = cover_values.rows.map(x => x.image)

  console.log('promoter:', promoter)
  console.log('promoterSocial:', promoterSocial)
  console.log('promoterTrend:', promoterTrend)

  res.json({
    promoter,
    promoterSocial,
    promoterTrend,
    cover,
  })
})

apiRoutes.get('/followpromoter', async (req, res) => {
  console.log("(route) GET /followpromoter")

  const sql = sqlstring.format(`
    select distinct pr.*, fp.created_at followed_at,
    FIRST_VALUE(pc.followers) OVER (PARTITION BY pc.promoter_id ORDER BY pc.crawled_at desc) followers
    from follow_promoter fp, promoter pr, promoter_crawl pc
    where true
    and fp.user_id = ?
    and pr.id = pc.promoter_id
    and fp.promoter_id = pr.id
  `, [req.amemberId,])

  const values = await pgClient.query(sql)

  const out = []

  for (row of values.rows) {
    const s = `SELECT image FROM pin WHERE promoter_id = '${row.id}' LIMIT 6`
    const v = await pgClient.query(s)

    out.push({
      ...row,
      cover: v.rows.map(x => x.image),
    })
  }

  res.json(out)
})

apiRoutes.get('/followpromoter/ids', async (req, res) => {
  console.log("(route) GET /followpromoter/ids")

  const sql = sqlstring.format('select promoter_id from follow_promoter where user_id = ?', [req.amemberId,])

  const values = await pgClient.query(sql)

  res.json(values.rows.length > 0 ? values.rows.map(x => x.promoter_id) : [])
})

apiRoutes.post('/followpromoter', async (req, res) => {
  console.log("(route) POST /followpromoter")

  const vals = [
    req.amemberId,
    'promoter_id' in req.body ? req.body.promoter_id : '0',
  ]

  const sql = sqlstring.format('INSERT INTO follow_promoter(user_id, promoter_id) VALUES(?, ?)', vals)

  console.log(vals)
  pgClient.query(sql)

  res.status(204).send()
})

apiRoutes.delete('/followpromoter', async (req, res) => {
  console.log("(route) DELETE /followpromoter")

  const vals = [
    req.amemberId,
    'promoter_id' in req.body ? req.body.promoter_id : '0',
  ]

  console.log(vals)

  if (vals[1] !== '0') {
    const sql = sqlstring.format('DELETE FROM follow_promoter WHERE user_id = ? AND promoter_id = ?', vals)

    pgClient.query(sql)
  }

  res.status(204).send()
})

apiRoutes.get('/keyword', async (req, res) => {
  console.log("(route) GET /keyword")
  // 24 latest pins with this keyword

  const sql = sqlstring.format(`
    select distinct pc.pin_id,
    FIRST_VALUE(pc.crawled_at) OVER (PARTITION BY pc.pin_id ORDER BY pc.crawled_at asc) crawled_at,
    FIRST_VALUE(pc.saves) OVER (PARTITION BY pc.pin_id ORDER BY pc.crawled_at asc) saves,
    FIRST_VALUE(pc.created_at) OVER (PARTITION BY pc.pin_id ORDER BY pc.crawled_at asc) created_at,
    FIRST_VALUE(pc.last_repin_date) OVER (PARTITION BY pc.pin_id ORDER BY pc.crawled_at asc) last_repin_date,
    fk.created_at followed_at,
    fk.keyword highlighted_keyword,
    pin.promoter_id,
    pin.description,
    pin.ad_url,
    pin.title,
    pin.image,
    pin.is_shopify,
    pin.language,
    pr.username promoter_username,
    pr.description promoter_description,
    pr.image promoter_image,
    pr.external_url promoter_url,
    pr.location promoter_location
    from follow_keyword fk, pin_crawl pc, pin, promoter pr
    where true
    and pc.keyword = fk.keyword
    and pc.pin_id = pin.id
    and pr.id = pin.promoter_id
    and user_id = ?
    and pc.crawled_at >= fk.created_at
    order by 2 desc
    limit 24
  `, [req.amemberId,])

  const values = await pgClient.query(sql)

  if (values.rows.length === 0) {
    return res.json([])
  }

  const arr = []
  for (const row of values.rows) {
    arr.push({
      ad_url: row['ad_url'],
      created_at: row['created_at'],
      description: row.description,
      image: row.image,
      'is_shopify': row['is_shopify'],
      'highlighted_keyword': row['highlighted_keyword'],
      language: row.language,
      'last_repin_date': row['last_repin_date'],
      'pin_id': row['pin_id'],
      'crawled_at': row['crawled_at'],
      saves: row.saves,
      'followed_at': row['followed_at'],
      'promoter_id': row['promoter_id'],
      title: row.title,
      promoter: {
        description: row['promoter_description'],
        'external_url': row['promoter_url'],
        id: row['promoter_id'],
        image: row['promoter_image'],
        location: row['promoter_location'],
        username: row['promoter_username'],
      }
    })
  }

  res.json(arr)
})

apiRoutes.get('/keyword/all', async (req, res) => {
  console.log("(route) GET /keyword/all")

  const sql = sqlstring.format('select keyword from follow_keyword where user_id = ?', [req.amemberId,])

  const values = await pgClient.query(sql)

  res.json(values.rows.length > 0 ? values.rows.map(x => x.keyword) : [])
})

apiRoutes.post('/keyword', async (req, res) => {
  console.log("(route) POST /keyword")

  const vals = [
    req.amemberId,
    'keyword' in req.body ? req.body.keyword : '',
  ]

  console.log(vals)

  if (vals[1] !== '') {
    const sql = sqlstring.format('INSERT INTO follow_keyword(user_id, keyword) VALUES(?, ?)', vals)
    pgClient.query(sql)
  }

  res.status(204).send()
})

apiRoutes.delete('/keyword', async (req, res) => {
  console.log("(route) DELETE /keyword")

  const vals = [
    req.amemberId,
    'keyword' in req.body ? req.body.keyword : '',
  ]

  console.log(vals)

  if (vals[1] !== '') {
    const sql = sqlstring.format('DELETE FROM follow_keyword WHERE user_id = ? AND keyword = ?', vals)

    pgClient.query(sql)
  }

  res.status(204).send()
})

const sortedByOption = {
  createdAt: 'created_at',
  saves: 'saves',
  daysActive: 'days_active',
}
// Available sorted by options.

apiRoutes.post('/searchEs', async (req, res) => {
  console.log("(route) POST /searchEs")

  const today = new Date().toISOString().split('T')[0]
  const threeMonthsAgo = new Date(today)
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const dateRange = 'dateRange' in req.body
  ? req.body.dateRange : {
    start: threeMonthsAgo.toISOString().split('T')[0],
    end: today
  }

  const period = Math.ceil((new Date(dateRange.end).getTime()
  - new Date(dateRange.start).getTime()) / 1000.0 / 60 / 60 / 24)

  if (period > 93) {
    res
    .status(400)
    .json({ error: 'Time span cannot be longer than 3 months.' })
  }

  const sortBy = 'sortBy' in req.body && req.body.sortBy in sortedByOption
  ? sortedByOption[req.body.sortBy] : 'created_at'

  const id = 'id' in req.body ? req.body.id : 0

  const cutoffValue = 'id' in req.body ? req.body.cutoffValue : 0

  const term = 'term' in req.body && req.body.term.length > 0
  ? `*${req.body.term}*` : '*'

  const bigAdvertisers = 'bigAdvertisers' in req.body
  ? req.body.bigAdvertisers : false

  const country = 'selectedCountries' in req.body
  ? req.body.selectedCountries : null

  const daysActive = 'daysActive' in req.body ? parseInt(req.body.daysActive) : 1

  const isShopify = 'isShopify' in req.body ? req.body.isShopify : false

  // const shop = 'shop' in req.body && req.body.shop.length > 0
  // ? req.body.shop : null
  // 1 - shopify
  // 2 - woocommerce
  // 3 - clickfunnels
  // 4 - advertorials

  const shop = isShopify ? [
    'shopify',
    'clickfunnels',
    'woocommerce',
    'advertorials',
    // '0',
  ] : null

  const saveRange = 'saveRange' in req.body
  ? req.body.saveRange : { start: 0, end: 999999999 }

  const saves = {
    gte: parseInt(saveRange.start),
    lte: parseInt(saveRange.end),
  }

  const language = 'language' in req.body && req.body.language.length > 0
  ? req.body.language : null

  const sort = [{ [sortBy]: { order: 'desc' } }]

  const schema = Joi.object().keys({
    country: Joi.array().items(Joi.string()).allow(null),
    dateRange: Joi.object({ start: Joi.date(), end: Joi.date() }),
    daysActive: Joi.number().min(1),
    language: Joi.array().items(Joi.string()).allow(null),
    saves: Joi.object({ gte: Joi.number().min(0), lte: Joi.number().min(1) }),
    shop: Joi.array().items(Joi.string()).allow(null),
    term: Joi.string().max(255),
    sort: Joi.array().items(Joi.object({ [sortBy]: Joi.object({ order: Joi.string() }) })),
    daysActive: Joi.number().min(1).max(92),
  })

  const obj = {
    country,
    dateRange,
    daysActive,
    language,
    saves,
    shop,
    term,
    sort,
    daysActive,
  }

  const o = obj // TODO: remove

  try {
    await schema.validateAsync(obj)

    if (daysActive > 1 || sortBy === 'days_active') {
      // const o = await esDaysActive(obj)
      res.json(o)
    } else {
      // const o = await esCreatedAt(obj)
      res.json(o)
    }
  } catch (error) {
    console.error(error)

    const er = 'details' in error && Array.isArray(error.details) &&
    error.details.length > 0 && 'message' in error.details[0] ?
    error.details[0].message : error

    res
    .status(404)
    .json({
      error: er,
    })
  }
})

// get all pins matching the keyword
apiRoutes.post('/searchTest', async (req, res) => {
  console.log("(route) POST /searchTest")

  const sortMap = {
    id: 'pc1.created_at DESC, pc1.pin_crawl_id DESC',
    saves: 'pc1.saves DESC, pc1.pin_crawl_id DESC',
    daysActive: 'da.days_active DESC, pc1.pin_crawl_id DESC',
    lastRepin: 'pc1.last_repin_date DESC, pc1.pin_crawl_id DESC',
  }

  const sortBy = 'sortBy' in req.body && req.body.sortBy in sortMap ? req.body.sortBy : 'id'

  const cutoffId = 'id' in req.body ? `pc1.pin_crawl_id < ${sqlstring.escape(req.body.id)}` : 'true'

  const cutoffMap = {
    id: 'pc1.created_at',
    saves: 'pc1.saves',
    daysActive: 'da.days_active',
    lastRepin: 'pc1.last_repin_date',
  }

  const cutoffValue = cutoffId !== 'true' && 'cutoffValue' in req.body ?
  `${cutoffMap[sortBy]} <= ${sqlstring.escape(req.body.cutoffValue)}` : 'true'

  const term = 'term' in req.body ? req.body.term : ''

  const dateRange = 'dateRange' in req.body ? req.body.dateRange : { start: '1970-01-01', end: '2030-12-31' }
  const dateFrom = dateRange.start
  const dateTo = dateRange.end

  const selectedCountries = 'selectedCountries' in req.body ? `profile.country_code IN (${req.body.selectedCountries.map(x => `${sqlstring.escape(x)}`).join(',')})` : 'true'
  const daysActive = 'daysActive' in req.body ? `da.days_active >= ${sqlstring.escape(req.body.daysActive)}` : 'true'
  const isShopify = 'isShopify' in req.body ? `p1.is_shopify = ${sqlstring.escape(req.body.isShopify)}` : true // TODO: remove that when only `shop` is used!
  const shop = 'shop' in req.body && req.body.shop.length > 0 ? `AND shop IN (${req.body.shop.map(x => `${sqlstring.escape(x)}`).join(',')})` : 'AND true'
  // 1 - shopify
  // 2 - woocommerce
  // 3 - clickfunnels
  // 4 - advertorials

  const saveRange = 'saveRange' in req.body ? req.body.saveRange : { start: '0', end: '999999999' }
  const saveFrom = saveRange.start
  const saveTo = saveRange.end

  // const language = 'language' in req.body && req.body.language.length > 0 ? `p1.language IN (${req.body.language.map(x => `${sqlstring.escape(x)}`).join(',')})` : 'false'
  const language = 'language' in req.body && req.body.language.length > 0 ? `language IN (${req.body.language.map(x => `${sqlstring.escape(x)}`).join(',')})` : 'false'

  // console.log('cutoffId:', cutoffId)
  // console.log('term:', term)
  // console.log('dateRange:', dateRange)
  // console.log('dateRangeStart:', dateRange.start)
  // console.log('dateRangeEnd:', dateRange.end)
  // console.log('dateFrom:', dateFrom)
  // console.log('dateTo:', dateTo)
  // console.log('daysActive:', daysActive)
  // console.log('isShopify:', isShopify)
  // console.log('selectedCountries:', selectedCountries)

  // const vals = [
  //   req.amemberId,
  //   term,
  //   sortBy,
  //   'id' in req.body ? sqlstring.escape(req.body.id) : 0,
  //   'cutoffValue' in req.body ? sqlstring.escape(req.body.cutoffValue) + '' : '0',
  //   new Date(dateFrom).toISOString().split('T').join(' ').split('.')[0] + '+00',
  //   new Date(dateTo).toISOString().split('T').join(' ').split('.')[0] + '+00',
  //   'daysActive' in req.body ? sqlstring.escape(req.body.daysActive) : 0,
  //   'isShopify' in req.body ? sqlstring.escape(req.body.isShopify) : 'false',
  //   'selectedCountries' in req.body ? `{${req.body.selectedCountries.map(x => `${x}`).join(',')}}` : '{}',
  // ]
  //
  // pgClient.query(
  //   'INSERT INTO user_search(id, term, sort_by, cutoff_id, cutoff_value, date_from, date_to, days_active, is_shopify, country) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
  //   vals
  // )

  const sql_pin_crawl = `
    WITH p1 AS
    (
      SELECT
        *
      FROM
        pin
      WHERE true
      --AND ${language}
      --
      --SELECT
      --  DISTINCT pin.*,
      --  FIRST_VALUE(pd.shop) OVER (PARTITION BY pd.domain ORDER BY pd.shop ASC) shop
      --FROM
      --  pin,
      --  pin_domain pd
      --WHERE
      --  TRUE
      --  AND pd.domain = subSTRING(pin.ad_url FROM '(.*://[^/]*)')
      --
      -- query without duplicates
      --SELECT
      --  DISTINCT pin.*,
      --  FIRST_VALUE(pd.shop) OVER (PARTITION BY pd.domain ORDER BY pd.shop ASC) shop
      --FROM
      --  pin
      --LEFT OUTER JOIN
      --  pin_domain pd
      --ON
      --  pd.domain = subSTRING(pin.ad_url FROM '(.*://[^/]*)')
      --WHERE true
      --  ${shop}
      --
      -- query with duplicates
      --SELECT
      --  DISTINCT pin.*,
      --  pd.shop shop
      --FROM
      --  pin
      --LEFT OUTER JOIN
      --  pin_domain pd
      --ON
      --  pd.domain = subSTRING(pin.ad_url FROM '(.*://[^/]*)')
      --WHERE true
      --  ${shop}
    )
    ,
    pc1 AS
    (
      SELECT
        pin_id,
      ARRAY_AGG(DISTINCT pin_crawl.keyword) keywords,
        MAX(pin_crawl.id) pin_crawl_id,
        COUNT(DISTINCT profile_id) unique_profiles,
        MAX(saves) saves,
        MAX(repin_count) repin_count,
        MIN(created_at) created_at,
        MAX(last_repin_date) last_repin_date,
        MIN(crawled_at) min_crawled_at,
        MAX(crawled_at) max_crawled_at,
        round(AVG(POSITION)::NUMERIC, 2) "position"
      FROM
        pin_crawl
        JOIN
          (
            SELECT
              id,
              country_code,
              user_agent_id
            FROM
              profile
          )
          profile
          ON pin_crawl.profile_id = profile.id
      WHERE
        ${selectedCountries}
        --AND pin_crawl.crawled_at BETWEEN '${dateFrom}' AND '${dateTo}'
        AND pin_crawl.crawled_at >= '${dateFrom}'
        AND pin_crawl.crawled_at <= '${dateTo}'
      GROUP BY
        1
    )
    ,
    da AS
    (
      SELECT
        x.pin_id,
        COUNT(x.pin_id) days_active
      FROM
        (
          SELECT
            DATE(crawled_at) crawled_at,
            pin_id
          FROM
            pin_crawl
            JOIN
              (
                SELECT
                  id,
                  country_code,
                  user_agent_id
                FROM
                  profile
              )
              profile
              ON pin_crawl.profile_id = profile.id
          WHERE
            ${selectedCountries}
            AND pin_crawl.crawled_at >= '${dateFrom}'
            AND pin_crawl.crawled_at <= '${dateTo}'
          GROUP BY
            1,
            2
          --ORDER BY
          --  1 DESC,
          --  2
        )
        x
      GROUP BY
        1
    )
    SELECT
      pc1.pin_crawl_id id,
      pc1.keywords,
      pc1.unique_profiles,
      pc1.saves,
      pc1.repin_count,
      pc1.created_at,
      pc1.last_repin_date,
      pc1.min_crawled_at,
      pc1.max_crawled_at,
      pc1.POSITION,
      p1.id pin_id,
      p1.promoter_id,
      p1.description,
      p1.title,
      p1.ad_url,
      p1.image,
      p1.mobile_link,
      p1.is_video,
      p1.is_shopify,
      p1.language,
      da.days_active
      --p1.shop
    FROM
      p1,
      pc1,
      da
    WHERE
      p1.id = pc1.pin_id
      AND p1.id = da.pin_id
      -- AND pc1.saves BETWEEN '${saveFrom}' AND '${saveTo}'
      AND pc1.saves >= '${saveFrom}'
      AND pc1.saves <= '${saveTo}'
      AND ${cutoffId}
      AND ${cutoffValue}
      AND ${daysActive}
      AND ${isShopify}
      -- AND ${language}
      -- AND pc1.pin_crawl_id < 68994
      -- AND false
      -- AND p1.is_shopify = true
      AND ('${term}' = ANY(pc1.keywords) OR p1.title ILIKE '%${term}%' OR p1.description ILIKE '%${term}%' OR p1.ad_url ILIKE '%${term}%')
    ORDER BY
      ${sortMap[sortBy]}
      -- pc1.pin_crawl_id DESC
    FETCH first 10 ROWS ONLY;
  `

  console.log(sql_pin_crawl)

  const values_pin_crawl = await pgClient.query(sql_pin_crawl)

  // console.log('values_pin_crawl rows length:', values_pin_crawl.rows.length)

  if (values_pin_crawl.rows.length === 0) {
    return res.json([])
  }

  const promoter_ids = new Set(values_pin_crawl.rows.map(row => row.promoter_id))
  const promoter_ids_str = [...promoter_ids].map(x => `'${x}'`).join(',')

  const sql_promoter = `SELECT id, username, location, external_url, description, image FROM promoter WHERE id IN (${promoter_ids_str});`
  const values_promoter = await pgClient.query(sql_promoter)
  values_promoter.rows.forEach(row => cache.promoter.set(row.id, row))

  values_pin_crawl.rows.forEach((row) => {
    // console.log('row:', row)
    const promoter = cache.promoter.has(row.promoter_id) ? cache.promoter.get(row.promoter_id) : {}
    // console.log('promoter:', promoter)

    if (!cache.pin.has(row.pin_id)) {
      cache.pin.set(row.pin_id, { ...row, promoter })
    }
  })

  const out = []

  values_pin_crawl.rows.forEach((row) => {
    const pin = cache.pin.has(row.pin_id) ? cache.pin.get(row.pin_id) : {}
    out.push({ ...pin })
  })

  res.json(out)
})

// get all pins matching the keyword
apiRoutes.post('/search', async (req, res) => {
  console.log("(route) GET /search")

  const cutoff_id = 'id' in req.body ? `id < ${sqlstring.escape(req.body.id)} AND` : ''

  const term = 'term' in req.body ? sqlstring.escape(req.body.term) : ''

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
    FETCH FIRST 25 ROWS ONLY;
  `

  const values_pin_crawl = await pgClient.query(sql_pin_crawl)
  const pin_ids = values_pin_crawl.rows.map(row => row.pin_id) // we only get unique ids here
  const pin_ids_str = pin_ids.map(x => `'${x}'`).join(',')

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

  const id = 'id' in req.body ? sqlstring.escape(req.body.id) : ''
  console.log('id:', req.body.id, sqlstring.escape(req.body.id))

  // const keyword = 'keyword' in req.body ? sqlstring.escape(req.body.keyword) : ''
  const keyword = 'keyword' in req.body ? req.body.keyword.replace("'", "''") : ''

  console.log('id:', id)
  console.log('keyword:', keyword)

  if (id === '' || keyword === '') {
    return res.json([])
  }

  const sql = `SELECT DATE(crawled_at) crawled_date, COUNT(DISTINCT profile_id) unique_profiles, COUNT(profile_id) cumulative_profiles,
    ROUND(AVG(position)::numeric, 2) "position",
    MAX(saves) saves, MAX(repin_count) repin_count,
    MIN(created_at) created_at, MAX(last_repin_date) last_repin_date
    FROM pin_crawl
    WHERE keyword = '${keyword}' AND
    pin_id = ${id}
    GROUP BY 1
    ORDER BY crawled_date;`

  const values = await pgClient.query(sql)

  const sql_pin = `SELECT * FROM pin WHERE id = ${id}`
  const pin_values = await pgClient.query(sql_pin)

  console.log('pin_values.rows.length', pin_values.rows.length)

  if (pin_values.rows.length === 0) {
    return res.json({})
  }

  const promoter_id = pin_values.rows[0].promoter_id
  console.log('promoter_id:', promoter_id)


  const sql_promoter = `
    SELECT promoter.id, promoter.username, promoter.location, promoter.external_url, promoter.description, promoter.image,
    promoter.is_big_advertiser, t2.followers, t2.monthly_views
    FROM promoter
    JOIN (
      SELECT MAX(promoter_id) promoter_id, MAX(followers) followers, MAX(monthly_views) monthly_views
      FROM promoter_crawl
      WHERE promoter_id = '${promoter_id}'
    ) t2
    ON promoter.id = t2.promoter_id
  `

  const promoter_values = await pgClient.query(sql_promoter)

  const sql_promoter_related = `
    select count(*) promoted_pins_count from pin where promoter_id = '${promoter_id}'
  `
  const promoted_pins = await pgClient.query(sql_promoter_related)
  console.log('promoted_pins:', promoted_pins.rows)
  const promotedPins = promoted_pins.rows.length === 1 ? promoted_pins.rows[0].promoted_pins_count : 0

  const sql_pin_position = `
    SELECT ROUND(AVG(position)::numeric, 2) "position" FROM pin_crawl WHERE pin_id = ${id}
  `
  const pin_position = await pgClient.query(sql_pin_position)
  console.log('pin position:', pin_position.rows)
  const pinPosition = pin_position.rows.length === 1 ? pin_position.rows[0].position : 0.0

  const sql_days_seen = `
    SELECT COUNT(DISTINCT DATE(crawled_at)) days_seen FROM pin_crawl WHERE pin_id = ${id}
  `
  const days_seen = await pgClient.query(sql_days_seen)
  console.log('days seen', days_seen.rows)
  const daysSeen = days_seen.rows.length === 1 ? days_seen.rows[0].days_seen : 0

  const pin = pin_values.rows.length === 1 ? pin_values.rows[0] : {}
  const promoter = promoter_values.rows.length === 1 ? promoter_values.rows[0] : {}

  // const sql_promoter_social = `
  //   SELECT total_visits, social_traffic, pinterest_traffic
  //   FROM promoter_social
  //   WHERE promoter_id = '${promoter_id}'
  //   ORDER BY created_at DESC
  //   LIMIT 1
  // `
  //
  // const promoter_social_values = await pgClient.query(sql_promoter_social)
  // const promoterSocial = promoter_social_values.rows.length === 1 ? promoter_social_values.rows[0] : {}

  // a.match(/.*:\/\/([^\/]*)/)[1] // get url
  let promoterSocial = {}
  try {
    const url = promoter.external_url.match(/.*:\/\/([^\/]*)/)[1].replace(/^www\./, '')
    console.log('promoter url:', url)

    const sql_site_meta = `
      select s.id, s.url, ssm.traffic_social, ssm.total_visits
      from site s, sw_site_meta ssm
      where true
      and s.id = ssm.site_id
      and s.url = '${url}' 
    `

    const values_site_meta = await pgClient.query(sql_site_meta)
    // console.log(values_site_meta)
    promoterSocial = values_site_meta.rows.length === 1 ? values_site_meta.rows[0] : {}

    const sql_site_social = `
      select platform, "share"
      from sw_site_social
      where true
      and site_id = '${promoterSocial.id}'
      and platform = 'Pinterest'
    `

    const values_site_social = await pgClient.query(sql_site_social)
    console.log(values_site_social)
    const socialShare = values_site_social.rows.length === 1 ? values_site_social.rows[0] : {}
    promoterSocial = { ...promoterSocial, ...socialShare }
    // console.log('promoterSocial:', promoterSocial)
  } catch (err) {
    console.error(err)
  }

  // get keywords
  const sql_keywords = `
    select array_agg(distinct keyword) keywords
    from pin_crawl
    where pin_id = ${id}
  `
  const values_keywords = await pgClient.query(sql_keywords)
  console.log('keywords', values_keywords.rows)
  const keywords = values_keywords.rows.length === 1 ? values_keywords.rows[0].keywords : []

  res.json({
    pin: { ...pin, promotedPins, pinPosition, daysSeen, keywords },
    pinCrawl: values.rows,
    promoter,
    promoterSocial,
    // promoterSocial2,
  })
})

// get related pin from promoter id
apiRoutes.post('/relatedpins', async (req, res) => {
  console.log("(route) POST /relatedpins")

  const id = 'id' in req.body ? sqlstring.escape(req.body.id) : ''

  if (id === '') {
    return res.json([])
  }

  const sql = `
    SELECT id, promoter_id, description, ad_url, image, mobile_link, is_video, title, is_shopify
    FROM pin
    WHERE promoter_id = ${id}
    LIMIT 96
  `

  const values = await pgClient.query(sql)

  const pin_ids = new Set(values.rows.map(row => row.id))
  const pin_ids_str = [...pin_ids].map(x => `'${x}'`).join(',')

  const sql_pin_crawl = `
    SELECT pin_id, MAX(saves) saves, MAX(repin_count) repin_count, ARRAY_AGG(DISTINCT keyword) keywords, MAX(crawled_at) crawled_at, COUNT(DISTINCT DATE(crawled_at)) days_active, MIN(created_at) created_at
    FROM pin_crawl
    WHERE pin_id IN (${pin_ids_str})
    GROUP BY 1
  `
  const values_pin_crawl = await pgClient.query(sql_pin_crawl)

  const pin_crawl_dict = {}

  values_pin_crawl.rows.forEach((row) => {
    pin_crawl_dict[row.pin_id] = row
  })

  const out = []

  values.rows.forEach((row) => {
    out.push({ ...row, ...pin_crawl_dict[row.id] })
  })

  res.json(out)
})

// get pin frequency over time
apiRoutes.post('/trend', async (req, res) => {
  console.log("(route) POST /trend")

  const id = 'id' in req.body ? sqlstring.escape(req.body.id) : ''

  if (id === '') {
    return res.json([])
  }

  const sql = `select date(created_at) crawled_at, saves frequency from pin_saves where pin_id = ${id} order by 1 asc`

  const values = await pgClient.query(sql)
  res.json(values.rows)
})

apiRoutes.get('/top', async (req, res) => {
  console.log("(route) GET /top")

  const sql_1 = `
    SELECT t1.promoter_id, t1.number_of_pins, t2.username, t2.external_url, t2.image, t2.is_big_advertiser
    FROM (
      SELECT promoter_id, COUNT(*) number_of_pins
      FROM pin
      WHERE is_shopify = true
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 25
    ) t1
    JOIN promoter t2
    ON t1.promoter_id = t2.id
    ORDER BY 2 DESC
  `

  const values_1 = await pgClient.query(sql_1)
  const promoter_ids = values_1.rows.map(row => row.promoter_id)
  const promoter_ids_str = promoter_ids.map(x => `'${x}'`).join(',')

  const sql_2 = `
    SELECT * FROM (
      SELECT DISTINCT pin_crawl.saves, pin_crawl.keyword, pin.*, row_number() over (partition by pin.promoter_id order by saves desc) row_index
      FROM pin_crawl, pin
      WHERE pin_crawl.pin_id = pin.id AND pin_id IN
      (
        SELECT DISTINCT id
        FROM pin
        WHERE promoter_id IN (${promoter_ids_str})
        AND is_shopify = true
      )
  ) t1 WHERE t1.row_index = '1'
  `

  const values_2 = await pgClient.query(sql_2)
  const topPin = {}
  values_2.rows.forEach((row) => {
    topPin[row.promoter_id] = row
  })

  const out = []

  values_1.rows.forEach((row) => {
    out.push({ promoter: row, pin: topPin[row.promoter_id] })
  })

  const sql_3 = `
    WITH
      t1 AS (
      SELECT
        *
      FROM (
        SELECT
          pr.id,
          pr.username,
          pr.location,
          pr.external_url,
          pr.description,
          pr.image,
          pr.is_big_advertiser,
          prs.total_visits,
          prs.social_traffic,
          prs.pinterest_traffic,
          ROW_NUMBER() OVER (PARTITION BY prs.promoter_id ORDER BY prs.created_at DESC) row_index
        FROM
          promoter pr
        LEFT OUTER JOIN
          promoter_social prs
        ON
          (pr.id = prs.promoter_id)
        ORDER BY
          pr.id ) ta
      WHERE
        (ta.row_index != 2
          OR ta.row_index = 2
          AND total_visits IS NULL) ),
      t2 AS (
      SELECT
        promoter_id,
        MAX(CASE
            WHEN is_shopify = TRUE THEN 1
          ELSE
          0
        END
          ) is_shopify
      FROM
        pin
      GROUP BY
        1)
    SELECT
      o1.id,
      MAX(username) username,
      MAX(o1.location) "location",
      MAX(external_url) external_url,
      MAX(description) description,
      MAX(image) image,
      bool_and(is_big_advertiser) is_big_advertiser,
      MAX(total_visits) total_visits,
      MAX(social_traffic) social_traffic,
      MAX(pinterest_traffic) pinterest_traffic,
      MAX(followers) followers,
      MAX(monthly_views) monthly_views,
      MIN(crawled_at) min_crawled_at,
      MAX(crawled_at) max_crawled_at,
      o1.id promoter_id
    FROM (
      SELECT
        t1.*,
        CASE
          WHEN t2.is_shopify = 1 THEN TRUE
        ELSE
        FALSE
      END
        is_shopify
      FROM
        t1
      LEFT OUTER JOIN
        t2
      ON
        (t1.id = t2.promoter_id) ) o1,
      promoter_crawl
    WHERE
      TRUE
      AND o1.id = promoter_crawl.promoter_id
      AND o1.is_shopify = TRUE
    GROUP BY
      1
    ORDER BY
      13 DESC
    LIMIT
      10
  `
  const values_3 = await pgClient.query(sql_3)
  const promoter_ids_2 = new Set(values_3.rows.map(row => row.promoter_id))
  const promoter_ids_str_2 = [...promoter_ids_2].map(x => `'${x}'`).join(',')

  const sql_promoter = `
    select * from (
    select *,
    row_number() over (partition by pin.promoter_id order by crawled_at desc) row_index
    from pin, pin_crawl
    where true
    and pin.id = pin_crawl.pin_id
    --and promoter_id IN ('795307752854425069', '809451870434123777')
    and promoter_id IN (${promoter_ids_str_2})
    order by promoter_id, crawled_at desc
    ) i1
    where i1.row_index = 1
  `
  const values_sql_promoter = await pgClient.query(sql_promoter)
  const promoter_dict = {}

  values_sql_promoter.rows.forEach((row) => {
    promoter_dict[row.promoter_id] = row
  })

  const newShopify = []

  const newShopifyDuplicate = new Set()

  for (const row of values_3.rows) {
    if (!newShopifyDuplicate.has(row.promoter_id)) {
      newShopifyDuplicate.add(row.promoter_id)
      newShopify.push({ promoter: row, pin: { ...promoter_dict[row.promoter_id], id: promoter_dict[row.promoter_id].pin_id } })
    }
  }

  const sql_trendy = `
    SELECT
      *
    FROM (
      SELECT
        pin_id,
        MAX(saves) saves,
        MAX(repin_count) repin_count,
        ARRAY_AGG(DISTINCT keyword) keyword
      FROM
        pin_crawl
      GROUP BY
        1 ) t1,
      pin,
      promoter
    WHERE
      pin.is_shopify = TRUE
      AND pin.id = t1.pin_id
      AND pin.promoter_id = promoter.id
    ORDER BY
      2 DESC
    LIMIT
      25
  `

  const values_sql_trendy = await pgClient.query(sql_trendy)

  res.json({ topShopify: out, newShopify: newShopify.slice(0, 10), trendyShopify: values_sql_trendy.rows })
})

// get all pins matching the keyword
apiRoutes.post('/search2', async (req, res) => {
  console.log("(route) GET /search")

  const cutoff_id = 'id' in req.body ? `id < ${sqlstring.escape(req.body.id)} AND` : ''

  const term = 'term' in req.body ? req.body.term : '' // TODO

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

  const values = await pgClient.query(sql)
  res.json(values.rows)
})

// get all profiles (match with ads for country, user agent, gender...)
apiRoutes.get('/profiles', async (req, res) => {
  console.log("(route) GET /profiles")

  const values = await pgClient.query('SELECT profile.id, profile.gender, profile.country_code, profile.interest, user_agent.user_agent FROM profile LEFT JOIN user_agent ON profile.user_agent_id = user_agent.id;')
  res.json({ profiles: values.rows, amemberId: req.amemberId })
})

// get pin(s) by id (by an array of ids)
apiRoutes.post('/pin', async (req, res) => {
  console.log("(route) POST /pin")

  const ids = req.body.map(x => `${sqlstring.escape(x)}`).join(',')
  const sql = `SELECT id, promoter_id, description, ad_url, image, mobile_link, is_video, title, is_shopify FROM pin WHERE id IN (${ids});`

  const values = await pgClient.query(sql)
  res.json(values.rows)
})

// // get promoter(s) by id (by an array of ids)
// apiRoutes.post('/promoter', async (req, res) => {
//   console.log("(route) POST /promoter")
//
//   const ids = req.body.map(x => `${sqlstring.escape(x)}`).join(',')
//   const sql = `SELECT id, username, location, external_url, description, image FROM promoter WHERE id IN (${ids});`
//
//   const values = await pgClient.query(sql)
//   res.json(values.rows)
// })
//
// // get promoter details by id (by an array of ids)
// // get latest details for the current month of requested provider
// apiRoutes.post('/promoterdetails', async (req, res) => {
//   console.log("(route) POST /promoterdetails")
//
//   const ids = req.body.map(x => `${sqlstring.escape(x)}`).join(',')
//   const sql = `SELECT DISTINCT ON (promoter_id) promoter_id, followers, monthly_views FROM promoter_crawl WHERE promoter_id IN (${ids}) ORDER BY promoter_id, crawled_at DESC;`
//
//   const values = await pgClient.query(sql)
//   res.json(values.rows)
// })

app.use('/v1', apiRoutes)

app.listen(5000, (err) => {
  dns.lookup(keys.aMemberHost, async (err2, result2) => {
    amemberIp = result2
    const values_profile = await pgClient.query('SELECT profile.id, profile.gender, profile.country_code, profile.interest, user_agent.user_agent FROM profile LEFT JOIN user_agent ON profile.user_agent_id = user_agent.id;')

    values_profile.rows.forEach(row => cache.profile[row.id] = row)

    console.log('Listening on 5000')
  })
})
