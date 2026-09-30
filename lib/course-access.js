const { getPaymentSession } = require('./flute');
const { formatCheckoutSession } = require('./checkout');
const {
  hasEntitlement,
  grantEntitlement,
  getProgress,
  saveProgress,
} = require('./database');
const { getProduct } = require('../server/config/products');
const { getCourse } = require('../server/config/courses');

async function fulfillPaymentSession(
  paymentSessionId,
  {
    retrieveSession = getPaymentSession,
    grant = grantEntitlement,
  } = {}
) {
  const session = await retrieveSession(paymentSessionId);
  const result = formatCheckoutSession(session);
  const userId = session.metadata?.userId;
  const product = getProduct(result.productId);

  if (result.status !== 'paid' || !userId || !product?.courseId) {
    return result;
  }

  const transaction = session.transactionDetails || {};
  await grant({
    userId,
    courseId: product.courseId,
    paymentSessionId,
    transactionId:
      transaction.transactionId ||
      transaction.transactionReceipt?.transactionId,
    amount:
      transaction.transactionReceipt?.amount ??
      transaction.amount ??
      product.amount,
  });

  return { ...result, entitlementGranted: true };
}

async function getProtectedCourse(
  userId,
  courseId,
  {
    checkEntitlement = hasEntitlement,
    readProgress = getProgress,
  } = {}
) {
  const course = getCourse(courseId);
  if (!course) {
    return { error: 'Course not found', status: 404 };
  }
  if (!(await checkEntitlement(userId, courseId))) {
    return { error: 'Purchase required', status: 403 };
  }

  return {
    course,
    completedLessons: await readProgress(userId, courseId),
  };
}

async function updateCourseProgress(
  userId,
  courseId,
  completedLessons,
  {
    checkEntitlement = hasEntitlement,
    writeProgress = saveProgress,
  } = {}
) {
  const course = getCourse(courseId);
  if (!course) {
    return { error: 'Course not found', status: 404 };
  }
  if (!(await checkEntitlement(userId, courseId))) {
    return { error: 'Purchase required', status: 403 };
  }
  if (
    !Array.isArray(completedLessons) ||
    completedLessons.some(
      (index) =>
        !Number.isInteger(index) ||
        index < 0 ||
        index >= course.lessons.length
    )
  ) {
    return { error: 'Invalid lesson progress', status: 400 };
  }

  const normalized = [...new Set(completedLessons)].sort((a, b) => a - b);
  await writeProgress(userId, courseId, normalized);
  return { completedLessons: normalized };
}

module.exports = {
  fulfillPaymentSession,
  getProtectedCourse,
  updateCourseProgress,
};
