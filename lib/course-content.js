const fs = require('fs');
const path = require('path');
const { getProduct } = require('../server/config/products');
const { emailFromRequest } = require('./access');
const { getCourses, isOnlineCourse } = require('./entitlements');

const LESSON_FILES = {
  'pelvis-1': 'pelvis-1.json',
  'pelvis-3': 'pelvis-3.json',
  llip: 'llip.json',
};

function courseOffer(slug) {
  const product = getProduct(slug);
  if (!product) {
    return null;
  }

  return {
    error: 'Enrollment required',
    productId: product.id,
    productName: product.name,
    amount: product.amount,
    checkoutUrl: `/checkout.html?product=${encodeURIComponent(product.id)}`,
  };
}

function readCourseLessons(slug) {
  const fileName = LESSON_FILES[slug];
  if (!fileName) {
    return null;
  }

  const filePath = path.join(__dirname, '..', 'content', 'courses', fileName);
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(parsed.lessons)) {
    return null;
  }

  return parsed.lessons.map((lesson) => ({
    title: String(lesson.title || ''),
    duration: String(lesson.duration || ''),
    description: String(lesson.description || ''),
    youtube: String(lesson.youtube || ''),
  }));
}

async function getCourseForRequest(slug, req) {
  if (!isOnlineCourse(slug) || !LESSON_FILES[slug]) {
    return { status: 404, body: { error: 'Unknown course' } };
  }

  const email = emailFromRequest(req);
  const courses = email ? await getCourses(email) : [];
  if (!email || !courses.includes(slug)) {
    return { status: 401, body: courseOffer(slug) };
  }

  return { status: 200, body: { lessons: readCourseLessons(slug) } };
}

module.exports = {
  courseOffer,
  readCourseLessons,
  getCourseForRequest,
};
