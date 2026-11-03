const router = require('express').Router();
const authenticate = require('../middleware/auth');
const c = require('../controllers/dashboardController');

router.use(authenticate);

router.get('/summary', c.summary);
router.get('/category-breakdown', c.categoryBreakdown);
router.get('/trend', c.trend);
router.get('/month-comparison', c.monthComparison);
router.get('/top-expenses', c.topExpenses);

module.exports = router;
