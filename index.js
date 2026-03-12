require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { port } = require('./config/config');
const { setupSwagger } = require('./config/swagger');
const { mountRoutes } = require('./routes');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded images as public static files at /uploads/*
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

setupSwagger(app, port);
mountRoutes(app);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
