import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { printQueue } from '../services/queue.service';

const router = Router();

// All admin routes require auth + admin role
router.use(authMiddleware, adminMiddleware);

// Dashboard stats
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { count: totalOrders } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true });

    const { count: pendingOrders } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_payment');

    const { count: completedOrders } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    const activeQueue = printQueue.getQueueLength() + (printQueue.getCurrentJob() ? 1 : 0);

    // Today's revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todayOrders } = await supabaseAdmin
      .from('orders')
      .select('total_price')
      .gte('created_at', today.toISOString())
      .in('status', ['queued', 'printing', 'completed']);

    const todayRevenue = (todayOrders || []).reduce((sum: number, o: any) => sum + Number(o.total_price), 0);

    // Total revenue
    const { data: allPaidOrders } = await supabaseAdmin
      .from('orders')
      .select('total_price')
      .in('status', ['queued', 'printing', 'completed']);

    const totalRevenue = (allPaidOrders || []).reduce((sum: number, o: any) => sum + Number(o.total_price), 0);

    res.json({
      stats: {
        totalOrders: totalOrders || 0,
        pendingOrders: pendingOrders || 0,
        completedOrders: completedOrders || 0,
        activeQueue,
        todayRevenue: Math.round(todayRevenue * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// All orders (with optional filters)
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const { status, search, limit = '50' } = req.query;

    let query = supabaseAdmin
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string, 10));

    if (status && status !== 'all') {
      query = query.eq('status', String(status));
    }

    if (search) {
      query = query.or(`order_number.ilike.%${String(search)}%,file_name.ilike.%${String(search)}%`);
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    res.json({ orders: orders || [] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Get print queue
router.get('/queue', async (req: Request, res: Response) => {
  try {
    const queue = printQueue.getQueue();
    res.json({ queue });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Update order status
router.patch('/orders/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!['pending_payment', 'queued', 'printing', 'completed', 'cancelled', 'printed', 'downloaded_offline'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await supabaseAdmin
      .from('orders')
      .update({ status })
      .eq('id', req.params.id);

    res.json({ message: 'Status updated' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Prioritize order in queue
router.post('/orders/:id/prioritize', async (req: Request, res: Response) => {
  try {
    const success = await printQueue.prioritizeJob(String(req.params.id));
    if (!success) {
      return res.status(400).json({ message: 'Cannot prioritize this order' });
    }
    res.json({ message: 'Order prioritized' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Cancel order from queue
router.post('/orders/:id/cancel', async (req: Request, res: Response) => {
  try {
    await printQueue.removeJob(String(req.params.id));

    await supabaseAdmin
      .from('orders')
      .update({ status: 'cancelled', queue_position: null, estimated_time: null })
      .eq('id', req.params.id);

    res.json({ message: 'Order cancelled' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// -------------------------------------------------------
// Auto-Print Download — streams the PDF to admin browser
// so Windows "Save as PDF" / browser auto-download fires
// without any permission prompt.
// -------------------------------------------------------
router.get('/orders/:id/download', async (req: Request, res: Response) => {
  try {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Resolve the file on disk
    const filePath = order.file_path
      ? path.resolve(order.file_path)
      : null;

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    const fileName = order.file_name || path.basename(filePath);
    const stat = fs.statSync(filePath);

    // Force browser to download (not preview) the file
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'no-store');

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
