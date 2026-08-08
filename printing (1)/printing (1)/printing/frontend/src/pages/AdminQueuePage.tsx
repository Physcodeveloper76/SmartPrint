import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useToastStore } from '../components/Toast';
import { getStatusLabel, formatTime, type QueueItem } from '../types';

export default function AdminQueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const addToast = useToastStore((s) => s.addToast);

  const fetchQueue = async () => {
    try {
      const { data } = await api.get('/admin/queue');
      setQueue(data.queue || []);
    } catch (err) {
      console.error('Failed to fetch queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (orderId: string, action: string) => {
    try {
      await api.post(`/admin/orders/${orderId}/${action}`);
      addToast({ type: 'success', title: `Order ${action}d successfully` });
      fetchQueue();
    } catch (err: any) {
      addToast({ type: 'error', title: `Failed to ${action}`, message: err.response?.data?.message });
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" /></div>;

  const printingJobs = queue.filter((q) => q.status === 'printing');
  const queuedJobs = queue.filter((q) => q.status === 'queued');

  return (
    <div>
      <div className="page-header">
        <h1>Print Queue</h1>
        <p>Monitor and control the print queue in real-time</p>
      </div>

      {/* Queue Stats */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stat-card">
          <div className="stat-icon info">🖨️</div>
          <div className="stat-info">
            <h3>{printingJobs.length}</h3>
            <p>Currently Printing</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning">⏳</div>
          <div className="stat-info">
            <h3>{queuedJobs.length}</h3>
            <p>In Queue</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon primary">⏱️</div>
          <div className="stat-info">
            <h3>{queue.length > 0 ? formatTime(queue.reduce((sum, q) => sum + q.estimatedTime, 0)) : '0s'}</h3>
            <p>Total Queue Time</p>
          </div>
        </div>
      </div>

      {/* Currently Printing */}
      {printingJobs.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="card-header">
            <h3>🖨️ Currently Printing</h3>
          </div>
          <div className="card-body">
            <div className="queue-list">
              {printingJobs.map((job) => (
                <div key={job.orderId} className="queue-item printing">
                  <div className="queue-number" style={{ background: 'var(--color-primary-bg)', fontSize: '1.2rem' }}>
                    🖨️
                  </div>
                  <div className="queue-info">
                    <h4>{job.orderNumber} — {job.fileName}</h4>
                    <p>
                      {job.pageCount} pages × {job.copies} copies · {job.printType === 'color' ? 'Color' : 'B&W'} · {job.pageSize}
                    </p>
                  </div>
                  <div className="queue-actions">
                    <button className="btn btn-danger btn-sm" onClick={() => handleAction(job.orderId, 'cancel')}>
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Queue */}
      <div className="card">
        <div className="card-header">
          <h3>📋 Print Queue ({queuedJobs.length} jobs)</h3>
        </div>
        <div className="card-body">
          {queuedJobs.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-icon">✅</div>
              <h3>Queue is empty</h3>
              <p>No pending print jobs at the moment.</p>
            </div>
          ) : (
            <div className="queue-list">
              {queuedJobs.map((job) => (
                <div key={job.orderId} className="queue-item">
                  <div className="queue-number">#{job.position}</div>
                  <div className="queue-info">
                    <h4>{job.orderNumber} — {job.fileName}</h4>
                    <p>
                      {job.pageCount}pg × {job.copies} · {job.printType === 'color' ? 'Color' : 'B&W'} · {job.pageSize}
                      {' · ETA: '}{formatTime(job.estimatedTime)}
                    </p>
                  </div>
                  <div className="queue-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleAction(job.orderId, 'prioritize')} title="Move to front">
                      ⬆️ Priority
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleAction(job.orderId, 'cancel')}>
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
