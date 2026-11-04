
const router = require('express').Router();
const authenticate = require('../middleware/auth');
const c = require('../controllers/transactionController');
const voiceController = require('../controllers/voiceTransactionController');

router.use(authenticate);

// Voice extraction only suggests transaction fields. It never saves a transaction.
router.post('/extract-voice', voiceController.extract);

// Existing transaction routes
router.get('/', c.list);
router.get('/export', c.exportCsv);
router.get('/:id', c.getOne);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;
