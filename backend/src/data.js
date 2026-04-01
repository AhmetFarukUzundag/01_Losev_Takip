const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

/* =====================================================================
   DATABASE SCHEMA
   ===================================================================== */
db.serialize(() => {
  // Öğrenciler
  db.run(`CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    firstName TEXT,
    lastName TEXT,
    nationalId TEXT,
    schoolName TEXT,
    city TEXT,
    district TEXT,
    grade TEXT,
    phone TEXT,
    email TEXT,
    password TEXT,
    coordinatorTeacherName TEXT,
    targetHours INTEGER DEFAULT 30,
    parentConsent BOOLEAN DEFAULT 0,
    parentPhone TEXT,
    approved INTEGER DEFAULT 0,
    createdAt TEXT,
    updatedAt TEXT
  )`);

  // Migration columns
  db.run(`ALTER TABLE students ADD COLUMN password TEXT`, (err) => { });
  db.run(`ALTER TABLE students ADD COLUMN parentConsent BOOLEAN DEFAULT 0`, (err) => { });
  db.run(`ALTER TABLE students ADD COLUMN parentPhone TEXT`, (err) => { });
  db.run(`ALTER TABLE students ADD COLUMN approved INTEGER DEFAULT 0`, (err) => { });

  // Öğretmenler
  db.run(`CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    firstName TEXT,
    lastName TEXT,
    email TEXT UNIQUE,
    password TEXT,
    schoolName TEXT,
    role TEXT DEFAULT 'teacher',
    approved INTEGER DEFAULT 0,
    createdAt TEXT,
    updatedAt TEXT
  )`);

  db.run(`ALTER TABLE teachers ADD COLUMN role TEXT DEFAULT 'teacher'`, (err) => { });
  db.run(`ALTER TABLE teachers ADD COLUMN approved INTEGER DEFAULT 0`, (err) => { });

  // Genel Merkez Admin
  db.run(`CREATE TABLE IF NOT EXISTS head_office_admins (
    id TEXT PRIMARY KEY,
    firstName TEXT,
    lastName TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'admin',
    createdAt TEXT,
    updatedAt TEXT
  )`);

  // Etkinlikler (Yalnızca Admin/Öğretmen oluşturabilir)
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT,
    hours REAL DEFAULT 0,
    description TEXT,
    location TEXT,
    createdBy TEXT,
    createdByRole TEXT,
    status TEXT DEFAULT 'active',
    createdAt TEXT,
    updatedAt TEXT
  )`);

  // Etkinlik Katılım Kayıtları (Yoklama)
  db.run(`CREATE TABLE IF NOT EXISTS event_registrations (
    id TEXT PRIMARY KEY,
    eventId TEXT,
    studentId TEXT,
    status TEXT DEFAULT 'pending',
    approvedBy TEXT,
    approvedByRole TEXT,
    approvedAt TEXT,
    createdAt TEXT,
    FOREIGN KEY(eventId) REFERENCES events(id),
    FOREIGN KEY(studentId) REFERENCES students(id)
  )`);

  // Duyurular (Tek yönlü duyuru panosu)
  db.run(`CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    createdBy TEXT,
    createdByRole TEXT,
    createdAt TEXT
  )`);
});

/* =====================================================================
   UTILITY HELPERS
   ===================================================================== */
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/* =====================================================================
   STUDENT CRUD
   ===================================================================== */
async function createStudent(payload) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const targetHours = payload.targetHours || 30;
  const approved = payload.approved !== undefined ? payload.approved : 0;

  const sql = `INSERT INTO students (id, firstName, lastName, nationalId, schoolName, city, district, grade, phone, email, password, coordinatorTeacherName, targetHours, approved, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  await runAsync(sql, [
    id, payload.firstName, payload.lastName, payload.nationalId || null,
    payload.schoolName, payload.city, payload.district, payload.grade,
    payload.phone, payload.email, payload.password, payload.coordinatorTeacherName, targetHours,
    approved, now, now
  ]);

  const student = await getStudentById(id);
  delete student.password;
  return student;
}

async function loginStudent(email, password) {
  const student = await getAsync(`SELECT * FROM students WHERE email = ? AND password = ?`, [email, password]);
  if (!student) return null;
  if (!student.approved) return { pendingApproval: true };
  delete student.password;
  return student;
}

async function listStudents() {
  return allAsync(`SELECT * FROM students`);
}

async function getStudentById(id) {
  return getAsync(`SELECT * FROM students WHERE id = ?`, [id]);
}

async function approveStudent(studentId) {
  const now = new Date().toISOString();
  await runAsync(`UPDATE students SET approved = 1, updatedAt = ? WHERE id = ?`, [now, studentId]);
  return getStudentById(studentId);
}

async function rejectStudent(studentId) {
  const now = new Date().toISOString();
  await runAsync(`UPDATE students SET approved = 0, updatedAt = ? WHERE id = ?`, [now, studentId]);
  return getStudentById(studentId);
}

async function listPendingStudents() {
  return allAsync(`SELECT id, firstName, lastName, email, schoolName, city, grade, coordinatorTeacherName, createdAt FROM students WHERE approved = 0`);
}

async function updateStudentProfile(studentId, payload) {
  const now = new Date().toISOString();
  const allowedFields = ['firstName', 'lastName', 'phone', 'email', 'schoolName', 'city', 'district', 'grade', 'coordinatorTeacherName', 'parentPhone', 'parentConsent'];
  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(payload[field]);
    }
  }

  if (updates.length === 0) return null;

  values.push(now, studentId);
  const sql = `UPDATE students SET ${updates.join(', ')}, updatedAt = ? WHERE id = ?`;
  await runAsync(sql, values);
  return getStudentById(studentId);
}

async function changeStudentPassword(studentId, newPassword) {
  const now = new Date().toISOString();
  await runAsync(`UPDATE students SET password = ?, updatedAt = ? WHERE id = ?`, [newPassword, now, studentId]);
  return true;
}

/* =====================================================================
   TEACHER CRUD
   ===================================================================== */
async function createTeacher(payload) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const approved = payload.approved !== undefined ? payload.approved : 0;

  const sql = `INSERT INTO teachers (id, firstName, lastName, email, password, schoolName, approved, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  await runAsync(sql, [
    id, payload.firstName, payload.lastName, payload.email, payload.password, payload.schoolName, approved, now, now
  ]);

  const teacher = await getAsync(`SELECT * FROM teachers WHERE id = ?`, [id]);
  delete teacher.password;
  return teacher;
}

async function loginTeacher(email, password) {
  const teacher = await getAsync(`SELECT * FROM teachers WHERE email = ? AND password = ?`, [email, password]);
  if (!teacher) return null;
  if (!teacher.approved) return { pendingApproval: true };
  delete teacher.password;
  return teacher;
}

async function listTeachers() {
  const teachers = await allAsync(`SELECT * FROM teachers`);
  return teachers.map(t => { delete t.password; return t; });
}

async function approveTeacher(teacherId) {
  const now = new Date().toISOString();
  await runAsync(`UPDATE teachers SET approved = 1, updatedAt = ? WHERE id = ?`, [now, teacherId]);
  return getAsync(`SELECT * FROM teachers WHERE id = ?`, [teacherId]);
}

async function rejectTeacher(teacherId) {
  const now = new Date().toISOString();
  await runAsync(`UPDATE teachers SET approved = 0, updatedAt = ? WHERE id = ?`, [now, teacherId]);
  return getAsync(`SELECT * FROM teachers WHERE id = ?`, [teacherId]);
}

async function listPendingTeachers() {
  return allAsync(`SELECT id, firstName, lastName, email, schoolName, createdAt FROM teachers WHERE approved = 0`);
}

/* =====================================================================
   HEAD OFFICE ADMIN CRUD
   ===================================================================== */
async function createHeadOfficeAdmin(payload) {
  const id = uuidv4();
  const now = new Date().toISOString();

  const sql = `INSERT INTO head_office_admins (id, firstName, lastName, email, password, role, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  await runAsync(sql, [
    id, payload.firstName, payload.lastName, payload.email,
    payload.password, payload.role || 'admin', now, now
  ]);

  const admin = await getAsync(`SELECT * FROM head_office_admins WHERE id = ?`, [id]);
  delete admin.password;
  return admin;
}

async function loginHeadOfficeAdmin(email, password) {
  const admin = await getAsync(`SELECT * FROM head_office_admins WHERE email = ? AND password = ?`, [email, password]);
  if (admin) delete admin.password;
  return admin;
}

async function listHeadOfficeAdmins() {
  const admins = await allAsync(`SELECT * FROM head_office_admins`);
  return admins.map(a => { delete a.password; return a; });
}

/* =====================================================================
   EVENT CRUD (Yalnızca Admin/Öğretmen)
   ===================================================================== */
async function createEvent(payload) {
  const id = uuidv4();
  const now = new Date().toISOString();

  const sql = `INSERT INTO events (id, title, date, type, hours, description, location, createdBy, createdByRole, status, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  await runAsync(sql, [
    id, payload.title, payload.date, payload.type, payload.hours || 0,
    payload.description || '', payload.location || '', payload.createdBy || null,
    payload.createdByRole || null, 'active', now, now
  ]);

  return getAsync(`SELECT * FROM events WHERE id = ?`, [id]);
}

async function listEvents() {
  return allAsync(`SELECT * FROM events ORDER BY date DESC`);
}

async function listUpcomingEvents() {
  const now = new Date().toISOString().split('T')[0];
  return allAsync(`SELECT * FROM events WHERE date >= ? AND status = 'active' ORDER BY date ASC`, [now]);
}

async function listPastEvents() {
  const now = new Date().toISOString().split('T')[0];
  return allAsync(`SELECT * FROM events WHERE date < ? ORDER BY date DESC`, [now]);
}

async function getEventById(id) {
  return getAsync(`SELECT * FROM events WHERE id = ?`, [id]);
}

async function updateEvent(id, payload) {
  const now = new Date().toISOString();
  const allowedFields = ['title', 'date', 'type', 'hours', 'description', 'location', 'status'];
  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(payload[field]);
    }
  }

  if (updates.length === 0) return null;
  values.push(now, id);

  await runAsync(`UPDATE events SET ${updates.join(', ')}, updatedAt = ? WHERE id = ?`, values);
  return getAsync(`SELECT * FROM events WHERE id = ?`, [id]);
}

async function deleteEvent(id) {
  await runAsync(`DELETE FROM event_registrations WHERE eventId = ?`, [id]);
  return runAsync(`DELETE FROM events WHERE id = ?`, [id]);
}

/* =====================================================================
   EVENT REGISTRATION / YOKLAMA
   ===================================================================== */
async function registerForEvent(eventId, studentId) {
  // Zaten kayıtlı mı kontrol
  const existing = await getAsync(
    `SELECT * FROM event_registrations WHERE eventId = ? AND studentId = ?`,
    [eventId, studentId]
  );
  if (existing) return existing;

  const id = uuidv4();
  const now = new Date().toISOString();

  await runAsync(
    `INSERT INTO event_registrations (id, eventId, studentId, status, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [id, eventId, studentId, 'pending', now]
  );

  return getAsync(`SELECT * FROM event_registrations WHERE id = ?`, [id]);
}

async function getEventRegistrations(eventId) {
  const sql = `
    SELECT er.*, s.firstName, s.lastName, s.schoolName, s.email
    FROM event_registrations er
    JOIN students s ON er.studentId = s.id
    WHERE er.eventId = ?
    ORDER BY er.createdAt DESC
  `;
  return allAsync(sql, [eventId]);
}

async function getStudentRegistrations(studentId) {
  const sql = `
    SELECT er.id, er.status, er.createdAt as registeredAt,
           e.id as eventId, e.title, e.date, e.type, e.hours, e.description, e.location
    FROM event_registrations er
    JOIN events e ON er.eventId = e.id
    WHERE er.studentId = ?
    ORDER BY e.date DESC
  `;
  return allAsync(sql, [studentId]);
}

async function getAllPendingRegistrations() {
  const sql = `
    SELECT er.*, 
           s.firstName as studentFirstName, s.lastName as studentLastName, s.schoolName, s.coordinatorTeacherName,
           e.title as eventTitle, e.date as eventDate, e.type as eventType, e.hours as eventHours
    FROM event_registrations er
    JOIN students s ON er.studentId = s.id
    JOIN events e ON er.eventId = e.id
    WHERE er.status = 'pending'
    ORDER BY e.date DESC
  `;
  return allAsync(sql);
}

async function updateRegistrationStatus(registrationId, status, approvedBy, approvedByRole) {
  const allowed = ['pending', 'approved', 'rejected'];
  if (!allowed.includes(status)) return null;

  const reg = await getAsync(`SELECT * FROM event_registrations WHERE id = ?`, [registrationId]);
  if (!reg) return null;

  const now = new Date().toISOString();
  await runAsync(
    `UPDATE event_registrations SET status = ?, approvedBy = ?, approvedByRole = ?, approvedAt = ? WHERE id = ?`,
    [status, approvedBy || null, approvedByRole || null, now, registrationId]
  );

  return getAsync(`SELECT * FROM event_registrations WHERE id = ?`, [registrationId]);
}

/* =====================================================================
   ANNOUNCEMENTS (Tek yönlü duyuru panosu)
   ===================================================================== */
async function createAnnouncement(payload) {
  const id = uuidv4();
  const now = new Date().toISOString();

  await runAsync(
    `INSERT INTO announcements (id, title, content, createdBy, createdByRole, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, payload.title, payload.content || '', payload.createdBy || null, payload.createdByRole || null, now]
  );

  return getAsync(`SELECT * FROM announcements WHERE id = ?`, [id]);
}

async function listAnnouncements() {
  return allAsync(`SELECT * FROM announcements ORDER BY createdAt DESC`);
}

/* =====================================================================
   SAAT HESAPLAMA & ROZETLER
   ===================================================================== */
async function computeSummary(studentId) {
  const rows = await allAsync(`
    SELECT e.hours, e.date
    FROM event_registrations er
    JOIN events e ON er.eventId = e.id
    WHERE er.studentId = ? AND er.status = 'approved'
  `, [studentId]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let total = 0, yearly = 0, monthly = 0;

  for (const row of rows) {
    const h = Number(row.hours) || 0;
    total += h;
    const d = new Date(row.date);
    if (d.getFullYear() === currentYear) {
      yearly += h;
      if (d.getMonth() === currentMonth) {
        monthly += h;
      }
    }
  }

  return { total, yearly, monthly };
}

function calculateBadge(totalHours) {
  if (totalHours >= 200) return { code: 'platin', label: 'Platin İnci Lideri' };
  if (totalHours >= 100) return { code: 'altin', label: 'Altın İnci' };
  if (totalHours >= 50) return { code: 'gumus', label: 'Gümüş İnci' };
  if (totalHours >= 25) return { code: 'bronz', label: 'Bronz İnci' };
  return { code: 'none', label: 'Henüz rozet yok' };
}

function getNextBadge(totalHours) {
  if (totalHours >= 200) return null;
  if (totalHours >= 100) return { code: 'platin', label: 'Platin İnci Lideri', requiredHours: 200 };
  if (totalHours >= 50) return { code: 'altin', label: 'Altın İnci', requiredHours: 100 };
  if (totalHours >= 25) return { code: 'gumus', label: 'Gümüş İnci', requiredHours: 50 };
  return { code: 'bronz', label: 'Bronz İnci', requiredHours: 25 };
}

async function checkAndAssignBadges(studentId) {
  const summary = await computeSummary(studentId);
  const badge = calculateBadge(summary.total);

  return {
    studentId,
    currentBadge: badge,
    totalHours: summary.total,
    nextBadge: getNextBadge(summary.total)
  };
}

/* =====================================================================
   RAPORLAMA
   ===================================================================== */
async function aggregateBySchool() {
  const sql = `
    SELECT
      s.schoolName,
      COUNT(DISTINCT s.id) as studentCount,
      COALESCE(SUM(CASE WHEN er.status = 'approved' THEN e.hours ELSE 0 END), 0) as totalHours
    FROM students s
    LEFT JOIN event_registrations er ON s.id = er.studentId
    LEFT JOIN events e ON er.eventId = e.id
    WHERE s.schoolName IS NOT NULL AND s.schoolName != ''
    GROUP BY s.schoolName
  `;
  const rows = await allAsync(sql);
  return rows.map(r => ({
    schoolName: r.schoolName,
    totalHours: Number(r.totalHours) || 0,
    studentCount: r.studentCount
  }));
}

async function computeTopStudents(limit = 10) {
  const sql = `
    SELECT
      s.id,
      s.firstName || ' ' || s.lastName as name,
      s.schoolName,
      COALESCE(SUM(e.hours), 0) as totalHours
    FROM students s
    JOIN event_registrations er ON s.id = er.studentId
    JOIN events e ON er.eventId = e.id
    WHERE er.status = 'approved'
    GROUP BY s.id
    ORDER BY totalHours DESC
    LIMIT ?
  `;
  const rows = await allAsync(sql, [limit]);
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    schoolName: r.schoolName,
    totalHours: Number(r.totalHours) || 0
  }));
}

async function computeTopSchools(limit = 10) {
  const aggregation = await aggregateBySchool();
  return aggregation
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, limit);
}

async function getStatisticsByCity() {
  const sql = `
    SELECT
      s.city,
      COUNT(DISTINCT s.id) as studentCount,
      COUNT(DISTINCT CASE WHEN er.status = 'approved' THEN er.id END) as activityCount,
      COALESCE(SUM(CASE WHEN er.status = 'approved' THEN e.hours ELSE 0 END), 0) as totalHours
    FROM students s
    LEFT JOIN event_registrations er ON s.id = er.studentId
    LEFT JOIN events e ON er.eventId = e.id
    WHERE s.city IS NOT NULL AND s.city != ''
    GROUP BY s.city
    ORDER BY totalHours DESC
  `;
  return allAsync(sql);
}

async function getActivityTypeStats() {
  const sql = `
    SELECT
      e.type,
      COUNT(*) as count,
      COALESCE(SUM(e.hours), 0) as totalHours
    FROM events e
    GROUP BY e.type
    ORDER BY count DESC
  `;
  return allAsync(sql);
}

async function getMonthlyStats(year = new Date().getFullYear()) {
  const sql = `
    SELECT
      strftime('%m', e.date) as month,
      COUNT(DISTINCT e.id) as activityCount,
      COALESCE(SUM(CASE WHEN er.status = 'approved' THEN e.hours ELSE 0 END), 0) as totalHours
    FROM events e
    LEFT JOIN event_registrations er ON e.id = er.eventId
    WHERE strftime('%Y', e.date) = ?
    GROUP BY month
    ORDER BY month
  `;
  return allAsync(sql, [String(year)]);
}

async function getOverallStatistics() {
  const stats = await getAsync(`
    SELECT
      (SELECT COUNT(*) FROM students WHERE approved = 1) as totalStudents,
      (SELECT COUNT(*) FROM teachers WHERE approved = 1) as totalTeachers,
      (SELECT COUNT(*) FROM events) as totalActivities,
      (SELECT COUNT(*) FROM event_registrations WHERE status = 'approved') as approvedActivities,
      (SELECT COUNT(*) FROM event_registrations WHERE status = 'pending') as pendingActivities,
      (SELECT COALESCE(SUM(e.hours), 0) FROM event_registrations er JOIN events e ON er.eventId = e.id WHERE er.status = 'approved') as totalVolunteerHours,
      (SELECT COUNT(DISTINCT schoolName) FROM students WHERE schoolName IS NOT NULL AND schoolName != '') as totalSchools,
      (SELECT COUNT(DISTINCT city) FROM students WHERE city IS NOT NULL AND city != '') as totalCities
  `);

  return {
    totalStudents: stats.totalStudents || 0,
    totalTeachers: stats.totalTeachers || 0,
    totalActivities: stats.totalActivities || 0,
    approvedActivities: stats.approvedActivities || 0,
    pendingActivities: stats.pendingActivities || 0,
    totalVolunteerHours: stats.totalVolunteerHours || 0,
    totalSchools: stats.totalSchools || 0,
    totalCities: stats.totalCities || 0
  };
}

async function generateStudentReport(studentId) {
  const student = await getStudentById(studentId);
  if (!student) return null;
  delete student.password;

  const summary = await computeSummary(studentId);
  const badge = calculateBadge(summary.total);
  const registrations = await getStudentRegistrations(studentId);
  const approvedRegs = registrations.filter(r => r.status === 'approved');

  return {
    student,
    summary,
    badge,
    activities: approvedRegs,
    activityCount: approvedRegs.length,
    generatedAt: new Date().toISOString(),
    documentType: 'LÖSEV İnci Gönüllülük Raporu'
  };
}

/* =====================================================================
   SEED DATA
   ===================================================================== */
async function seedTestData() {
  try {
    // Admin yoksa oluştur
    const existingAdmin = await getAsync(`SELECT * FROM head_office_admins LIMIT 1`);
    if (existingAdmin) {
      console.log('ℹ️  Veritabanında zaten veri var, seed atlanıyor.');
      return;
    }

    // 1 Yönetici (Admin)
    const admin = await createHeadOfficeAdmin({
      firstName: 'Yönetici',
      lastName: 'Admin',
      email: 'admin@losev.org',
      password: 'admin123',
      role: 'admin'
    });
    console.log('✅ Yönetici oluşturuldu: admin@losev.org / admin123');

    // 1 Öğretmen (onaylı)
    const teacher = await createTeacher({
      firstName: 'Ayşe',
      lastName: 'Kaya',
      email: 'ogretmen@losev.org',
      password: 'ogretmen123',
      schoolName: 'Ankara İnci Lisesi',
      approved: 1
    });
    console.log('✅ Öğretmen oluşturuldu: ogretmen@losev.org / ogretmen123');

    // 3 Öğrenci (onaylı)
    const student1 = await createStudent({
      firstName: 'Ahmet',
      lastName: 'Yılmaz',
      email: 'ahmet@test.com',
      password: '123456',
      schoolName: 'Ankara İnci Lisesi',
      city: 'Ankara',
      district: 'Çankaya',
      grade: '11',
      phone: '05551234567',
      coordinatorTeacherName: 'Ayşe Kaya',
      targetHours: 30,
      approved: 1
    });
    console.log('✅ Öğrenci 1 oluşturuldu: ahmet@test.com / 123456');

    const student2 = await createStudent({
      firstName: 'Elif',
      lastName: 'Demir',
      email: 'elif@test.com',
      password: '123456',
      schoolName: 'Ankara İnci Lisesi',
      city: 'Ankara',
      district: 'Keçiören',
      grade: '10',
      phone: '05559876543',
      coordinatorTeacherName: 'Ayşe Kaya',
      targetHours: 30,
      approved: 1
    });
    console.log('✅ Öğrenci 2 oluşturuldu: elif@test.com / 123456');

    const student3 = await createStudent({
      firstName: 'Can',
      lastName: 'Özdemir',
      email: 'can@test.com',
      password: '123456',
      schoolName: 'Ankara İnci Lisesi',
      city: 'Ankara',
      district: 'Yenimahalle',
      grade: '12',
      phone: '05554567890',
      coordinatorTeacherName: 'Ayşe Kaya',
      targetHours: 30,
      approved: 1
    });
    console.log('✅ Öğrenci 3 oluşturuldu: can@test.com / 123456');

    // 2 Geçmiş Etkinlik
    const event1 = await createEvent({
      title: 'LÖSEV Farkındalık Semineri',
      date: '2026-02-15',
      type: 'Seminer',
      hours: 3,
      description: 'Lösemi hastalığı hakkında toplumu bilinçlendirme semineri.',
      location: 'Ankara İnci Lisesi Konferans Salonu',
      createdBy: teacher.id,
      createdByRole: 'teacher'
    });

    const event2 = await createEvent({
      title: 'LÖSEV Yararına Kermes',
      date: '2026-03-10',
      type: 'Kermes',
      hours: 5,
      description: 'LÖSEV yararına düzenlenen kermes ile bağış toplama etkinliği.',
      location: 'Ankara İnci Lisesi Bahçesi',
      createdBy: teacher.id,
      createdByRole: 'teacher'
    });

    // 1 Yaklaşan Etkinlik
    const event3 = await createEvent({
      title: 'Kamuoyu Bilinçlendirme Kampanyası',
      date: '2026-04-20',
      type: 'Kamuoyu bilinçlendirme',
      hours: 4,
      description: 'Toplumu lösemili çocuklar hakkında bilinçlendirme kampanyası.',
      location: 'Ankara Kızılay Meydanı',
      createdBy: teacher.id,
      createdByRole: 'teacher'
    });

    console.log('✅ 3 etkinlik oluşturuldu (2 geçmiş, 1 yaklaşan)');

    // Geçmiş etkinliklere katılım kayıtları (onaylı)
    for (const st of [student1, student2, student3]) {
      await registerForEvent(event1.id, st.id);
      await updateRegistrationStatus(
        (await getAsync(`SELECT id FROM event_registrations WHERE eventId = ? AND studentId = ?`, [event1.id, st.id])).id,
        'approved', teacher.id, 'teacher'
      );
    }

    for (const st of [student1, student2]) {
      await registerForEvent(event2.id, st.id);
      await updateRegistrationStatus(
        (await getAsync(`SELECT id FROM event_registrations WHERE eventId = ? AND studentId = ?`, [event2.id, st.id])).id,
        'approved', teacher.id, 'teacher'
      );
    }

    // Yaklaşan etkinliğe bekleyen kayıtlar
    await registerForEvent(event3.id, student1.id);
    await registerForEvent(event3.id, student3.id);

    console.log('✅ Katılım kayıtları oluşturuldu');

    // Örnek duyuru
    await createAnnouncement({
      title: 'Gönüllülük Programı Başladı!',
      content: 'LÖSEV İnci Gönüllülük Programı 2026 yılı için başlamıştır. 30 saatlik gönüllülük hedefimize birlikte ulaşalım!',
      createdBy: admin.id,
      createdByRole: 'admin'
    });

    console.log('✅ Örnek duyuru oluşturuldu');
    console.log('✅ Tüm seed verileri başarıyla yüklendi!');

  } catch (error) {
    console.error('❌ Seed verileri yüklenirken hata:', error);
  }
}

/* =====================================================================
   EXPORTS
   ===================================================================== */
module.exports = {
  // Student
  createStudent,
  loginStudent,
  listStudents,
  getStudentById,
  updateStudentProfile,
  changeStudentPassword,
  approveStudent,
  rejectStudent,
  listPendingStudents,
  // Teacher
  createTeacher,
  loginTeacher,
  listTeachers,
  approveTeacher,
  rejectTeacher,
  listPendingTeachers,
  // Admin
  createHeadOfficeAdmin,
  loginHeadOfficeAdmin,
  listHeadOfficeAdmins,
  // Events
  createEvent,
  listEvents,
  listUpcomingEvents,
  listPastEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  // Registrations
  registerForEvent,
  getEventRegistrations,
  getStudentRegistrations,
  getAllPendingRegistrations,
  updateRegistrationStatus,
  // Announcements
  createAnnouncement,
  listAnnouncements,
  // Computation
  computeSummary,
  calculateBadge,
  checkAndAssignBadges,
  // Reports
  aggregateBySchool,
  computeTopStudents,
  computeTopSchools,
  getStatisticsByCity,
  getActivityTypeStats,
  getMonthlyStats,
  getOverallStatistics,
  generateStudentReport,
  // Seed
  seedTestData,
};
