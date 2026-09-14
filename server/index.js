const fs = require('fs');
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

/** Match Vercel cleanUrls locally (e.g. /about → about.html). */
function cleanUrls(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }
  const urlPath = req.path;
  if (urlPath.startsWith('/api') || path.basename(urlPath).includes('.')) {
    return next();
  }
  const relative =
    urlPath === '/' || urlPath === ''
      ? 'index.html'
      : `${urlPath.replace(/^\//, '')}.html`;
  const filePath = path.join(rootDir, relative);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  return next();
}

app.use(cleanUrls);
app.use(express.static(rootDir));

app.listen(PORT, () => {
  console.log(`LINK Pro running at http://localhost:${PORT}`);
  console.log(isConfigured() ? 'Flute: configured' : 'Flute: add credentials in .env to enable checkout');
});
