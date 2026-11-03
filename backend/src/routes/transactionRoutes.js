const router = require('express').Router();
const authenticate = require('../middleware/auth');
const c = require('../controllers/transactionController');

router.use(authenticate); // every transaction route requires a valid JWT

router.get('/', c.list);
router.get('/export', c.exportCsv); // must be declared before '/:id'
router.get('/:id', c.getOne);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;
