require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

setupSwagger(app, port);
mountRoutes(app);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
