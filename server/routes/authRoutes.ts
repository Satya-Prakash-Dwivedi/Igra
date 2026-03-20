import { Router } from "express";
import * as authController from "../controllers/authController.ts";
import { authenticate } from "../middleware/auth.ts";

const router = Router();

// POST /api/v1/auth/register
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', authenticate, authController.getProfile);
router.get('/refresh', authController.refresh);
router.post('/logout', authController.logout);

export default router;