require('dotenv').config();
const path = require('path');
const cron = require('node-cron');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { port } = require('./config/config');
const { setupSwagger } = require('./config/swagger');
const { mountRoutes } = require('./routes');
const { run: runCompleteBookingsAndCommission } = require('./jobs/completeBookingsAndCommission');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Serve uploaded images as public static files at /uploads/*
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

setupSwagger(app, port);
mountRoutes(app);

app.listen(port, async () => {
  console.log(`Server running on http://localhost:${port}`);
  // Run on startup
  try {
    const result = await runCompleteBookingsAndCommission();
    if (result.completed > 0 || result.commissionsAdded > 0) {
      console.log(`[Cron] completeBookingsAndCommission (startup): ${result.completed} completed, ${result.commissionsAdded} commissions added`);
    }
  } catch (err) {
    console.error('[Cron] completeBookingsAndCommission (startup) error:', err);
  }
});

// Every 24 hours at 1:00 AM PH: complete confirmed bookings past checkout+24h and add 10% commission to agents
cron.schedule('0 1 * * *', async () => {
  try {
    const result = await runCompleteBookingsAndCommission();
    if (result.completed > 0 || result.commissionsAdded > 0) {
      console.log(`[Cron] completeBookingsAndCommission: ${result.completed} completed, ${result.commissionsAdded} commissions added`);
    }
  } catch (err) {
    console.error('[Cron] completeBookingsAndCommission error:', err);
  }
}, { timezone: 'Asia/Manila' });
