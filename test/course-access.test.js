const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fulfillPaymentSession,
  getProtectedCourse,
  updateCourseProgress,
} = require('../lib/course-access');

test('paid sessions grant the authenticated purchaser course access', async () => {
  let granted;
  const result = await fulfillPaymentSession('payment-session-1', {
    retrieveSession: async () => ({
      status: 'Completed',
      referenceId: 'pelvis-1-123',
      metadata: { productId: 'pelvis-1', userId: 'user_123' },
      transactionDetails: {
        status: 'Captured',
        transactionReceipt: {
          amount: 100,
          transactionId: 'transaction-1',
        },
      },
    }),
    grant: async (entitlement) => {
      granted = entitlement;
    },
  });

  assert.equal(result.status, 'paid');
  assert.equal(result.entitlementGranted, true);
  assert.deepEqual(granted, {
    userId: 'user_123',
    courseId: 'pelvis-1',
    paymentSessionId: 'payment-session-1',
    transactionId: 'transaction-1',
    amount: 100,
  });
});

test('declined and anonymous sessions never grant access', async () => {
  let grants = 0;
  const grant = async () => {
    grants += 1;
  };

  await fulfillPaymentSession('declined-session', {
    retrieveSession: async () => ({
      status: 'Completed',
      metadata: { productId: 'pelvis-1', userId: 'user_123' },
      transactionDetails: { status: 'Declined' },
    }),
    grant,
  });
  await fulfillPaymentSession('anonymous-session', {
    retrieveSession: async () => ({
      status: 'Completed',
      metadata: { productId: 'pelvis-1' },
      transactionDetails: {
        status: 'Captured',
        transactionReceipt: { amount: 100 },
      },
    }),
    grant,
  });

  assert.equal(grants, 0);
});

test('course content requires an active entitlement', async () => {
  assert.deepEqual(
    await getProtectedCourse('user_123', 'pelvis-1', {
      checkEntitlement: async () => false,
    }),
    { error: 'Purchase required', status: 403 }
  );

  const result = await getProtectedCourse('user_123', 'pelvis-1', {
    checkEntitlement: async () => true,
    readProgress: async () => [0, 2],
  });
  assert.equal(result.course.id, 'pelvis-1');
  assert.equal(result.course.lessons.length, 4);
  assert.deepEqual(result.completedLessons, [0, 2]);
});

test('progress updates are entitlement-gated, validated, and normalized', async () => {
  let saved;
  const result = await updateCourseProgress(
    'user_123',
    'pelvis-1',
    [2, 0, 2],
    {
      checkEntitlement: async () => true,
      writeProgress: async (_userId, _courseId, completed) => {
        saved = completed;
      },
    }
  );
  assert.deepEqual(result, { completedLessons: [0, 2] });
  assert.deepEqual(saved, [0, 2]);

  assert.deepEqual(
    await updateCourseProgress('user_123', 'pelvis-1', [99], {
      checkEntitlement: async () => true,
    }),
    { error: 'Invalid lesson progress', status: 400 }
  );
  assert.deepEqual(
    await updateCourseProgress('user_123', 'pelvis-1', [0], {
      checkEntitlement: async () => false,
    }),
    { error: 'Purchase required', status: 403 }
  );
});
