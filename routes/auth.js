const { Router } = require('express');
const { register, login, userinfo } = require('../controllers/auth');

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/userinfo', userinfo);

module.exports = router;
