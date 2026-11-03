// backend/src/routes/aiChatRoutes.js
const express = require('express');
const authenticate = require('../middleware/auth');
const ctrl = require('../controllers/aiChatController');

const router = express.Router();

// All AI routes require authentication.
router.use(authenticate);

router.post  ('/',           ctrl.createConversation);
router.get   ('/',           ctrl.listConversations);
router.get   ('/:id',        ctrl.getConversation);
router.patch ('/:id',        ctrl.renameConversation);
router.delete('/:id',        ctrl.deleteConversation);
router.post  ('/:id/messages', ctrl.sendMessage);

module.exports = router;

