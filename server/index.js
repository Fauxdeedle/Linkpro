const path = require('path');
const express = require('express');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const checkoutRouter = require('./routes/checkout');
const webhooksRouter = require('./routes/webhooks');
const { isConfigured } = require('../lib/flute');

const app = express();
const PORT = process.env.PORT || 8080;
const rootDir = path.join(__dirname, '..');

app.use('/api/webhooks/flute', webhooksRouter);
app.use(express.json());
app.use('/api', checkoutRouter);
app.use(express.static(rootDir));

app.listen(PORT, () => {
  console.log(`LINK Pro running at http://localhost:${PORT}`);
  console.log(isConfigured() ? 'Flute: configured' : 'Flute: add credentials in .env to enable checkout');
});
