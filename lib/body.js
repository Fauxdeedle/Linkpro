async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function readJsonBody(req) {
  const body = req.body;
  if (Buffer.isBuffer(body)) {
    if (!body.length) return {};
    return JSON.parse(body.toString('utf8'));
  }
  if (body && typeof body === 'object') {
    return body;
  }
  if (typeof body === 'string' && body.length > 0) {
    return JSON.parse(body);
  }
  return {};
}

module.exports = { readRawBody, readJsonBody };
