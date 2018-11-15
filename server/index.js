/* jshint esversion: 6 */

// Express App Setup

const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const keys = require('./keys');

const app = express();
app.use(cors());
app.use(bodyParser.json());


// Postgres Client Setup

const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort
});

pgClient.on('error', () => console.log('Lost PG connection'));

// pgClient
//     .query('CREATE TABLE IF NOT EXISTS values (number INT)')
//     .catch(err => console.log(err));
// console.log('Table values created');
console.log('pg://'+keys.pgUser+":"+keys.pgPassword+'@'+keys.pgDatabase);

// Express route handlers

app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/check', async (req, res) => {
  console.log("GET /values/check");

  try {
    const result = await axios.get('https://api.rippr.io/amember/api/check-access/by-login?_key=Mk4ga6B8bonz2x409Blq&login=d5b7e8010264478a0017e1a22309cf5b')
    console.log(result);
    res.send(result.data);
  } catch (error) {
    console.log(error);
    res.send([]);
  }
});

app.get('/values/api', async (req, res) => {
  console.log("GET /values/api", keys.aMemberHost);

  try {
    const result = await axios.get(`http://${keys.aMemberHost}/amember/api/check-access/by-login?_key=Mk4ga6B8bonz2x409Blq&login=d5b7e8010264478a0017e1a22309cf5b`)
    console.log(result);
    res.send(result.data);
  } catch (error) {
    console.log(error);
    res.send([]);
  }
});

app.get('/values/all', async (req, res) => {
  console.log("GET /values/all");
  const values = await pgClient.query('SELECT * from profile');
  res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
  console.log("GET /values/current");
  res.send([2,]);
});

app.post('/values', async (req, res) => {
  console.log("POST /values");
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high');
  }

  // pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

  res.send({ working: true });
});

app.listen(5000, err => {
   console.log('Listening on 5000');
});
