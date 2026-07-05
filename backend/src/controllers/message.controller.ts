import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../prisma';
import { io } from '../socket';
import webpush from 'web-push';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:test@test.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let companyId = req.user?.companyId;
    
    if (req.user?.role === 'SUPER_ADMIN') {
      if (req.query.companyId) {
        companyId = req.query.companyId as string;
      }
    }

    if (!companyId) {
      res.status(400).json({ error: 'Company ID required' });
      return;
    }

    let messages = await prisma.message.findMany({
      where: { companyId },
      include: {
        sender: { select: { id: true, name: true, profilePictureUrl: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    
    // Anonymize SUPER_ADMIN messages
    messages = messages.map(msg => {
      if (msg.sender?.role === 'SUPER_ADMIN') {
        msg.sender.name = 'Admin Support';
        msg.sender.profilePictureUrl = null;
      }
      return msg;
    });

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let companyId = req.user?.companyId as string;
    
    if (req.user?.role === 'SUPER_ADMIN' && req.body.companyId) {
      companyId = req.body.companyId;
    }

    if (!companyId) {
      res.status(400).json({ error: 'Company ID required' });
      return;
    }

    const senderId = req.user?.id as string;
    const { content } = req.body;
    const file = req.file;

    if (!content && !file) {
      res.status(400).json({ error: 'Message cannot be empty' });
      return;
    }

    let imageUrl = null;

    if (file) {
      const fileExt = file.originalname.split('.').pop();
      const fileName = `chat_${uuidv4()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('proofs')
        .upload(fileName, file.buffer, { contentType: file.mimetype });

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('proofs').getPublicUrl(fileName);
        imageUrl = publicUrl;
      }
    }
    
    const message = await prisma.message.create({
      data: {
        companyId,
        senderId,
        content: content || null,
        imageUrl
      },
      include: {
        sender: { select: { id: true, name: true, profilePictureUrl: true, role: true } }
      }
    });

    // Anonymize if SUPER_ADMIN
    if (message.sender?.role === 'SUPER_ADMIN') {
      message.sender.name = 'Admin Support';
      message.sender.profilePictureUrl = null;
    }

    // 1. Emit via WebSocket
    io.to(`company_${companyId}`).emit('newMessage', message);

    // 2. Trigger Web Push for offline users
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        user: { companyId, id: { not: senderId } }
      }
    });

    const payload = JSON.stringify({
      title: `New message from ${message.sender.name}`,
      body: message.content || 'Sent an image',
      icon: message.sender.profilePictureUrl || '/logo.png',
      url: '/chat'
    });

    subscriptions.forEach((sub: any) => {
      webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      }, payload).catch(err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      });
    });

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
};
