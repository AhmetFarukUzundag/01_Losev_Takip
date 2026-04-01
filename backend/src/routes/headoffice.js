const express = require('express');
const {
  createHeadOfficeAdmin,
  loginHeadOfficeAdmin,
  listHeadOfficeAdmins,
  listStudents,
  listTeachers,
  listEvents,
  getStudentById,
  getEventRegistrations,
  updateRegistrationStatus,
  approveStudent,
  rejectStudent,
  approveTeacher,
  rejectTeacher,
  listPendingStudents,
  listPendingTeachers,
  getAllPendingRegistrations,
} = require('../data');

const router = express.Router();

// Genel Merkez Admin kayıt
router.post('/register', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.firstName || !body.lastName || !body.email || !body.password) {
      return res.status(400).json({ error: 'firstName, lastName, email ve password zorunludur.' });
    }

    const admin = await createHeadOfficeAdmin(body);
    res.status(201).json(admin);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Genel Merkez Admin giriş
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email ve password zorunludur.' });
    }

    const admin = await loginHeadOfficeAdmin(email, password);
    if (!admin) {
      return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
    }

    res.json({ user: admin, role: 'headoffice' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tüm adminleri listele
router.get('/admins', async (req, res) => {
  try {
    const admins = await listHeadOfficeAdmins();
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tüm öğrencileri listele
router.get('/students', async (req, res) => {
  try {
    const students = await listStudents();
    const safeStudents = students.map(s => {
      delete s.password;
      return s;
    });
    res.json(safeStudents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tüm öğretmenleri listele
router.get('/teachers', async (req, res) => {
  try {
    const teachers = await listTeachers();
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Onay bekleyen öğrenciler
router.get('/pending-students', async (req, res) => {
  try {
    const pending = await listPendingStudents();
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Onay bekleyen öğretmenler (YALNIZCA Admin onayı)
router.get('/pending-teachers', async (req, res) => {
  try {
    const pending = await listPendingTeachers();
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Öğrenci onayla
router.patch('/students/:id/approve', async (req, res) => {
  try {
    const student = await approveStudent(req.params.id);
    if (!student) return res.status(404).json({ error: 'Öğrenci bulunamadı.' });
    delete student.password;
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Öğrenci reddet
router.patch('/students/:id/reject', async (req, res) => {
  try {
    const student = await rejectStudent(req.params.id);
    if (!student) return res.status(404).json({ error: 'Öğrenci bulunamadı.' });
    delete student.password;
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Öğretmen onayla (YALNIZCA Admin)
router.patch('/teachers/:id/approve', async (req, res) => {
  try {
    const teacher = await approveTeacher(req.params.id);
    if (!teacher) return res.status(404).json({ error: 'Öğretmen bulunamadı.' });
    delete teacher.password;
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Öğretmen reddet
router.patch('/teachers/:id/reject', async (req, res) => {
  try {
    const teacher = await rejectTeacher(req.params.id);
    if (!teacher) return res.status(404).json({ error: 'Öğretmen bulunamadı.' });
    delete teacher.password;
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tüm etkinlikleri listele
router.get('/events', async (req, res) => {
  try {
    const events = await listEvents();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bekleyen katılım kayıtları
router.get('/pending-registrations', async (req, res) => {
  try {
    const pending = await getAllPendingRegistrations();
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Katılım onay/red
router.patch('/registrations/:id/status', async (req, res) => {
  try {
    const { status, approvedBy, approvedByRole } = req.body || {};
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
