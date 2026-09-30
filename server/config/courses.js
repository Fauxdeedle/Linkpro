const courses = {
  'pelvis-1': {
    id: 'pelvis-1',
    productId: 'pelvis-1',
    title: 'Pelvis 1.0',
    description:
      'Build a practical understanding of pelvic biomechanics, assessment, and corrective exercise.',
    lessons: [
      {
        title: 'The Pelvis as the Foundation',
        duration: '18 min',
        description:
          'Establish the role of the pelvis in whole-body movement. This lesson introduces the anatomical landmarks, load-transfer principles, and foundational concepts used throughout the course.',
        youtube: '',
      },
      {
        title: 'Pelvic Biomechanics & Oblique Axes',
        duration: '27 min',
        description:
          'Explore nutation, counternutation, and the oblique axes that organize pelvic motion. Learn how these mechanics influence gait, force production, and compensation.',
        youtube: '',
      },
      {
        title: 'Assessment & Identifying Dysfunction',
        duration: '32 min',
        description:
          'Follow a repeatable movement assessment to identify asymmetry and dysfunction. Connect what you observe to likely restrictions and compensation patterns.',
        youtube: '',
      },
      {
        title: 'Corrective Exercise Strategies',
        duration: '29 min',
        description:
          'Translate assessment findings into practical interventions. Apply mobility, stability, and integration strategies that support durable movement outcomes.',
        youtube: '',
      },
    ],
  },
};

function getCourse(courseId) {
  return courses[courseId] || null;
}

module.exports = { courses, getCourse };
