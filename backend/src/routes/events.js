const express = require('express');
const {
    createEvent,
    listEvents,
    listUpcomingEvents,
    listPastEvents,
    getEventById,
    updateEvent,
    deleteEvent,
    registerForEvent,
    getEventRegistrations,
    getStudentRegistrations,
    getAllPendingRegistrations,
    updateRegistrationStatus,
    getStudentById,
} = require('../data');

const router = express.Router();

// Tüm etkinlikleri listele
router.get('/', async (req, res) => {
    try {
        const events = await listEvents();
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Yaklaşan etkinlikler
router.get('/upcoming', async (req, res) => {
    try {
        const events = await listUpcomingEvents();
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Geçmiş etkinlikler
router.get('/past', async (req, res) => {
    try {
        const events = await listPastEvents();
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Tüm bekleyen katılım kayıtları (Öğretmen/Admin için)
router.get('/pending-registrations', async (req, res) => {
    try {
        const { schoolName } = req.query;
        let pending = await getAllPendingRegistrations();

        if (schoolName) {
            pending = pending.filter(p =>
                p.schoolName && p.schoolName.toLowerCase().includes(schoolName.toLowerCase())
            );
        }

        res.json(pending);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Yeni etkinlik oluştur (Yalnızca Admin/Öğretmen)
router.post('/', async (req, res) => {
    try {
        const body = req.body || {};
        if (!body.title || !body.date) {
            return res.status(400).json({ error: 'Etkinlik başlığı ve tarihi zorunludur.' });
        }

        const event = await createEvent(body);
        res.status(201).json(event);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Etkinlik detayı
router.get('/:id', async (req, res) => {
    try {
        const event = await getEventById(req.params.id);
        if (!event) return res.status(404).json({ error: 'Etkinlik bulunamadı.' });

        const registrations = await getEventRegistrations(req.params.id);
        res.json({ event, registrations });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Etkinlik güncelle
router.patch('/:id', async (req, res) => {
    try {
        const updated = await updateEvent(req.params.id, req.body);
        if (!updated) return res.status(400).json({ error: 'Güncelleme yapılamadı.' });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Etkinlik sil
router.delete('/:id', async (req, res) => {
    try {
        await deleteEvent(req.params.id);
        res.json({ message: 'Etkinlik silindi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Öğrenci etkinliğe katılım başvurusu
router.post('/:id/register', async (req, res) => {
    try {
        const { studentId } = req.body;
        if (!studentId) return res.status(400).json({ error: 'studentId zorunludur.' });

        const event = await getEventById(req.params.id);
        if (!event) return res.status(404).json({ error: 'Etkinlik bulunamadı.' });

        const student = await getStudentById(studentId);
        if (!student) return res.status(404).json({ error: 'Öğrenci bulunamadı.' });

        const registration = await registerForEvent(req.params.id, studentId);
        res.status(201).json(registration);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Etkinlik katılım listesi
router.get('/:id/registrations', async (req, res) => {
    try {
        const registrations = await getEventRegistrations(req.params.id);
        res.json(registrations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Katılım durumunu güncelle (Yoklama - Öğretmen/Admin)
router.patch('/registrations/:regId/status', async (req, res) => {
    try {
        const { status, approvedBy, approvedByRole } = req.body;
        const updated = await updateRegistrationStatus(req.params.regId, status, approvedBy, approvedByRole);
        if (!updated) return res.status(400).json({ error: 'Geçersiz istek.' });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Öğrencinin kendi katılımları
router.get('/student/:studentId/registrations', async (req, res) => {
    try {
        const registrations = await getStudentRegistrations(req.params.studentId);
        res.json(registrations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
