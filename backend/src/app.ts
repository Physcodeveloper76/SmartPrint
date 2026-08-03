import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import orderRoutes from './routes/order.routes';
import paymentRoutes from './routes/payment.routes';
import adminRoutes from './routes/admin.routes';
import authRoutes from './routes/auth.routes';
import { supabaseAdmin } from './config/supabase';
import { printQueue } from './services/queue.service';
import { emitToUser, emitToAdmins } from './socket';
import { createNotification } from './services/notification.service';

const app = express();

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static(env.UPLOAD_DIR));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/queue - Poll for new, paid print jobs (status: queued)
app.get('/api/queue', async (req, res) => {
  try {
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Convert file paths to absolute download URLs
    const jobs = (orders || []).map((order: any) => {
      const fileNameOnServer = path.basename(order.file_path);
      const downloadUrl = `${req.protocol}://${req.get('host')}/uploads/${fileNameOnServer}`;
      return {
        id: order.id,
        order_number: order.order_number,
        file_name: order.file_name,
        download_url: downloadUrl,
        copies: order.copies,
        print_type: order.print_type,
        page_size: order.page_size,
        page_count: order.page_count,
        status: order.status
      };
    });

    res.json({ jobs });
  } catch (err: any) {
    console.error('[API GET queue] Error:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/status - Update print job status from local bridge
app.post('/api/status', async (req, res) => {
  try {
    const { jobId, status } = req.body;
    if (!jobId || !status) {
      return res.status(400).json({ message: 'jobId and status are required' });
    }

    const validStatuses = ['pending_payment', 'queued', 'printing', 'completed', 'printed', 'downloaded_offline', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    // Get order info first
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update status in database
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status })
      .eq('id', jobId);

    if (updateError) throw updateError;

    // Remove from in-memory queue if it's in a final state
    if (['completed', 'printed', 'downloaded_offline', 'cancelled'].includes(status)) {
      await printQueue.removeJob(jobId);
    }

    // Emit real-time status updates via Socket.IO
    // Map 'printed' to 'completed' for standard frontend status checks if needed
    const socketStatus = status === 'printed' ? 'completed' : status;
    
    emitToUser(order.user_id, 'order:status', {
      orderId: jobId,
      status: socketStatus,
      queuePosition: ['completed', 'printed', 'downloaded_offline', 'cancelled'].includes(status) ? null : order.queue_position
    });

    // Notify admins of queue updates
    emitToAdmins('queue:update', { 
      action: status, 
      orderId: jobId,
      status 
    });

    // Create notifications for the user
    let title = 'Print Update';
    let message = `Your order ${order.order_number} status updated to ${status}.`;
    let type: 'info' | 'success' | 'warning' | 'error' = 'info';

    if (status === 'printed' || status === 'completed') {
      title = 'Print Completed! 🎉';
      message = `Your order ${order.order_number} is ready for pickup.`;
      type = 'success';
    } else if (status === 'downloaded_offline') {
      title = 'Order Prepared Offline';
      message = `Your order ${order.order_number} is queued for manual processing.`;
      type = 'warning';
    } else if (status === 'printing') {
      title = 'Printing Started';
      message = `Your order ${order.order_number} is now being printed.`;
    }

    await createNotification(order.user_id, title, message, type);

    res.json({ message: 'Status updated successfully', status });
  } catch (err: any) {
    console.error('[API POST status] Error:', err);
    res.status(500).json({ message: err.message });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Error handler
app.use(errorHandler);

export default app;
