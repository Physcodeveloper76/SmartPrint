import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useOrderStore } from '../store/orderStore';
import { getStatusLabel, formatFileSize, formatTime, type Order } from '../types';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateOrder } = useOrderStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get(`/orders/${id}`);
        setOrder(data.order);
      } catch {
        navigate('/orders');
      } finally {
        setLoading(false);
      }
    };
    fetch();

    // Poll for updates every 5 seconds for active orders
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/orders/${id}`);
        setOrder(data.order);
      } catch { /* ignore */ }
    }, 5000);

    return () => clearInterval(interval);
  }, [id]);

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" /></div>;
  if (!order) return null;

  const isActive = order.status === 'queued' || order.status === 'printing';
  const isPending = order.status === 'pending_payment';
  const isCompleted = order.status === 'completed';

  // Calculate progress percentage
  const getProgress = () => {
    switch (order.status) {
      case 'pending_payment': return 10;
      case 'queued': return 30 + (order.queue_position ? Math.max(0, 60 - (order.queue_position * 10)) : 30);
      case 'printing': return 80;
      case 'completed': return 100;
      case 'cancelled': return 0;
      default: return 0;
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    try {
      await api.patch(`/orders/${order.id}/cancel`);
      setOrder({ ...order, status: 'cancelled' });
      updateOrder(order.id, { status: 'cancelled' });
    } catch { /* ignore */ }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')} style={{ marginBottom: 'var(--space-2)' }}>
            ← Back to Orders
          </button>
          <h1>Order {order.order_number}</h1>
          <p>Created on {new Date(order.created_at).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <span className={`badge badge-${order.status}`} style={{ fontSize: 'var(--font-size-sm)', padding: '6px 16px' }}>
          <span className="badge-dot" />
          {getStatusLabel(order.status)}
        </span>
      </div>

      {/* Queue Tracker (shown for active orders) */}
      {isActive && (
        <div className="queue-tracker" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="queue-position">
            {order.status === 'printing' ? (
              <>
                <div className="position-number">🖨️</div>
                <div className="position-label">Currently Printing</div>
              </>
            ) : (
              <>
                <div className="position-number">#{order.queue_position || '—'}</div>
                <div className="position-label">Queue Position</div>
              </>
            )}
          </div>

          <div className="queue-progress">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Progress</span>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{getProgress()}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${getProgress()}%` }} />
            </div>
          </div>

          <div className="queue-eta">
            <div className="eta-item">
              <div className="eta-value">
                {order.estimated_time ? formatTime(order.estimated_time) : '—'}
              </div>
              <div className="eta-label">Estimated Time</div>
            </div>
            <div className="eta-item">
              <div className="eta-value">
                {order.estimated_time
                  ? new Date(Date.now() + order.estimated_time * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </div>
              <div className="eta-label">Ready By</div>
            </div>
          </div>
        </div>
      )}

      {/* Completed success */}
      {isCompleted && (
        <div className="card" style={{ marginBottom: 'var(--space-6)', textAlign: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-3)' }}>✅</div>
          <h3 style={{ fontSize: 'var(--font-size-xl)' }}>Print Completed!</h3>
          <p style={{ color: 'var(--color-text-muted)' }}>Your documents are ready for pickup.</p>
        </div>
      )}

      {/* Pending Payment */}
      {isPending && (
        <div className="card" style={{ marginBottom: 'var(--space-6)', textAlign: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-3)' }}>💳</div>
          <h3>Payment Required</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>Complete payment to add this order to the print queue.</p>
          <button className="btn btn-primary" onClick={() => navigate(`/payment/${order.id}`)}>Pay ₹{order.total_price}</button>
        </div>
      )}

      {/* Order Details Grid */}
      <div className="order-detail-grid">
        <div className="card">
          <div className="card-header"><h3>📄 Document Details</h3></div>
          <div className="card-body">
            <div className="detail-row">
              <span className="label">File Name</span>
              <span className="value">{order.file_name}</span>
            </div>
            <div className="detail-row">
              <span className="label">File Type</span>
              <span className="value">{order.file_type}</span>
            </div>
            <div className="detail-row">
              <span className="label">File Size</span>
              <span className="value">{formatFileSize(order.file_size)}</span>
            </div>
            <div className="detail-row">
              <span className="label">Pages</span>
              <span className="value">{order.page_count}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>⚙️ Print Settings</h3></div>
          <div className="card-body">
            <div className="detail-row">
              <span className="label">Copies</span>
              <span className="value">{order.copies}</span>
            </div>
            <div className="detail-row">
              <span className="label">Print Type</span>
              <span className="value">{order.print_type === 'color' ? '🌈 Color' : '🖤 Black & White'}</span>
            </div>
            <div className="detail-row">
              <span className="label">Page Size</span>
              <span className="value">{order.page_size}</span>
            </div>
            <div className="detail-row">
              <span className="label">Total Price</span>
              <span className="value" style={{ fontWeight: 700, fontSize: 'var(--font-size-md)' }}>₹{order.total_price}</span>
            </div>
            {order.payment_id && (
              <div className="detail-row">
                <span className="label">Payment ID</span>
                <span className="value" style={{ fontSize: 'var(--font-size-xs)' }}>{order.payment_id}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel button */}
      {(isPending || order.status === 'queued') && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <button className="btn btn-danger btn-sm" onClick={handleCancel}>Cancel Order</button>
        </div>
      )}
    </div>
  );
}
