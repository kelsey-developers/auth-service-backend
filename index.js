const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const { setupSwagger } = require('./config/swagger');
const { mountRoutes } = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kelseydb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

setupSwagger(app, PORT);
mountRoutes(app, { pool, jwtSecret: JWT_SECRET });

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
