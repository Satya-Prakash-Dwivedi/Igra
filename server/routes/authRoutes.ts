import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// POST /api/v1/auth/register
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', authenticate, authController.getProfile);
router.get('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.patch('/profile', authenticate, authController.updateProfile);
router.post('/verify-email', authController.verifyEmail);


export default router;