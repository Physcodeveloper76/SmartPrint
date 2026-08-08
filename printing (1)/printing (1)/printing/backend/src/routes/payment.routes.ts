import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { processPayment } from '../services/payment.service';
import { printQueue } from '../services/queue.service';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

// Process simulated payment
router.post('/process', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { orderId, amount, cardNumber, expiryDate, cvv, cardName } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID required' });
    }

    // Verify order exists and belongs to user
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.user_id !== req.user!.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (order.status !== 'pending_payment') {
      return res.status(400).json({ message: 'Order already paid' });
    }

    // Check user page quota
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user!.id)
      .single();

    const pagesNeeded = order.page_count * order.copies;
    if (profile && profile.role !== 'admin' && profile.quota_used + pagesNeeded > profile.quota_limit) {
      return res.status(400).json({
        success: false,
        message: `Quota exceeded! This print requires ${pagesNeeded} pages, but you only have ${profile.quota_limit - profile.quota_used} pages left in your semester quota. Please contact the IT Helpdesk to request a quota increase.`
      });
    }

    // Process payment
    const result = await processPayment({
      orderId,
      amount: order.total_price,
      cardNumber: cardNumber || '',
      expiryDate: expiryDate || '',
      cvv: cvv || '',
      cardName: cardName || '',
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Deduct pages from user's quota
    if (profile) {
      await supabaseAdmin
        .from('profiles')
        .update({ quota_used: profile.quota_used + pagesNeeded })
        .eq('id', req.user!.id);
    }

    // Update order status
    await supabaseAdmin
      .from('orders')
      .update({
        status: 'queued',
        payment_id: result.paymentId,
      })
      .eq('id', orderId);

    // Add to print queue
    await printQueue.addJob({
      orderId: order.id,
      orderNumber: order.order_number,
      userId: order.user_id,
      fileName: order.file_name,
      filePath: order.file_path || '',
      fileType: order.file_type,
      pageCount: order.page_count,
      copies: order.copies,
      printType: order.print_type,
      pageSize: order.page_size,
      addedAt: new Date(),
      priority: 10,
    });

    res.json({
      success: true,
      paymentId: result.paymentId,
      message: 'Payment successful. Order added to print queue.',
    });
  } catch (err: any) {
    console.error('[Payment] Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
