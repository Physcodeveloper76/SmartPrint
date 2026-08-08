// ============================================================
// FIFO Queue Service — In-Memory Print Queue Management
// ============================================================

import { QueueJob, OrderStatus } from '../types';
import { supabaseAdmin } from '../config/supabase';
import { emitToUser, emitToAdmins } from '../socket';
import { calculateETA } from './eta.service';
import { simulatePrint } from './print.service';
import { createNotification } from './notification.service';

class PrintQueue {
  private queue: QueueJob[] = [];
  private currentJob: QueueJob | null = null;
  private processing = false;

  // Add a job to the queue
  async addJob(job: QueueJob): Promise<number> {
    this.queue.push(job);
    const position = this.queue.length;

    // Update order in database
    await this.updateOrderPosition(job.orderId, position);

    // Notify user
    emitToUser(job.userId, 'order:status', {
      orderId: job.orderId,
      status: 'queued',
      queuePosition: position,
      estimatedTime: calculateETA(this.queue, position - 1),
    });

    // Notify admins
    emitToAdmins('queue:update', { action: 'added', job: this.serializeJob(job, position) });

    // Create notification
    await createNotification(job.userId, 'Order Queued', `Your order ${job.orderNumber} is #${position} in the queue.`, 'info');

    // Update ETAs for all queued jobs
    await this.broadcastQueueUpdates();

    // Start processing if not already (only if simulated print mode is active)
    if (process.env.USE_PHYSICAL_PRINTER !== 'true') {
      if (!this.processing) {
        this.processNext();
      }
    }

    return position;
  }

  // Remove a job from the queue
  async removeJob(orderId: string): Promise<boolean> {
    const index = this.queue.findIndex((j) => j.orderId === orderId);
    if (index === -1) return false;

    const [removed] = this.queue.splice(index, 1);

    // Update remaining positions
    await this.broadcastQueueUpdates();

    emitToAdmins('queue:update', { action: 'removed', orderId });

    return true;
  }

  // Prioritize a job (move to front)
  async prioritizeJob(orderId: string): Promise<boolean> {
    const index = this.queue.findIndex((j) => j.orderId === orderId);
    if (index <= 0) return false; // Already first or not found

    const [job] = this.queue.splice(index, 1);
    job.priority = 0;
    this.queue.unshift(job);

    await this.broadcastQueueUpdates();
    emitToAdmins('queue:update', { action: 'prioritized', orderId });

    return true;
  }

  // Process next job in queue
  private async processNext() {
    if (this.queue.length === 0) {
      this.processing = false;
      this.currentJob = null;
      return;
    }

    this.processing = true;
    this.currentJob = this.queue.shift()!;

    // Update status to printing
    await supabaseAdmin
      .from('orders')
      .update({ status: 'printing', queue_position: 0 })
      .eq('id', this.currentJob.orderId);

    // Notify user
    emitToUser(this.currentJob.userId, 'order:status', {
      orderId: this.currentJob.orderId,
      status: 'printing',
      queuePosition: 0,
    });

    emitToAdmins('queue:update', {
      action: 'printing',
      job: this.serializeJob(this.currentJob, 0),
    });

    await createNotification(
      this.currentJob.userId,
      'Printing Started',
      `Your order ${this.currentJob.orderNumber} is now being printed!`,
      'info'
    );

    // Update remaining queue positions
    await this.broadcastQueueUpdates();

    // Simulate printing
    try {
      await simulatePrint(this.currentJob);

      // Mark as completed
      await supabaseAdmin
        .from('orders')
        .update({ status: 'completed', queue_position: null, estimated_time: null })
        .eq('id', this.currentJob.orderId);

      emitToUser(this.currentJob.userId, 'order:status', {
        orderId: this.currentJob.orderId,
        status: 'completed',
      });

      emitToAdmins('queue:update', { action: 'completed', orderId: this.currentJob.orderId });

      await createNotification(
        this.currentJob.userId,
        'Print Completed! 🎉',
        `Your order ${this.currentJob.orderNumber} is ready for pickup.`,
        'success'
      );
    } catch (err) {
      console.error('[Queue] Print failed:', err);
      // Re-queue failed job at front
      this.queue.unshift(this.currentJob);
    }

    this.currentJob = null;

    // Process next
    this.processNext();
  }

  // Update all queue positions and ETAs
  private async broadcastQueueUpdates() {
    for (let i = 0; i < this.queue.length; i++) {
      const job = this.queue[i];
      const position = i + 1;
      const eta = calculateETA(this.queue, i);

      await this.updateOrderPosition(job.orderId, position, eta);

      emitToUser(job.userId, 'queue:update', {
        orderId: job.orderId,
        position,
        estimatedTime: eta,
      });
    }
  }

  private async updateOrderPosition(orderId: string, position: number, eta?: number) {
    const update: any = { queue_position: position };
    if (eta !== undefined) update.estimated_time = eta;
    await supabaseAdmin.from('orders').update(update).eq('id', orderId);
  }

  // Get current queue state
  getQueue() {
    const items = this.queue.map((job, i) => this.serializeJob(job, i + 1));
    if (this.currentJob) {
      items.unshift(this.serializeJob(this.currentJob, 0, 'printing'));
    }
    return items;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getCurrentJob(): QueueJob | null {
    return this.currentJob;
  }

  private serializeJob(job: QueueJob, position: number, overrideStatus?: string) {
    return {
      orderId: job.orderId,
      orderNumber: job.orderNumber,
      fileName: job.fileName,
      pageCount: job.pageCount,
      copies: job.copies,
      printType: job.printType,
      pageSize: job.pageSize,
      status: overrideStatus || (position === 0 ? 'printing' : 'queued'),
      position,
      estimatedTime: calculateETA(this.queue, Math.max(0, position - 1)),
    };
  }
}

// Singleton queue instance
export const printQueue = new PrintQueue();
