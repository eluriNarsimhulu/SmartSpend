const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const authenticate = require('../middleware/auth');
const { register, login, me } = require('../controllers/authController');

// Slow down password guessing / signup abuse.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', authenticate, me);

module.exports = router;
