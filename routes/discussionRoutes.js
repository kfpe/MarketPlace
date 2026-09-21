const express = require('express');
const router = express.Router();
const discussionController = require('../controllers/discussionController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', discussionController.getDiscussions);
router.get('/unread-count', discussionController.getUnreadCount);
router.post('/', discussionController.createOrGetDiscussion);
router.get('/:id/messages', discussionController.getMessages);
router.post('/:id/messages', discussionController.sendMessage);

module.exports = router;
