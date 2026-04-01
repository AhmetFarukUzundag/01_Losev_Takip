const express = require('express');
const { createAnnouncement, listAnnouncements } = require('../data');

const router = express.Router();

// Duyuruları listele (herkes görebilir)
router.get('/', async (req, res) => {
    try {
        const announcements = await listAnnouncements();
        res.json(announcements);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Yeni duyuru oluştur (Yalnızca Admin/Öğretmen)
router.post('/', async (req, res) => {
    try {
        const body = req.body || {};
        if (!body.title) {
            return res.status(400).json({ error: 'Duyuru başlığı zorunludur.' });
        }

        const announcement = await createAnnouncement(body);
        res.status(201).json(announcement);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
