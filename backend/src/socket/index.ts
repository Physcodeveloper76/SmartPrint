import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';

let io: Server;

export function initializeSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) {
        return next(new Error('Invalid token'));
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      (socket as any).userId = user.id;
      (socket as any).userRole = profile?.role || 'user';
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    const userRole = (socket as any).userRole;

    // Join personal room
    socket.join(`user:${userId}`);

    // Admin joins admin room
    if (userRole === 'admin') {
      socket.join('admin');
    }

    console.log(`[Socket] User ${userId} connected (${userRole})`);

    socket.on('disconnect', () => {
      console.log(`[Socket] User ${userId} disconnected`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

// Emit to a specific user
export function emitToUser(userId: string, event: string, data: any) {
  if (io) io.to(`user:${userId}`).emit(event, data);
}

// Emit to all admins
export function emitToAdmins(event: string, data: any) {
  if (io) io.to('admin').emit(event, data);
}

// Emit to everyone
export function emitToAll(event: string, data: any) {
  if (io) io.emit(event, data);
}
