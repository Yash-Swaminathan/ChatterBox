const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const { requireAuth } = require('../middleware/auth');


router.post('/register', validateRegistration, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/logout', requireAuth, authController.logout);
router.post('/refresh', authController.refreshToken);
router.get('/me', requireAuth, authController.getCurrentUser);

module.exports = router;