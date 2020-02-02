module.exports = {
  pgUser: process.env.POSTGRES_DB_USER,
  pgPort: process.env.POSTGRES_DB_PORT,
  pgHost: process.env.POSTGRES_DB_HOST,
  pgDatabase: process.env.POSTGRES_DB_NAME,
  pgPassword: process.env.POSTGRES_DB_PASSWORD,
  aMemberHost: process.env.AMEMBER_HOST,
  esHost: process.env.ES_HOST,
}
