const { neon } = require('@neondatabase/serverless');

let sqlClient = null;

function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function getSql() {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is not configured');
  }
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }
  return sqlClient;
}

async function hasEntitlement(userId, courseId) {
  const sql = getSql();
  const rows = await sql`
    SELECT 1
    FROM course_entitlements
    WHERE user_id = ${userId}
      AND course_id = ${courseId}
      AND (revoked_at IS NULL)
    LIMIT 1
  `;
  return rows.length > 0;
}

async function grantEntitlement({
  userId,
  courseId,
  paymentSessionId,
  transactionId,
  amount,
}) {
  const sql = getSql();
  await sql.transaction([
    sql`
      INSERT INTO payment_records (
        payment_session_id, user_id, course_id, transaction_id, amount, status
      )
      VALUES (
        ${paymentSessionId}, ${userId}, ${courseId},
        ${transactionId || null}, ${amount || null}, 'paid'
      )
      ON CONFLICT (payment_session_id)
      DO UPDATE SET
        transaction_id = EXCLUDED.transaction_id,
        amount = EXCLUDED.amount,
        status = 'paid',
        updated_at = NOW()
    `,
    sql`
      INSERT INTO course_entitlements (
        user_id, course_id, source_payment_session_id
      )
      VALUES (${userId}, ${courseId}, ${paymentSessionId})
      ON CONFLICT (user_id, course_id)
      DO UPDATE SET
        source_payment_session_id = EXCLUDED.source_payment_session_id,
        revoked_at = NULL,
        updated_at = NOW()
    `,
  ]);
}

async function getProgress(userId, courseId) {
  const sql = getSql();
  const rows = await sql`
    SELECT completed_lessons
    FROM course_progress
    WHERE user_id = ${userId} AND course_id = ${courseId}
    LIMIT 1
  `;
  return rows[0]?.completed_lessons || [];
}

async function saveProgress(userId, courseId, completedLessons) {
  const sql = getSql();
  await sql`
    INSERT INTO course_progress (user_id, course_id, completed_lessons)
    VALUES (${userId}, ${courseId}, ${JSON.stringify(completedLessons)}::jsonb)
    ON CONFLICT (user_id, course_id)
    DO UPDATE SET
      completed_lessons = EXCLUDED.completed_lessons,
      updated_at = NOW()
  `;
}

module.exports = {
  isDatabaseConfigured,
  getSql,
  hasEntitlement,
  grantEntitlement,
  getProgress,
  saveProgress,
};
