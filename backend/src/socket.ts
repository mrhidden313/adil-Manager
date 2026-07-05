
import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';

export const app = express();
export const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true
  }
});
