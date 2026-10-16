const fs = require('fs');
const path = require('path');

const ONLINE_COURSE_IDS = ['pelvis-1', 'pelvis-3', 'llip'];
const ONLINE_COURSES = new Set(ONLINE_COURSE_IDS);

const COURSE_PATHS = {
  'pelvis-1': '/pelvis-1-course.html',
  'pelvis-3': '/pelvis-3-course.html',
  llip: '/llip-course.html',
};

function isOnlineCourse(courseId) {
  return ONLINE_COURSES.has(courseId);
}

function coursePath(courseId) {
  return COURSE_PATHS[courseId] || null;
}

function safeCoursePath(value) {
  return Object.values(COURSE_PATHS).includes(value) ? value : '/courses';
}

function normalizeEmail(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const email = value.trim().toLowerCase();
  if (!email || email.length > 254) {
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

function createMemoryStore() {
  const coursesByEmail = new Map();
  const logins = new Map();

  return {
    async getCourses(email) {
      return [...(coursesByEmail.get(email) || [])].sort();
    },
    async grant(email, courseId) {
      const courses = coursesByEmail.get(email) || new Set();
      courses.add(courseId);
      coursesByEmail.set(email, courses);
      return [...courses].sort();
    },
    async rememberLogin(jti, ttlSeconds, now = Date.now()) {
      logins.set(jti, now + ttlSeconds * 1000);
    },
    async consumeLogin(jti, now = Date.now()) {
      const expiresAt = logins.get(jti);
      if (!expiresAt || expiresAt <= now) {
        logins.delete(jti);
        return false;
      }
      logins.delete(jti);
      return true;
    },
  };
}

function createFileStore(filePath) {
  function read() {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return {
        entitlements: parsed.entitlements || {},
        logins: parsed.logins || {},
      };
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      return { entitlements: {}, logins: {} };
    }
  }

  function write(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data));
  }

  return {
    async getCourses(email) {
      const courses = read().entitlements[email];
      return Array.isArray(courses) ? [...courses].sort() : [];
    },
    async grant(email, courseId) {
      const data = read();
      const courses = new Set(data.entitlements[email] || []);
      courses.add(courseId);
      data.entitlements[email] = [...courses].sort();
      write(data);
      return data.entitlements[email];
    },
    async rememberLogin(jti, ttlSeconds, now = Date.now()) {
      const data = read();
      data.logins[jti] = now + ttlSeconds * 1000;
      write(data);
    },
    async consumeLogin(jti, now = Date.now()) {
      const data = read();
      const expiresAt = data.logins[jti];
      delete data.logins[jti];
      write(data);
      return Boolean(expiresAt && expiresAt > now);
    },
  };
}

function createRedisStore({ url, token, fetchImpl = fetch }) {
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
      throw new Error(data.error || 'Entitlement store request failed');
    }
    return data.result;
  }

  return {
    async getCourses(email) {
      const result = await command(['SMEMBERS', `entitlement:${email}`]);
      return Array.isArray(result) ? result.filter(isOnlineCourse).sort() : [];
    },
    async grant(email, courseId) {
      await command(['SADD', `entitlement:${email}`, courseId]);
      return this.getCourses(email);
    },
    async rememberLogin(jti, ttlSeconds) {
      await command(['SET', `login:${jti}`, '1', 'EX', String(ttlSeconds)]);
    },
    async consumeLogin(jti) {
      const result = await command(['GETDEL', `login:${jti}`]);
      return result === '1';
    },
  };
}

let singleton = null;

function entitlementStoreMode() {
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return 'redis';
  }
  if (process.env.ENTITLEMENT_FILE) {
    return 'file';
  }
  return 'memory';
}

function getEntitlementStore() {
  if (singleton) {
    return singleton;
  }

  const mode = entitlementStoreMode();
  if (mode === 'redis') {
    singleton = createRedisStore({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return singleton;
  }

  if (mode === 'file') {
    singleton = createFileStore(process.env.ENTITLEMENT_FILE);
    return singleton;
  }

  console.warn(
    'Entitlements are in memory only. Set Upstash Redis to keep course access.'
  );
  singleton = createMemoryStore();
  return singleton;
}

function setEntitlementStore(store) {
  singleton = store;
}

async function grantCourse(email, courseId, store = getEntitlementStore()) {
  const normalized = normalizeEmail(email);
  if (!normalized || !isOnlineCourse(courseId)) {
    return { granted: false };
  }

  const courses = await store.grant(normalized, courseId);
  return { granted: true, email: normalized, courses };
}

async function getCourses(email, store = getEntitlementStore()) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return [];
  }

  const courses = await store.getCourses(normalized);
  return courses.filter(isOnlineCourse);
}

module.exports = {
  ONLINE_COURSE_IDS,
  COURSE_PATHS,
  isOnlineCourse,
  coursePath,
  safeCoursePath,
  normalizeEmail,
  createMemoryStore,
  createFileStore,
  createRedisStore,
  entitlementStoreMode,
  getEntitlementStore,
  setEntitlementStore,
  grantCourse,
  getCourses,
};
