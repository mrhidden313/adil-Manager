import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const createPayout = async (req: AuthRequest, res: Response): Promise<void> => {
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
    const fileExt = file.originalname.split('.').pop();
    const fileName = `payout_${uuidv4()}.${fileExt}`;
    
    const { error: uploadError } = await supabase
      .storage
      .from('proofs')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype
      });

    if (uploadError) {
      res.status(500).json({ error: 'Failed to upload image' });
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('proofs').getPublicUrl(fileName);

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

    // Notify agent
    await prisma.notification.create({
      data: {
        companyId,
        userId: agentId,
        title: 'New Payout Received',
        message: `Your manager has sent a payout of PKR ${paymentAmount.toLocaleString()}. Please review and approve in your dashboard.`
      }
    });

    res.status(201).json({ message: 'Payout created successfully', payout });
  } catch (error) {
    console.error('Create payout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listPayouts = async (req: AuthRequest, res: Response): Promise<void> => {
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
    console.error('List payouts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const approvePayout = async (req: AuthRequest, res: Response): Promise<void> => {
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

    res.json({ message: 'Payout approved successfully', payout: updatedPayout });
  } catch (error) {
    console.error('Approve payout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
