const { grantCourse, isOnlineCourse, normalizeEmail } = require('./entitlements');

function parseGrantCsv(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^email\s*,/i.test(line))
    .map((line) => {
      const [email, courseId] = line.split(',').map((part) => part.trim());
      return { line, email, courseId };
    });
}

async function importGrantCsv(text, grant = grantCourse) {
  const granted = [];
  const skipped = [];

  for (const row of parseGrantCsv(text)) {
    const email = normalizeEmail(row.email);
    if (!email || !isOnlineCourse(row.courseId)) {
      skipped.push(row);
      continue;
    }

    await grant(email, row.courseId);
    granted.push({ email, courseId: row.courseId });
  }

  return { granted, skipped };
}

module.exports = { parseGrantCsv, importGrantCsv };
