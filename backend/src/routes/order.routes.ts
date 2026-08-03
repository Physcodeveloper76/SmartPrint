import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

// Create order with file upload
router.post('/', authMiddleware, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const {
      copies = '1',
      printType = 'bw',
      pageSize = 'A4',
      pageCount = '1',
      category = 'assignment',
      printerName = 'Library Desk',
      bindingType = 'none'
    } = req.body;

    // Validate
    const copiesNum = Math.max(1, parseInt(copies, 10) || 1);
    const pageCountNum = Math.max(1, parseInt(pageCount, 10) || 1);

    if (!['bw', 'color'].includes(printType)) {
      return res.status(400).json({ message: 'Invalid print type' });
    }
    if (!['A4', 'A3', 'Letter', 'Legal'].includes(pageSize)) {
      return res.status(400).json({ message: 'Invalid page size' });
    }

    // Calculate price
    const basePrice = printType === 'color' ? 5 : 2;
    const sizeMultiplier = pageSize === 'A3' ? 1.5 : pageSize === 'Legal' ? 1.2 : 1;
    
    // Binding costs: spiral = 20, hardcover = 50, other = 0
    const bindingCost = bindingType === 'spiral' ? 20 : bindingType === 'hardcover' ? 50 : 0;
    
    const totalPrice = Math.round(((basePrice * pageCountNum * copiesNum * sizeMultiplier) + bindingCost) * 100) / 100;

    // Generate unique order number
    const orderNumber = `SP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

    // Create order in database
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: req.user!.id,
        order_number: orderNumber,
        file_name: req.file.originalname,
        file_path: req.file.path,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        page_count: pageCountNum,
        copies: copiesNum,
        print_type: printType,
        page_size: pageSize,
        status: 'pending_payment',
        total_price: totalPrice,
        category,
        printer_name: printerName,
        binding_type: bindingType
      })
      .select()
      .single();

    if (error) {
      console.error('[Order] Create failed:', error);
      return res.status(500).json({ message: 'Failed to create order' });
    }

    res.status(201).json({ order });
  } catch (err: any) {
    console.error('[Order] Error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Get user's orders
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ orders: orders || [] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Get single order
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check ownership (unless admin)
    if (order.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ order });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Cancel order
router.patch('/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (!['pending_payment', 'queued'].includes(order.status)) {
      return res.status(400).json({ message: 'Cannot cancel this order' });
    }

    const { printQueue } = await import('../services/queue.service');
    if (order.status === 'queued') {
      await printQueue.removeJob(order.id);
    }

    await supabaseAdmin
      .from('orders')
      .update({ status: 'cancelled', queue_position: null, estimated_time: null })
      .eq('id', order.id);

    res.json({ message: 'Order cancelled' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Get notifications
router.get('/user/notifications', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { data: notifications } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .limit(30);
    res.json({ notifications: notifications || [] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Mark notification as read
router.patch('/user/notifications/:id/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('id', String(req.params.id));
    res.json({ message: 'Notification marked as read' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Mark all notifications as read
router.patch('/user/notifications/read-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.user!.id)
      .eq('read', false);
    res.json({ message: 'All notifications marked as read' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
