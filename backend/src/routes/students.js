const express = require('express');
const {
  listStudents,
  getStudentById,
  getStudentRegistrations,
  computeSummary,
  calculateBadge,
} = require('../data');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const students = await listStudents();
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const student = await getStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Öğrenci bulunamadı' });

    const summary = await computeSummary(student.id);
    const badge = calculateBadge(summary.total);

    res.json({ student, summary, badge });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Öğrencinin etkinlik katılımları
router.get('/:id/activities', async (req, res) => {
  try {
    const student = await getStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Öğrenci bulunamadı' });

    const registrations = await getStudentRegistrations(student.id);
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
