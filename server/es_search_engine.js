const { queryEs } = require('./connection')

const index4 = 'pins4'
const pinCrawlDailyIndex = 'pincrawldaily'

const fields = [
  'description',
  'title',
  'keyword',
  'ad_url_lc',
]

const esCreatedAt = async ({ country, dateRange, language, saves, shop, term, sort }) => {
  const sortBy = Object.keys(sort[0])[0]
  const size = 10
  const from = 0 // offset

  const startDate = dateRange.start
  const endDate = dateRange.end

  const query = {
    bool: {
      must: [
        {
          query_string: {
            query: term,
            // fuzziness: 'auto',
            fields,
          },
        },
        {
          range: {
            crawled_at: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        { range: { saves, }, },
      ],
    },
  }

  if (country !== null) {
    query.bool.must.push({ terms: { country, }, })
  }

  if (language !== null) {
    query.bool.must.push({ terms: { language, }, })
  }

  if (shop !== null) {
    query.bool.must.push({ terms: { shop, }, })
  }

  // console.log(util.inspect(query, false, null, true))

  const resPins = await queryEs(index4, query, size, from, sort)
  const pin_id = resPins.body.hits.hits.map(x => x._source.pin_id)

  const queryPinCrawl = {
    bool: {
      filter: [
        {
          terms: {
            pin_id,
          },
        },
        {
          range: {
            crawled_at: {
              gte: startDate,
              lte: endDate,
            }
          }
        }
      ]
    }
  }

  const pinCrawlAggs = {
    byday: {
      terms: {
        field: "pin_id",
        order: {
          _count: "desc",
        },
        size,
      }
    }
  }

  const resPinCrawl = await queryEs(pinCrawlDailyIndex, queryPinCrawl, size, from, null, pinCrawlAggs)
  const daysActiveObj = {}

  for (const item of resPinCrawl.body.aggregations.byday.buckets) {
    daysActiveObj[item.key] = item.doc_count
  }

  const out = []
  for (const itemTmp of resPins.body.hits.hits) {
    const item = itemTmp._source
    const min_crawled_at = item.crawled_at[0]
    const max_crawled_at = item.crawled_at[item.crawled_at.length - 1]
    const last_repin_date = max_crawled_at

    out.push({
      id: item.pin_id,
      keywords: item.keyword,
      unique_profiles: 1,
      saves: item.saves,
      repin_count: item.saves,
      created_at: item.created_at,
      last_repin_date,
      min_crawled_at,
      max_crawled_at,
      position: '1',
      pin_id: item.pin_id,
      promoter_id: item.promoter_id,
      description: item.description,
      title: item.title,
      ad_url: item.ad_url,
      image: item.image,
      mobile_link: null,
      is_video: false,
      is_shopify: true,
      language: item.language,
      days_active: item.pin_id in daysActiveObj ? daysActiveObj[item.pin_id] : '1',
      promoter: {
        id: item.promoter_id,
        username: item.promoter_username,
        location: item.promoter_location,
        external_url: item.promoter_external_url,
        description: item.promoter_description,
        image: item.promoter_image,
        is_big_advertiser: item.promoter_is_big_advertiser,
      },
    })
  }

  return out
}

const esDaysActive = async ({ country, dateRange, daysActive, language, saves, shop, term, sort }) => {
  const sortBy = Object.keys(sort[0])[0]
  const size = 10
  const from = 0 // offset

  const startDate = dateRange.start
  const endDate = dateRange.end

  const queryPinCrawl = {
    bool: {
      filter: [
        {
          range: {
            crawled_at: {
              gte: startDate,
              lte: endDate,
            }
          }
        }
      ]
    }
  }

  if (country !== null) {
    queryPinCrawl.bool.filter.push({ terms: { country_code: country, } })
  }

  const pinCrawlAggs = {
    byday: {
      terms: {
        field: 'pin_id',
        order: {
          _count: 'desc',
        },
        size: 3000,
        min_doc_count: daysActive,
      }
    }
  }

  console.log(pinCrawlDailyIndex)

  const resPinCrawl = await queryEs(pinCrawlDailyIndex, queryPinCrawl, size, from, null, pinCrawlAggs)
  // console.log(resPinCrawl.body.aggregations.byday.buckets)
  const daysActiveObj = {}

  for (const item of resPinCrawl.body.aggregations.byday.buckets) {
    daysActiveObj[item.key] = item.doc_count
  }

  // console.log(daysActiveObj)
  const pin_id = Object.keys(daysActiveObj)

  const query = {
    bool: {
      must: [
        {
          query_string: {
            query: term,
            // fuzziness: 'auto',
            fields,
          },
        },
        {
          range: {
            crawled_at: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        { range: { saves, }, },
        { terms: { pin_id, }, },
      ],
    },
  }

  if (country !== null) {
    query.bool.must.push({ terms: { country, }, })
  }

  if (language !== null) {
    query.bool.must.push({ terms: { language, }, })
  }

  if (shop !== null) {
    query.bool.must.push({ terms: { shop, }, })
  }

  const resPins = await queryEs(index4, query, pin_id.length)
  const pin_ids = resPins.body.hits.hits.map(x => x._source.pin_id)
  console.log(pin_ids.length)

  const out = []
  for (const itemTmp of resPins.body.hits.hits) {
    const item = itemTmp._source
    const min_crawled_at = item.crawled_at[0]
    const max_crawled_at = item.crawled_at[item.crawled_at.length - 1]
    const last_repin_date = max_crawled_at

    out.push({
      id: item.pin_id,
      keywords: item.keyword,
      unique_profiles: 1,
      saves: item.saves,
      repin_count: item.saves,
      created_at: item.created_at,
      last_repin_date,
      min_crawled_at,
      max_crawled_at,
      position: '1',
      pin_id: item.pin_id,
      promoter_id: item.promoter_id,
      description: item.description,
      title: item.title,
      ad_url: item.ad_url,
      image: item.image,
      mobile_link: null,
      is_video: false,
      is_shopify: true,
      language: item.language,
      days_active: item.pin_id in daysActiveObj ? daysActiveObj[item.pin_id] : '1',
      promoter: {
        id: item.promoter_id,
        username: item.promoter_username,
        location: item.promoter_location,
        external_url: item.promoter_external_url,
        description: item.promoter_description,
        image: item.promoter_image,
        is_big_advertiser: item.promoter_is_big_advertiser,
      },
    })
  }

  // console.log('sortBy:', sortBy)
  if (sortBy === 'created_at') {
    out.sort((a, b) => new Date(b[sortBy]) - new Date(a[sortBy]))
  } else {
    out.sort((a, b) => parseFloat(b[sortBy]) - parseFloat(a[sortBy]))
  }

  // return resPins.body.hits.hits.slice(from, size + from)
  return out.slice(from, size + from)
}

module.exports = {
  esCreatedAt,
  esDaysActive,
}
