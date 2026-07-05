import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../prisma';

export const getVapidPublicKey = (req: AuthRequest, res: Response) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

export const subscribe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id as string;
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      res.status(400).json({ error: 'Invalid subscription object' });
      return;
    }

    // Upsert subscription based on endpoint to avoid duplicates
    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      }
    });

    res.status(201).json(subscription);
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
};

export const unsubscribe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id as string;
    const { endpoint } = req.body;

    if (!endpoint) {
      res.status(400).json({ error: 'Endpoint is required' });
      return;
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId }
    });

    res.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
};
