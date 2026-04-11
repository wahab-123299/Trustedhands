const express = require('express');
const router = express.Router();
const { userController } = require('../controllers');
const { authenticate } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');

// Protected routes
router.get('/me', authenticate, userController.getMe);
router.put('/me', authenticate, userController.updateMe);
router.put('/location', authenticate, userController.updateLocation);
router.put('/profile-image', authenticate, uploadSingle('image'), userController.updateProfileImage);
router.delete('/me', authenticate, userController.deleteMe);

// Public profile
router.get('/:id', userController.getUserById);

module.exports = router;
