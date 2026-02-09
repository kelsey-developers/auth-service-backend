const express = require('express');
const AuthController = require('../controllers/AuthController');

function createAuthRouter(pool, jwtSecret) {
  const router = express.Router();
  const authController = new AuthController(pool, jwtSecret);

  router.get('/login', (req, res) => authController.login(req, res));
  router.get('/userinfo', (req, res) => authController.userinfo(req, res));

  return router;
}

module.exports = { createAuthRouter };
