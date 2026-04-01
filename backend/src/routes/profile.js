const express = require('express');
const {
  getStudentById,
  updateStudentProfile,
  changeStudentPassword,
  computeSummary,
  calculateBadge,
  checkAndAssignBadges,
  getStudentRegistrations,
  generateStudentReport,
} = require('../data');

const router = express.Router();

// Öğrenci profili getir
router.get('/:id', async (req, res) => {
  try {
    const student = await getStudentById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Öğrenci bulunamadı' });
    }

    delete student.password;

    const summary = await computeSummary(student.id);
    const badge = calculateBadge(summary.total);
    const badgeStatus = await checkAndAssignBadges(student.id);

    res.json({
      student,
      summary,
      badge,
      badgeStatus
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profil güncelle
router.patch('/:id', async (req, res) => {
  try {
    const student = await getStudentById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Öğrenci bulunamadı' });
    }

    const updated = await updateStudentProfile(req.params.id, req.body);
    delete updated.password;

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Şifre değiştir
router.post('/:id/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mevcut şifre ve yeni şifre zorunludur.' });
    }

    const student = await getStudentById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Öğrenci bulunamadı' });
    }

    if (student.password !== currentPassword) {
      return res.status(401).json({ error: 'Mevcut şifre hatalı.' });
    }

    await changeStudentPassword(req.params.id, newPassword);
    res.json({ message: 'Şifre başarıyla değiştirildi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Öğrencinin etkinlik katılımlarını getir
router.get('/:id/activities', async (req, res) => {
  try {
    const student = await getStudentById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Öğrenci bulunamadı' });
    }

    const registrations = await getStudentRegistrations(req.params.id);
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rozet durumunu getir
router.get('/:id/badges', async (req, res) => {
  try {
    const badgeStatus = await checkAndAssignBadges(req.params.id);
    res.json(badgeStatus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Üniversite başvurusu için rapor
router.get('/:id/report', async (req, res) => {
  try {
    const report = await generateStudentReport(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Öğrenci bulunamadı.' });
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
