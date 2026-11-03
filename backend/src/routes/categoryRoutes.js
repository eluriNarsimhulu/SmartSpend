const router = require('express').Router();
const authenticate = require('../middleware/auth');
const c = require('../controllers/categoryController');

router.use(authenticate);

router.get('/', c.list);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;
