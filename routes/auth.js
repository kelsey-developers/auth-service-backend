const { Router } = require('express');
const { login, userinfo } = require('../controllers/auth');

const router = Router();

router.post('/login', login);
router.get('/userinfo', userinfo);

module.exports = router;
