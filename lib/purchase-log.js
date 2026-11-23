const fs = require('fs');
const path = require('path');

const { redisSettings } = require('./entitlements');
const { manualGrantRecord, paymentRecord } = require('./purchase-sheet');

const INDEX_KEY = 'purchases:index';
const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'purchases.json');

function recordKey(sessionId) {
  return `purchase:${sessionId}`;
}

function createMemoryPurchaseLog() {
  const records = new Map();
  return {
    async upsert(record) {
      const action = records.has(record.sessionId) ? 'update' : 'append';
      records.set(record.sessionId, { ...record });
      return action;
    },
    async list() {
      return [...records.values()].map((record) => ({ ...record }));
    },
  };
}

let memoryLog = null;

function sharedMemoryLog() {
  if (!memoryLog) memoryLog = createMemoryPurchaseLog();
  return memoryLog;
}

function createFilePurchaseLog(filePath) {
  function read() {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Purchase log file is not valid');
      }
      return parsed;
    } catch (err) {
      if (err.code === 'ENOENT') return {};
      throw err;
    }
  }

  function write(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data));
  }

  return {
    async upsert(record) {
      const data = read();
      const action = data[record.sessionId] ? 'update' : 'append';
      data[record.sessionId] = record;
      write(data);
      return action;
    },
    async list() {
      return Object.values(read()).filter((record) => record && record.sessionId);
    },
  };
}

function createRedisPurchaseLog({ url, token, fetchImpl }) {
  async function command(args) {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error || 'Purchase log request failed');
    }
    return data.result;
  }

  return {
    async upsert(record) {
      const key = recordKey(record.sessionId);
      const previous = await command(['GET', key]);
      await command(['SET', key, JSON.stringify(record)]);
      await command(['SADD', INDEX_KEY, record.sessionId]);
      return previous ? 'update' : 'append';
    },
    async list() {
      const ids = await command(['SMEMBERS', INDEX_KEY]);
      if (!Array.isArray(ids) || !ids.length) return [];
      const values = await command(['MGET', ...ids.map((id) => recordKey(String(id)))]);
      if (!Array.isArray(values)) return [];
      const records = [];
      for (const value of values) {
        if (typeof value !== 'string' || !value) continue;
        try {
          const record = JSON.parse(value);
          if (record && record.sessionId) records.push(record);
        } catch (err) {
          console.error('Purchase log record could not be read:', err.message);
        }
      }
      return records;
    },
  };
}

function unconfiguredLog() {
  return {
    async upsert() {
      throw new Error('Purchase log is not configured');
    },
    async list() {
      throw new Error('Purchase log is not configured');
    },
  };
}

function createPurchaseLog(env = process.env, fetchImpl = globalThis.fetch) {
  const redis = redisSettings(env);
  if (redis) return createRedisPurchaseLog({ ...redis, fetchImpl });
  if (env.VERCEL) return unconfiguredLog();
  const filePath =
    typeof env.PURCHASE_LOG_FILE === 'string' && env.PURCHASE_LOG_FILE.trim()
      ? env.PURCHASE_LOG_FILE.trim()
      : DEFAULT_FILE;
  return createFilePurchaseLog(filePath);
}

function storeFor(options = {}) {
  if (options.store) return options.store;
  const env = options.env || process.env;
  if (!options.env && process.env.NODE_TEST_CONTEXT) return sharedMemoryLog();
  return createPurchaseLog(env, options.fetchImpl || globalThis.fetch);
}

async function writeRecord(record, options) {
  if (!record) return { recorded: false };
  const action = await storeFor(options).upsert(record);
  return { recorded: true, action };
}

async function recordPurchaseLog(purchase = {}, options = {}) {
  const now = options.now || (() => new Date());
  return writeRecord(paymentRecord(purchase, now), options);
}

async function recordManualGrantLog(grant = {}, options = {}) {
  const now = options.now || (() => new Date());
  return writeRecord(manualGrantRecord(grant, now), options);
}

async function listPurchaseLog(options = {}) {
  const records = await storeFor(options).list();
  return Array.isArray(records) ? records : [];
}

module.exports = {
  createMemoryPurchaseLog,
  listPurchaseLog,
  recordManualGrantLog,
  recordPurchaseLog,
};
