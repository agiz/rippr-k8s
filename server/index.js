/* jshint esversion: 6 */

// Express App Setup
// TODO: https://www.npmjs.com/package/sqlstring

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

app.get('/newpins', async (req, res) => {
  console.log("GET /newpins")

  const out = []

  const today = new Date().toISOString().split('T')[0]

  let date = new Date('2018-11-07')
  let date_iso = date.toISOString().split('T')[0]

  while (date_iso !== today) {
    const query = `
      select count(t1.*)
      from (
      select distinct pin_id from pin_crawl
      where date(crawled_at) = '${date_iso}'
      --and profile_id = 57
      except
      select distinct pin_id from pin_crawl
      where date(crawled_at) < '${date_iso}'
      ) t1
    `

    const values = await pgClient.query(query)
    const [pinCount] = values.rows

    out.push({ date: date_iso, pinCount })

    date.setDate(date.getDate() + 1)
    date_iso = date.toISOString().split('T')[0]
  }

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

  // pgClient.query('INSERT INTO values(number) VALUES($1)', [index])

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
      req.amemberId = result.data.user_id
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

// get all pins matching the keyword
apiRoutes.post('/searchTest', async (req, res) => {
  console.log("(route) POST /searchTest")

  // console.dir(req.body)

  // TODO: check for injections

  const sortMap = {
    id: 'pc1.pin_crawl_id DESC',
    saves: 'pc1.saves DESC, pc1.pin_crawl_id DESC',
    daysActive: 'da.days_active DESC, pc1.pin_crawl_id DESC',
    lastRepin: 'pc1.last_repin_date DESC, pc1.pin_crawl_id DESC',
  }

  const sortBy = 'sortBy' in req.body && req.body.sortBy in sortMap ? req.body.sortBy : 'id'
  // TODO: check for injections

  const cutoffId = 'id' in req.body ? `pc1.pin_crawl_id < ${req.body.id}` : 'true'
  // TODO: check for injections

  const cutoffMap = {
    id: 'pc1.pin_crawl_id',
    saves: 'pc1.saves',
    daysActive: 'da.days_active',
    lastRepin: 'pc1.last_repin_date',
  }

  const cutoffValue = cutoffId !== 'true' && 'cutoffValue' in req.body ?
  `${cutoffMap[sortBy]} <= '${req.body.cutoffValue}'` : 'true'
  // TODO: check for injections

  const term = 'term' in req.body ? req.body.term : ''
  // TODO: check for injections

  const dateRange = 'dateRange' in req.body ? req.body.dateRange : { start: '1970-01-01', end: '2030-12-31' }
  const dateFrom = dateRange.start
  const dateTo = dateRange.end
  // const dateFrom = 'dateFrom' in req.body ? req.body.dateFrom : '1970-01-01'
  // const dateTo = 'dateTo' in req.body ? req.body.dateTo : '2030-12-31'
  // const countryCode = 'countryCode' in req.body ? `profile.country_code = '${req.body.countryCode}'` : 'true'
  const selectedCountries = 'selectedCountries' in req.body ? `profile.country_code IN (${req.body.selectedCountries.map(x => `'${x}'`).join(',')})` : 'true'
  const daysActive = 'daysActive' in req.body ? `da.days_active >= ${req.body.daysActive}` : 'true'
  const isShopify = 'isShopify' in req.body ? `p1.is_shopify = ${req.body.isShopify}` : true

  console.log('cutoffId:', cutoffId)
  console.log('term:', term)
  console.log('dateRange:', dateRange)
  console.log('dateRangeStart:', dateRange.start)
  console.log('dateRangeEnd:', dateRange.end)
  console.log('dateFrom:', dateFrom)
  console.log('dateTo:', dateTo)
  // console.log('countryCode:', countryCode)
  console.log('daysActive:', daysActive)
  console.log('isShopify:', isShopify)
  console.log('selectedCountries:', selectedCountries)

  const vals = [
    req.amemberId,
    term,
    sortBy,
    'id' in req.body ? req.body.id : 0,
    'cutoffValue' in req.body ? req.body.cutoffValue + '' : '0',
    new Date(dateFrom).toISOString().split('T').join(' ').split('.')[0] + '+00',
    new Date(dateTo).toISOString().split('T').join(' ').split('.')[0] + '+00',
    'daysActive' in req.body ? req.body.daysActive : 0,
    'isShopify' in req.body ? req.body.isShopify : 'false',
    'selectedCountries' in req.body ? `{${req.body.selectedCountries.map(x => `${x}`).join(',')}}` : '{}',
  ]

  console.log('----------------------------------')
  console.log(vals)
  console.log('----------------------------------')

/*
INSERT INTO
user_search(id, term, sort_by, cutoff_id, cutoff_value, date_from, date_to, days_active, is_shopify, country)
VALUES(
1,
'dogs',
'id',
0,
'0',
TIMESTAMP WITH TIME ZONE '2019-02-14T23:00:00.000Z',
'2019-03-17 22:59:00+00',
1,
false,
'{AU,CA,FR,US,UK}'
)
*/

  pgClient.query(
    'INSERT INTO user_search(id, term, sort_by, cutoff_id, cutoff_value, date_from, date_to, days_active, is_shopify, country) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    vals
  )

  const sql_pin_crawl = `
    WITH p1 AS
    (
      SELECT
        *
      FROM
        pin
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
        AND pin_crawl.crawled_at BETWEEN '${dateFrom}' AND '${dateTo}'
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
            AND pin_crawl.crawled_at BETWEEN '${dateFrom}' AND '${dateTo}'
          GROUP BY
            1,
            2
          ORDER BY
            1 DESC,
            2
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
      da.days_active
    FROM
      p1,
      pc1,
      da
    WHERE
      p1.id = pc1.pin_id
      AND p1.id = da.pin_id
      AND ${cutoffId}
      AND ${cutoffValue}
      AND ${daysActive}
      AND ${isShopify}
      -- AND pc1.pin_crawl_id < 68994
      -- AND false
      -- AND p1.is_shopify = true
      AND ('${term}' = ANY(pc1.keywords) OR p1.title ILIKE '%${term}%' OR p1.description ILIKE '%${term}%')
    ORDER BY
      ${sortMap[sortBy]}
      -- pc1.pin_crawl_id DESC
    FETCH first 10 ROWS ONLY;
  `

  console.log(sql_pin_crawl)

  const values_pin_crawl = await pgClient.query(sql_pin_crawl)

  console.log('values_pin_crawl rows length:', values_pin_crawl.rows.length)

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
    FETCH FIRST 25 ROWS ONLY;
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

  console.log('id:', id)
  console.log('keyword:', keyword)

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

  const sql_pin = `SELECT * FROM pin WHERE id = '${id}'`
  const pin_values = await pgClient.query(sql_pin)

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
    SELECT ROUND(AVG(position)::numeric, 2) "position" FROM pin_crawl WHERE pin_id = '${id}'
  `
  const pin_position = await pgClient.query(sql_pin_position)
  console.log('pin position:', pin_position.rows)
  const pinPosition = pin_position.rows.length === 1 ? pin_position.rows[0].position : 0.0

  const sql_days_seen = `
    SELECT COUNT(DISTINCT DATE(crawled_at)) days_seen FROM pin_crawl WHERE pin_id = '${id}'
  `
  const days_seen = await pgClient.query(sql_days_seen)
  console.log('days seen', days_seen.rows)
  const daysSeen = days_seen.rows.length === 1 ? days_seen.rows[0].days_seen : 0

  const pin = pin_values.rows.length === 1 ? pin_values.rows[0] : {}
  const promoter = promoter_values.rows.length === 1 ? promoter_values.rows[0] : {}

  const sql_promoter_social = `
    SELECT total_visits, social_traffic, pinterest_traffic
    FROM promoter_social
    WHERE promoter_id = '${promoter_id}'
    ORDER BY created_at DESC
    LIMIT 1
  `

  const promoter_social_values = await pgClient.query(sql_promoter_social)
  const promoterSocial = promoter_social_values.rows.length === 1 ? promoter_social_values.rows[0] : {}

  res.json({
    pin: { ...pin, promotedPins, pinPosition, daysSeen },
    pinCrawl: values.rows,
    promoter,
    promoterSocial,
  })
})

// get related pin from promoter id
apiRoutes.post('/relatedpins', async (req, res) => {
  console.log("(route) POST /relatedpins")

  const id = 'id' in req.body ? req.body.id : ''
  // TODO: check for injections

  if (id === '') {
    return res.json([])
  }

  const sql = `
    SELECT id, promoter_id, description, ad_url, image, mobile_link, is_video, title, is_shopify
    FROM pin
    WHERE promoter_id = '${id}'
    LIMIT 24
  `

  const values = await pgClient.query(sql)

  const pin_ids = new Set(values.rows.map(row => row.id))
  const pin_ids_str = [...pin_ids].map(x => `'${x}'`).join(',')

  const sql_pin_crawl = `
    SELECT pin_id, MAX(saves) saves, MAX(repin_count) repin_count, ARRAY_AGG(DISTINCT keyword) keywords, MAX(crawled_at) crawled_at
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

  const id = 'id' in req.body ? req.body.id : ''
  // TODO: check for injections

  if (id === '') {
    return res.json([])
  }

  const sql = `
    SELECT DATE(crawled_at) crawled_at, COUNT(*) frequency
    FROM pin_crawl
    WHERE pin_id = '${id}'
    GROUP BY 1
    ORDER BY 1
  `

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

  console.log('ids:', promoter_ids)
  console.log('ids_str:', promoter_ids_str)

  // const sql_2 = `
  //   SELECT t1.*, t2.saves
  //   FROM pin t1, (
  //     SELECT DISTINCT pin_id, saves
  //     FROM pin_crawl
  //     WHERE pin_id IN
  //     (
  //       SELECT DISTINCT id
  //       FROM pin
  //       WHERE promoter_id IN (${promoter_ids_str})
  //       AND is_shopify = true
  //     )
  //     ORDER BY 2 DESC
  //     LIMIT 1
  //   ) t2
  //   WHERE t1.id = t2.pin_id
  // `

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

  // console.dir(topPin)

  const out = []

  values_1.rows.forEach((row) => {
    out.push({ promoter: row, pin: topPin[row.promoter_id] })
  })

  const sql_3 = `
    SELECT pin_crawl.*, pin.* FROM (
      SELECT pin_crawl.pin_id, MIN(crawled_at) crawled_at
      FROM pin_crawl, pin
      WHERE
      pin.is_shopify = true AND
      pin_crawl.pin_id = pin.id
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 10
    ) t1, pin, pin_crawl
    WHERE t1.pin_id = pin.id
    AND t1.pin_id = pin_crawl.pin_id
    AND t1.crawled_at = pin_crawl.crawled_at
    ORDER BY pin_crawl.crawled_at DESC
  `

  const values_3 = await pgClient.query(sql_3)

  const promoter_ids_2 = new Set(values_3.rows.map(row => row.promoter_id))
  const promoter_ids_str_2 = [...promoter_ids_2].map(x => `'${x}'`).join(',')

  const sql_promoter = `
    SELECT * FROM
    (
      SELECT promoter_id, MAX(followers) followers, MAX(monthly_views) monthly_views, MIN(crawled_at) min_crawled_at, MAX(crawled_at) max_crawled_at
      FROM promoter_crawl
      WHERE promoter_id IN (${promoter_ids_str_2})
      GROUP BY 1
    ) t1, promoter
    WHERE
    promoter.id IN (${promoter_ids_str_2}) AND
    t1.promoter_id = promoter.id
  `

  const values_sql_promoter = await pgClient.query(sql_promoter)

  const promoter_dict = {}

  values_sql_promoter.rows.forEach((row) => {
    promoter_dict[row.promoter_id] = row
  })

  const newShopify = []

  values_3.rows.forEach((row) => {
    newShopify.push({ pin: row, promoter: promoter_dict[row.promoter_id] })
  })

  res.json({ topShopify: out, newShopify, })
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
  res.json({ profiles: values.rows, amemberId: req.amemberId })
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
