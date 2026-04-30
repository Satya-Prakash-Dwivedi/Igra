import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as uploadCtrl from '../controllers/uploadController.js';

const router = Router();

// Local Proxy for chunks - bypasses general auth as it uses a session-bound token 'u'
router.put('/local-part/:sessionId/:partNumber', uploadCtrl.handleLocalPartUpload);

// Public view route (needed for <img> tags)
router.get('/view/:assetId',              uploadCtrl.viewAsset);

router.use(authenticate);

router.post('/start',                     uploadCtrl.startUpload);
router.post('/:sessionId/parts',          uploadCtrl.registerPart);
router.post('/:sessionId/finalize',       uploadCtrl.finalizeUpload);
router.get('/:sessionId/status',          uploadCtrl.getUploadStatus);
router.get('/:sessionId/resume',          uploadCtrl.resumeUpload);

router.delete('/:oid/:iid/:aid',          uploadCtrl.removeAsset);

export default router;
