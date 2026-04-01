const express = require('express');
const { getAllPendingRegistrations, updateRegistrationStatus } = require('../data');

const router = express.Router();

// Bekleyen katılım kayıtları (Yoklama için)
router.get('/pending', async (req, res) => {
  try {
    const { teacherName, schoolName } = req.query;
    let pending = await getAllPendingRegistrations();

    if (teacherName) {
      pending = pending.filter(p =>
        p.coordinatorTeacherName && p.coordinatorTeacherName.toLowerCase().includes(String(teacherName).toLowerCase())
      );
    }

    if (schoolName) {
      pending = pending.filter(p =>
        p.schoolName && p.schoolName.toLowerCase().includes(String(schoolName).toLowerCase())
      );
    }

    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Katılım durumunu güncelle (Yoklama onay/red)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, note, approvedBy, approvedByRole } = req.body || {};
    const updated = await updateRegistrationStatus(req.params.id, status, approvedBy, approvedByRole);
    if (!updated) {
      return res.status(400).json({ error: 'Geçersiz istek veya kayıt bulunamadı.' });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
