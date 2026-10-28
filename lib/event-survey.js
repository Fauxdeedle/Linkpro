const SUBJECT = 'LINK Pro survey — Fascia Normalization and 2TLS, Lower Limb';
const COURSE = 'Fascia Normalization and 2TLS Treatment of the Lower Limb';

const FORMAT_OPTIONS = [
  { id: 'hands-on', label: 'Hands on workshops' },
  { id: 'lecture', label: 'Lecture + case studies' },
  { id: 'short', label: 'Short intensives' },
  { id: 'multi-day', label: 'Multi-day sessions' },
  { id: 'other', label: 'Other' },
];

const SCALE_OPTIONS = [
  { id: 'strongly-disagree', label: 'Strongly disagree' },
  { id: 'disagree', label: 'Disagree' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'agree', label: 'Agree' },
  { id: 'strongly-agree', label: 'Strongly agree' },
];

const SCALE_QUESTIONS = [
  {
    id: 'confidence',
    label: 'I feel more confident in assessing dysfunctions after this course.',
  },
  {
    id: 'outcomes',
    label: 'The knowledge gained here will improve outcomes for the clients/athletes I work with.',
  },
  {
    id: 'balance',
    label: 'The balance between theory and hands-on practice was effective.',
  },
  {
    id: 'anotherCourse',
    label: 'I am likely to take another course from Dr. Amstutz.',
  },
  {
    id: 'explained',
    label: 'Dr. Amstutz explained complex concepts in a way that was easy to understand.',
  },
];

const TEXT_QUESTIONS = [
  {
    id: 'lectures',
    label: 'Do you like the integrated/clinical application lectures that Dr. Amstutz has prepared for this course? Would you prefer more of an anatomical review and more tensegrity biomechanics? Why?',
  },
  {
    id: 'methodology',
    label: 'Some of these techniques Dr. Amstutz feels are better taught with landmark and relationship anatomy at the forefront, instead of the demonstration and practice model. Do you enjoy this methodology? Why or why not?',
  },
  {
    id: 'formatLength',
    label: "This year is Dr. Amstutz's first year of teaching Fascia Normalization and 2TLS in the same long weekend. He has also shortened the format to three days to better fit student schedules. Do you like this shortened version or would you prefer the four day version? Please elaborate.",
  },
  {
    id: 'applyMost',
    label: 'Which part of the course do you see yourself applying most in your practice?',
  },
  {
    id: 'colleague',
    label: 'If you were to explain the course value to a colleague in one sentence, what would you say?',
  },
  {
    id: 'aha',
    label: 'What\'s one "aha moment" or concept from the course that shifted the way you think about injury prevention?',
  },
];

const NAME_LIMIT = 80;
const EMAIL_LIMIT = 254;
const TEXT_LIMIT = 4000;
const SEND_ERROR = 'Could not send your response. Please try again.';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function labelFor(options, id) {
  return options.find((option) => option.id === id)?.label || id;
}

function readName(value, label) {
  if (typeof value !== 'string') return { error: `${label} is required.` };
  const trimmed = value.trim();
  if (!trimmed) return { error: `${label} is required.` };
  if (trimmed.length > NAME_LIMIT) return { error: `${label} is too long.` };
  return { value: trimmed };
}

function readEmail(value) {
  if (typeof value !== 'string') return { error: 'A valid email is required.' };
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > EMAIL_LIMIT || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { error: 'A valid email is required.' };
  }
  return { value: trimmed };
}

function readFormats(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: 'Choose at least one course format.' };
  }
  const allowed = new Set(FORMAT_OPTIONS.map((option) => option.id));
  const chosen = [];
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.has(item) || chosen.includes(item)) {
      return { error: 'Choose a course format from the list.' };
    }
    chosen.push(item);
  }
  return { value: chosen };
}

function readScales(value) {
  if (!isPlainObject(value)) {
    return { error: 'Please answer every agreement question.' };
  }
  const scales = {};
  for (const question of SCALE_QUESTIONS) {
    const answer = value[question.id];
    if (typeof answer !== 'string' || !SCALE_OPTIONS.some((option) => option.id === answer)) {
      return { error: 'Please answer every agreement question.' };
    }
    scales[question.id] = answer;
  }
  return { value: scales };
}

function readTexts(body) {
  const texts = {};
  for (const question of TEXT_QUESTIONS) {
    const value = body[question.id];
    if (typeof value !== 'string' || !value.trim()) {
      return { error: 'Please answer every written question.' };
    }
    const trimmed = value.trim();
    if (trimmed.length > TEXT_LIMIT) return { error: 'One answer is too long.' };
    texts[question.id] = trimmed;
  }
  return { value: texts };
}

function parseSurvey(body) {
  if (!isPlainObject(body)) return { error: 'Please complete the required questions.' };

  const firstName = readName(body.firstName, 'First name');
  if (firstName.error) return firstName;
  const lastName = readName(body.lastName, 'Last name');
  if (lastName.error) return lastName;
  const email = readEmail(body.email);
  if (email.error) return email;
  if (body.newsOptIn !== undefined && typeof body.newsOptIn !== 'boolean') {
    return { error: 'Please complete the required questions.' };
  }
  const formats = readFormats(body.formats);
  if (formats.error) return formats;
  const scales = readScales(body.scales);
  if (scales.error) return scales;
  const texts = readTexts(body);
  if (texts.error) return texts;

  return {
    value: {
      firstName: firstName.value,
      lastName: lastName.value,
      email: email.value,
      newsOptIn: body.newsOptIn === true,
      formats: formats.value,
      scales: scales.value,
      texts: texts.value,
    },
  };
}

function renderSurveyEmail(survey) {
  const lines = [
    COURSE,
    '',
    `Name: ${survey.firstName} ${survey.lastName}`,
    `Email: ${survey.email}`,
    `News and updates: ${survey.newsOptIn ? 'Yes' : 'No'}`,
    '',
    'What type of course format do you prefer?',
    ...survey.formats.map((id) => `- ${labelFor(FORMAT_OPTIONS, id)}`),
    '',
  ];

  for (const question of SCALE_QUESTIONS) {
    lines.push(question.label, labelFor(SCALE_OPTIONS, survey.scales[question.id]), '');
  }
  for (const question of TEXT_QUESTIONS) {
    lines.push(question.label, survey.texts[question.id], '');
  }

  return `${lines.join('\n').trim()}\n`;
}

function mailConfigured() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ACCESS_EMAIL_FROM;
  const to = process.env.SURVEY_NOTIFY_EMAIL;
  return Boolean(
    apiKey &&
      from &&
      to &&
      !apiKey.startsWith('...') &&
      !from.startsWith('...') &&
      !to.startsWith('...')
  );
}

async function sendSurveyEmail(survey, fetchImpl) {
  if (!mailConfigured()) {
    console.info('Survey email delivery is not configured');
    return { sent: false };
  }

  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.ACCESS_EMAIL_FROM,
      to: process.env.SURVEY_NOTIFY_EMAIL,
      reply_to: survey.email,
      subject: SUBJECT,
      text: renderSurveyEmail(survey),
    }),
  });

  if (!response.ok) {
    console.error('Survey email failed', { status: response.status });
    return { sent: false };
  }

  return { sent: true };
}

async function submitEventSurvey(body, { fetchImpl = fetch } = {}) {
  if (isPlainObject(body) && typeof body.company === 'string' && body.company.trim()) {
    return { status: 200, body: { ok: true } };
  }

  const parsed = parseSurvey(body);
  if (parsed.error) return { status: 400, body: { error: parsed.error } };

  const sent = await sendSurveyEmail(parsed.value, fetchImpl);
  if (!sent.sent) return { status: 503, body: { error: SEND_ERROR } };
  return { status: 200, body: { ok: true } };
}

module.exports = {
  COURSE,
  FORMAT_OPTIONS,
  SCALE_OPTIONS,
  SCALE_QUESTIONS,
  SUBJECT,
  TEXT_QUESTIONS,
  submitEventSurvey,
};
