import { Router, Request, Response } from 'express';
import { identifyContact } from './contactService';
import { IdentifyRequest } from './types';

const router = Router();

// POST /identify
router.post('/identify', async (req: Request, res: Response) => {
  try {
    const { email, phoneNumber }: IdentifyRequest = req.body;

    const hasEmail = email !== null && email !== undefined && String(email).trim() !== '';
    const hasPhone = phoneNumber !== null && phoneNumber !== undefined && String(phoneNumber).trim() !== '';

    if (!hasEmail && !hasPhone) {
      return res.status(400).json({
        error: 'At least one of email or phoneNumber must be provided',
      });
    }

    const contact = await identifyContact(
      hasEmail ? String(email).trim().toLowerCase() : null,
      hasPhone ? String(phoneNumber).trim() : null
    );

    return res.status(200).json({ contact });
  } catch (err) {
    console.error('Error in /identify:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /health
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
