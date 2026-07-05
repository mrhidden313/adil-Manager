import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';

export const createPad = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(403).json({ error: 'Not associated with a company' });
      return;
    }

    const { name, color, totalTickets, assignedToId } = req.body;

    if (!name || !totalTickets || !assignedToId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Verify assigned user belongs to same company and is SALES
    const assignedUser = await prisma.user.findFirst({
      where: { id: assignedToId, companyId, role: 'SALES' }
    });

    if (!assignedUser) {
      res.status(400).json({ error: 'Invalid user assignment. Must be a Sales Agent in your company.' });
      return;
    }

    const pad = await prisma.ticketPad.create({
      data: {
        companyId,
        name,
        color: color || '#4f46e5',
        totalTickets: parseInt(totalTickets, 10),
        assignedToId
      },
      include: {
        assignedTo: { select: { name: true, email: true } }
      }
    });

    res.status(201).json(pad);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create pad' });
  }
};

export const getCompanyPads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = req.user?.companyId as string;
    const pads = await prisma.ticketPad.findMany({
      where: { companyId },
      include: {
        assignedTo: { select: { id: true, name: true, profilePictureUrl: true } },
        tickets: {
          select: { status: true, genericData: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // We can compute the total revenue here or in the frontend. Let's do it in frontend for simplicity
    res.json(pads);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pads' });
  }
};

export const getMyPads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id as string;
    const companyId = req.user?.companyId as string;
    
    if (!userId || !companyId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const pads = await prisma.ticketPad.findMany({
      where: { assignedToId: userId, companyId },
      include: {
        tickets: {
          select: { status: true, genericData: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(pads);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your pads' });
  }
};

export const getPadById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const companyId = req.user?.companyId as string;

    const pad = await prisma.ticketPad.findFirst({
      where: { id, companyId },
      include: {
        assignedTo: { select: { id: true, name: true } },
        tickets: {
          include: {
            createdBy: { select: { name: true } },
            assignedTo: { select: { name: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!pad) {
      res.status(404).json({ error: 'Pad not found' });
      return;
    }

    // Security: Only Manager, Super Admin, or the assigned Sales agent can view it
    if (req.user?.role === 'SALES' && pad.assignedToId !== req.user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(pad);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pad' });
  }
};

export const updatePadStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const companyId = req.user?.companyId as string;
    const { status } = req.body;

    const pad = await prisma.ticketPad.findFirst({
      where: { id, companyId }
    });

    if (!pad) {
      res.status(404).json({ error: 'Pad not found' });
      return;
    }

    const updatedPad = await prisma.ticketPad.update({
      where: { id },
      data: { status }
    });

    res.json(updatedPad);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update pad status' });
  }
};

export const updatePadExtraPaid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const companyId = req.user?.companyId as string;
    const { extraPaymentNotes } = req.body;
    const file = req.file;

    const pad = await prisma.ticketPad.findFirst({
      where: { id, companyId }
    });

    if (!pad) {
      res.status(404).json({ error: 'Pad not found' });
      return;
    }

    let extraPaymentProofUrl = pad.extraPaymentProofUrl;

    if (file) {
      const { v4: uuidv4 } = require('uuid');
      const { supabase } = require('../lib/supabase');
      const fileExt = file.originalname.split('.').pop();
      const fileName = `extra_${uuidv4()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('proofs').upload(fileName, file.buffer, { contentType: file.mimetype });
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('proofs').getPublicUrl(fileName);
        extraPaymentProofUrl = publicUrl;
      }
    }

    const updatedPad = await prisma.ticketPad.update({
      where: { id },
      data: { 
        extraPaidOff: true,
        extraPaymentNotes: extraPaymentNotes || pad.extraPaymentNotes,
        extraPaymentProofUrl
      }
    });

    res.json(updatedPad);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update extra paid status' });
  }
};
