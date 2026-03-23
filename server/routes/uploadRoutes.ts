import { Router } from 'express';
import { authenticate } from '../middleware/auth.ts';
import * as uploadCtrl from '../controllers/uploadController.ts';

const router = Router();

router.use(authenticate);

router.post('/start',                     uploadCtrl.startUpload);
router.post('/:sessionId/parts',          uploadCtrl.registerPart);
router.post('/:sessionId/finalize',       uploadCtrl.finalizeUpload);
router.get('/:sessionId/status',          uploadCtrl.getUploadStatus);
router.get('/:sessionId/resume',          uploadCtrl.resumeUpload);

export default router;
