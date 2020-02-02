const { Client } = require('@elastic/elasticsearch')
const keys = require('./keys')

const node = keys.esHost

const client = new Client({ node })

const checkConnection = async () => {
  let isConnected = false
  while (!isConnected) {
    console.log('Connecting to ES')
    try {
      const health = await client.cluster.health({})
      console.log(health)
      isConnected = true
    } catch (err) {
      console.error('Connection Failed, Retrying...', err)
    }
  }
}

const createSchema = async (index, properties) =>  {
  console.log('creating mappings for:', index)

  const res = await client.indices.create({
    index,
    body: {
      mappings: {
        properties,
      }
    }
  }, { ignore: [400] })

  return res.statusCode
}

const resetIndex = async (index, properties) => {
  const exists = await client.indices.exists({ index })

  if (exists.body) {
    console.log()
    console.log('index:', index, 'already exists.')

    if ('DELETE_INDEX' in process.env && process.env.DELETE_INDEX === 'Y') {
      console.log('Re-creating:', index)
      await client.indices.delete({ index })
    } else {
      console.log('WARNING!!! If you want to delete the index and create a new one.')
      console.log('WARNING!!! you can override it by setting: DELETE_INDEX=Y as env var.')
      return 400
    }
  }

  return await createSchema(index, properties)
}

const queryEs = async (index, query, size=10, from=0, sort=null, aggs=null) => {
  const body = {
    from,
    size,
    query,
  }

  if (sort !== null) {
    body.sort = sort
  }

  if (aggs !== null) {
    body.aggs = aggs
  }

  const res = await client.search({ index, body })

  return res
}

module.exports = {
  checkConnection,
  client,
  queryEs,
  resetIndex,
}
