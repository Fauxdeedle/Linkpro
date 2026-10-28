const test = require('node:test');
const assert = require('node:assert/strict');
const { submitEventSurvey, SUBJECT } = require('../lib/event-survey');

const ENV_KEYS = ['RESEND_API_KEY', 'ACCESS_EMAIL_FROM', 'SURVEY_NOTIFY_EMAIL'];

function validBody(overrides = {}) {
  return {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    newsOptIn: true,
    formats: ['hands-on', 'lecture'],
    scales: {
      confidence: 'agree',
      outcomes: 'strongly-agree',
      balance: 'neutral',
      anotherCourse: 'disagree',
      explained: 'strongly-disagree',
    },
    lectures: 'The clinical lectures were the most useful part.',
    methodology: 'I like landmark anatomy first, then practice.',
    formatLength: 'Three days was enough. I would not need a fourth.',
    applyMost: 'Assessment of the lower limb.',
    colleague: 'It changed how I find the driver of the pain.',
    aha: 'Injury prevention starts with how the limb shares load.',
    company: '',
    ...overrides,
  };
}

async function withMailEnv(fn) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.ACCESS_EMAIL_FROM = 'LINK Pro <access@example.com>';
  process.env.SURVEY_NOTIFY_EMAIL = 'concierge@example.com';
  try {
    return await fn();
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test('survey rejects a missing first name', async () => {
  const result = await submitEventSurvey(validBody({ firstName: '  ' }), {
    fetchImpl: async () => {
      throw new Error('should not send');
    },
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'First name is required.');
});

test('survey rejects an invalid email and a bad scale', async () => {
  const badEmail = await submitEventSurvey(validBody({ email: 'not-an-email' }));
  assert.equal(badEmail.status, 400);
  assert.equal(badEmail.body.error, 'A valid email is required.');

  const badScale = await submitEventSurvey(validBody({
    scales: { ...validBody().scales, confidence: 'love-it' },
  }));
  assert.equal(badScale.status, 400);
  assert.equal(badScale.body.error, 'Please answer every agreement question.');
});

test('survey ignores a filled honeypot without emailing', async () => {
  let called = false;
  const result = await submitEventSurvey(validBody({ company: 'Acme Bots' }), {
    fetchImpl: async () => {
      called = true;
      return { ok: true };
    },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.equal(called, false);
});

test('survey emails every answer and reports a send failure', async () => {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  try {
    const missing = await submitEventSurvey(validBody(), {
      fetchImpl: async () => {
        throw new Error('should not send');
      },
    });
    assert.equal(missing.status, 503);

    await withMailEnv(async () => {
      let sent;
      const result = await submitEventSurvey(validBody(), {
        fetchImpl: async (url, options) => {
          sent = { url, body: JSON.parse(options.body), authorization: options.headers.Authorization };
          return { ok: true, status: 200 };
        },
      });

      assert.equal(result.status, 200);
      assert.equal(sent.url, 'https://api.resend.com/emails');
      assert.equal(sent.authorization, 'Bearer re_test_key');
      assert.equal(sent.body.from, 'LINK Pro <access@example.com>');
      assert.equal(sent.body.to, 'concierge@example.com');
      assert.equal(sent.body.reply_to, 'ada@example.com');
      assert.equal(sent.body.subject, SUBJECT);
      assert.match(sent.body.text, /Name: Ada Lovelace/);
      assert.match(sent.body.text, /Email: ada@example.com/);
      assert.match(sent.body.text, /News and updates: Yes/);
      assert.match(sent.body.text, /- Hands on workshops/);
      assert.match(sent.body.text, /- Lecture \+ case studies/);
      assert.match(sent.body.text, /I feel more confident in assessing dysfunctions after this course\.\nAgree/);
      assert.match(sent.body.text, /Strongly disagree/);
      assert.match(sent.body.text, /Three days was enough/);
      assert.doesNotMatch(sent.body.text, /Acme|company/i);

      const rejected = await submitEventSurvey(validBody({ newsOptIn: false }), {
        fetchImpl: async (_url, options) => {
          assert.match(JSON.parse(options.body).text, /News and updates: No/);
          return { ok: false, status: 422 };
        },
      });
      assert.equal(rejected.status, 503);
      assert.match(rejected.body.error, /try again/);
    });
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
