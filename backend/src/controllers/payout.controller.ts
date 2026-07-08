import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const createPayout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { agentId } = req.body;
    const companyId = req.user?.companyId;
    const role = req.user?.role;
    const file = req.file;

    if (!companyId || (role !== 'MANAGER' && role !== 'SUPER_ADMIN')) {
      res.status(403).json({ error: 'Unauthorized to create payouts' });
      return;
    }

    if (!agentId || !file) {
      res.status(400).json({ error: 'Agent ID and Payment Proof image are required' });
      return;
    }

    // Find all pending bonus tickets for this agent
    const pendingTickets = await prisma.ticket.findMany({
      where: {
        createdById: agentId,
        companyId,
        bonusStatus: 'PENDING',
        status: 'COMPLETED' // Assuming bonus is only paid on COMPLETED tickets
      }
    });

    if (pendingTickets.length === 0) {
      res.status(400).json({ error: 'No completed tickets with pending bonuses found for this agent' });
      return;
    }

    const totalBonusAmount = pendingTickets.reduce((sum, t) => sum + t.bonusAmount, 0);

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

    // Create payout and update tickets in a transaction
    const payout = await prisma.$transaction(async (tx) => {
      const newPayout = await tx.payout.create({
        data: {
          companyId,
          agentId,
          amount: totalBonusAmount,
          proofUrl: publicUrl,
          status: 'PENDING' // Pending agent approval
        }
      });

      // Update tickets to link to payout and mark as PAID
      await tx.ticket.updateMany({
        where: {
          id: { in: pendingTickets.map(t => t.id) }
        },
        data: {
          bonusStatus: 'PAID',
          payoutId: newPayout.id
        }
      });

      return newPayout;
    });

    // Notify agent
    await prisma.notification.create({
      data: {
        companyId,
        userId: agentId,
        title: 'New Payout Received',
        message: `Your manager has sent a payout of $${totalBonusAmount.toFixed(2)}. Please review and approve.`
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

    if (role === 'MANAGER' || role === 'SUPER_ADMIN') {
      payouts = await prisma.payout.findMany({
        where: { companyId: companyIdStr },
        include: { agent: { select: { name: true, email: true } }, tickets: { select: { id: true, transactionId: true, price: true } } },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      payouts = await prisma.payout.findMany({
        where: { agentId: userId, companyId: companyIdStr },
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
    const { id } = req.params;
    const userId = req.user!.id;

    const payout = await prisma.payout.findUnique({ where: { id } });

    if (!payout) {
      res.status(404).json({ error: 'Payout not found' });
      return;
    }

    if (payout.agentId !== userId) {
      res.status(403).json({ error: 'Unauthorized to approve this payout' });
      return;
    }

    const updatedPayout = await prisma.payout.update({
      where: { id },
      data: { status: 'APPROVED' }
    });

    res.json({ message: 'Payout approved successfully', payout: updatedPayout });
  } catch (error) {
    console.error('Approve payout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
