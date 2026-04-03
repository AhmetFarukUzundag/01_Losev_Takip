const express = require('express');
const cors = require('cors');
const config = require('./config');
const apiRouter = require('./routes/router');
const { seedTestData } = require('./data');

const app = express();
const PORT = config.port;

const path = require('path');

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../../frontend')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'LÖSEV İnci Gönüllülük API is running' });
});

app.use('/api', apiRouter);

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
  // Test verilerini yükle
  await seedTestData();
});
