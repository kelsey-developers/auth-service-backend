const { Router } = require('express');
const { login, userinfo } = require('../controllers/auth');

const router = Router();

router.get('/login', login);
router.get('/userinfo', userinfo);

module.exports = router;
