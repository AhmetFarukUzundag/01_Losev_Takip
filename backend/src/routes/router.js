const express = require('express');
const authRouter = require('./auth');
const studentsRouter = require('./students');
const activitiesRouter = require('./activities');
const reportsRouter = require('./reports');
const headOfficeRouter = require('./headoffice');
const profileRouter = require('./profile');
const eventsRouter = require('./events');
const announcementsRouter = require('./announcements');

const router = express.Router();

router.use('/auth', authRouter);
router.use('/students', studentsRouter);
router.use('/activities', activitiesRouter);
router.use('/reports', reportsRouter);
router.use('/headoffice', headOfficeRouter);
router.use('/profile', profileRouter);
router.use('/events', eventsRouter);
router.use('/announcements', announcementsRouter);

module.exports = router;
