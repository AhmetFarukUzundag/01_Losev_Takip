const express = require('express');
const {
    createStudent,
    loginStudent,
    createTeacher,
    loginTeacher
} = require('../data');

const router = express.Router();

router.post('/login', async (req, res) => {
    const { role, email, password } = req.body || {};

    if (!role || !email || !password) {
        return res.status(400).json({ error: 'Role, email, ve password zorunludur.' });
    }

    try {
        if (role === 'student') {
            const student = await loginStudent(email, password);
            if (!student) {
                return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
            }
            if (student.pendingApproval) {
                return res.status(403).json({ error: 'Hesabınız henüz onaylanmamıştır. Lütfen öğretmeniniz veya yöneticiniz ile iletişime geçin.' });
            }
            return res.json({ user: student, role: 'student' });
        } else if (role === 'teacher') {
            const teacher = await loginTeacher(email, password);
            if (!teacher) {
                return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
            }
            if (teacher.pendingApproval) {
                return res.status(403).json({ error: 'Hesabınız henüz yönetici tarafından onaylanmamıştır. Lütfen genel merkez ile iletişime geçin.' });
            }
            return res.json({ user: teacher, role: 'teacher' });
        } else {
            return res.status(400).json({ error: 'Geçersiz role.' });
        }
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Sunucu hatası.' });
    }
});

router.post('/register', async (req, res) => {
    const { role, ...payload } = req.body || {};

    if (!role || !payload.email || !payload.password) {
        return res.status(400).json({ error: 'Role, email ve password zorunludur.' });
    }

    try {
        if (role === 'student') {
            if (!payload.firstName || !payload.lastName || !payload.schoolName) {
                return res.status(400).json({ error: 'Öğrenci için firstName, lastName ve schoolName zorunludur.' });
            }
            // Öğrenci kayıtları onay bekler (approved = 0)
            const student = await createStudent({ ...payload, approved: 0 });
            return res.status(201).json({
                user: student,
                role: 'student',
                pendingApproval: true,
                message: 'Kaydınız alındı. Hesabınız öğretmen veya yönetici onayından sonra aktifleşecektir.'
            });
        } else if (role === 'teacher') {
            if (!payload.firstName || !payload.lastName) {
                return res.status(400).json({ error: 'Öğretmen için firstName ve lastName zorunludur.' });
            }
            // Öğretmen kayıtları YALNIZCA admin onayı bekler (approved = 0)
            const teacher = await createTeacher({ ...payload, approved: 0 });
            return res.status(201).json({
                user: teacher,
                role: 'teacher',
                pendingApproval: true,
                message: 'Kaydınız alındı. Hesabınız yönetici onayından sonra aktifleşecektir.'
            });
        } else {
            return res.status(400).json({ error: 'Geçersiz role.' });
        }
    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({ error: 'Sunucu doğrulama hatası ya da email zaten kayıtlı olabilir.' });
    }
});

module.exports = router;
