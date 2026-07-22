import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { supabase } from '../lib/supabase';
import { uploadToCloudinary } from '../lib/cloudinary';
import { v4 as uuidv4 } from 'uuid';
import { sendPushToUser } from './push.controller';

export const createPayout = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { agentId, amount } = req.body;
    const companyId = req.user?.companyId;
    const role = req.user?.role;
    const file = req.file;

    if (!companyId || (role !== 'MANAGER' && role !== 'SUPER_ADMIN')) {
      res.status(403).json({ error: 'Unauthorized to create payouts' });
      return;
    }

    if (!agentId || !file || !amount) {
      res.status(400).json({ error: 'Agent ID, Amount, and Payment Proof image are required' });
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      res.status(400).json({ error: 'Invalid payout amount' });
      return;
    }

    // Upload proof image
    let publicUrl = '';
    try {
      publicUrl = await uploadToCloudinary(file.buffer, 'payouts');
    } catch (uploadError) {
      console.error('Cloudinary payout upload error:', uploadError);
      res.status(500).json({ error: 'Failed to upload image' });
      return;
    }

    // Create payout
    const payout = await prisma.payout.create({
      data: {
        companyId,
        agentId,
        amount: paymentAmount,
        proofUrl: publicUrl,
        status: 'PENDING' // Pending agent approval
      }
    });

    // Notify agent via in-app & push
    await prisma.notification.create({
      data: {
        companyId,
        userId: agentId,
        title: 'New Payout Received',
        message: `Your manager has sent a payout of PKR ${paymentAmount.toLocaleString()}. Please review and approve in your dashboard.`
      }
    });

    sendPushToUser(agentId, {
      title: '💸 Payout Sent by Manager!',
      body: `You received a payout of PKR ${paymentAmount.toLocaleString()}. Tap to approve.`,
      url: '/sales'
    });

    res.status(201).json({ message: 'Payout created successfully', payout });
  } catch (error) {
    next(error);
  }
};


export const listPayouts = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { role, id: userId, companyId } = req.user!;
    const companyIdStr = companyId as string;

    let payouts;

    if (role === 'SUPER_ADMIN') {
      const whereClause = (companyIdStr && companyIdStr !== 'null') ? { companyId: companyIdStr } : {};
      payouts = await prisma.payout.findMany({
        where: whereClause,
        include: { agent: { select: { name: true, email: true } }, tickets: { select: { id: true, transactionId: true, price: true } } },
        orderBy: { createdAt: 'desc' }
      });
    } else if (role === 'MANAGER') {
      const whereClause = (companyIdStr && companyIdStr !== 'null') ? { companyId: companyIdStr } : {};
      payouts = await prisma.payout.findMany({
        where: whereClause,
        include: { agent: { select: { name: true, email: true } }, tickets: { select: { id: true, transactionId: true, price: true } } },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      const whereClause: any = { agentId: userId };
      if (companyIdStr && companyIdStr !== 'null') whereClause.companyId = companyIdStr;
      payouts = await prisma.payout.findMany({
        where: whereClause,
        include: { tickets: { select: { id: true, transactionId: true, price: true } } },
        orderBy: { createdAt: 'desc' }
      });
    }

    res.json(payouts);
  } catch (error) {
    next(error);
  }
};

export const approvePayout = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payoutId = req.params.id as string;
    const userId = req.user!.id;

    const payout = await prisma.payout.findUnique({ where: { id: payoutId } });

    if (!payout) {
      res.status(404).json({ error: 'Payout not found' });
      return;
    }

    if (payout.agentId !== userId) {
      res.status(403).json({ error: 'Unauthorized to approve this payout' });
      return;
    }

    const updatedPayout = await prisma.payout.update({
      where: { id: payoutId },
      data: { status: 'APPROVED' }
    });

    // Notify managers
    prisma.user.findMany({
      where: { companyId: payout.companyId, role: { in: ['MANAGER', 'SUPER_ADMIN'] } },
      select: { id: true }
    }).then(managers => {
      managers.forEach(mgr => {
        sendPushToUser(mgr.id, {
          title: '✅ Payout Approved!',
          body: `Agent approved payout of PKR ${payout.amount.toLocaleString()}.`,
          url: '/manager'
        });
      });
    }).catch(err => console.error('Error sending push on payout approve:', err));

    res.json({ message: 'Payout approved successfully', payout: updatedPayout });
  } catch (error) {
    next(error);
  }
};
