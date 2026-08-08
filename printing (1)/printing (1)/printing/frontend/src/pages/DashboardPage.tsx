import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useOrderStore } from '../store/orderStore';
import { getStatusLabel } from '../types';

export default function DashboardPage() {
  const { profile } = useAuthStore();
  const { orders, fetchOrders, loading } = useOrderStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Separate admin and user views: redirect admin to portal automatically
    if (profile?.role === 'admin') {
      navigate('/admin', { replace: true });
    } else {
      fetchOrders();
    }
  }, [profile]);

  const activeOrders = orders.filter((o) => o.status === 'queued' || o.status === 'printing');
  const completedOrders = orders.filter((o) => o.status === 'completed');
  const pendingPayments = orders.filter((o) => o.status === 'pending_payment');

  const quotaLimit = profile?.quota_limit || 100;
  const quotaUsed = profile?.quota_used || 0;
  const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
  const quotaPercentage = Math.min(100, (quotaUsed / quotaLimit) * 100);

  // Campus Printer List
  const campusPrinters = [
    { name: 'Library 1st Floor Printer', location: 'Main Library Room 102', status: 'active', queue: 2 },
    { name: 'CS Department Lab Printer', location: 'Turing Hall Lab 2A', status: 'active', queue: 0 },
    { name: 'Staff Administrative Printer', location: 'Admin Block Ground Floor', status: 'maintenance', queue: 0 },
    { name: 'Student Center Lounge Printer', location: 'Student Hub Cafeteria Annex', status: 'active', queue: 4 }
  ];

  return (
    <div>
      {/* Welcome & Academic Banner */}
      <div className="welcome-banner" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary-light)', fontWeight: 700 }}>
              🏫 Academic Workspace
            </span>
            <h2 style={{ marginTop: 'var(--space-1)' }}>Welcome back, {profile?.full_name || 'Student'}!</h2>
            <p style={{ opacity: 0.8, fontSize: 'var(--font-size-sm)', maxWidth: '600px' }}>
              Connected to **{profile?.department || 'General'} Department**. Submit assignments, lab reports, and theses to campus printers with automated tracking.
            </p>
          </div>
          <button className="btn" style={{ background: 'var(--color-surface)', color: 'var(--color-primary-dark)', fontWeight: 600 }} onClick={() => navigate('/upload')}>
            📤 Submit Printing Job
          </button>
        </div>
      </div>

      {/* Quota Progress Tracker & Printer Status Board */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)', alignItems: 'stretch' }}>
        {/* Quota Tracker */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <h4 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              🎓 Printing Page Quota
            </h4>
            <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              {quotaUsed} / {quotaLimit} pages used
            </span>
          </div>
          <div style={{ background: 'var(--color-border)', borderRadius: 'var(--radius-full)', height: '12px', width: '100%', overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
            <div style={{
              width: `${quotaPercentage}%`,
              background: quotaPercentage > 90 ? 'var(--color-danger)' : quotaPercentage > 75 ? 'var(--color-warning)' : 'var(--color-primary)',
              height: '100%',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.4s ease-in-out'
            }} />
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
            Remaining semester quota: <strong>{quotaRemaining} pages</strong>. Quotas reset at the start of next semester.
          </p>
        </div>

        {/* Printer Status */}
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <h4 style={{ fontWeight: 700, marginBottom: 'var(--space-3)' }}>
            🖨️ Campus Printer Status
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {campusPrinters.map((printer) => (
              <div key={printer.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-xs)', padding: 'var(--space-2)', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <span style={{ fontWeight: 600, display: 'block' }}>{printer.name}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{printer.location}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {printer.status === 'active' ? (
                    <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>● Active ({printer.queue} in queue)</span>
                  ) : (
                    <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>🛠️ Maintenance</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stat-card">
          <div className="stat-icon primary">📋</div>
          <div className="stat-info">
            <h3>{orders.length}</h3>
            <p>Total Print Jobs</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon info">⚡</div>
          <div className="stat-info">
            <h3>{activeOrders.length}</h3>
            <p>Active Prints</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success">✅</div>
          <div className="stat-info">
            <h3>{completedOrders.length}</h3>
            <p>Completed Prints</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning">💳</div>
          <div className="stat-info">
            <h3>{pendingPayments.length}</h3>
            <p>Unpaid Orders</p>
          </div>
        </div>
      </div>

      {/* Active Orders */}
      {activeOrders.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="card-header">
            <h3>⚙️ Live Print Queue Jobs</h3>
          </div>
          <div className="card-body">
            <div className="queue-list">
              {activeOrders.map((order) => (
                <div
                  key={order.id}
                  className={`queue-item ${order.status === 'printing' ? 'printing' : ''}`}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="queue-number">
                    {order.status === 'printing' ? '⚙️' : `#${order.queue_position || '-'}`}
                  </div>
                  <div className="queue-info">
                    <h4>{order.file_name}</h4>
                    <p style={{ fontSize: 'var(--font-size-xs)' }}>
                      <strong>Category:</strong> {order.category || 'Assignment'} · <strong>Printer:</strong> {order.printer_name || 'Library Desk'} · <strong>Binding:</strong> {order.binding_type || 'none'}
                    </p>
                    <p style={{ marginTop: '2px' }}>
                      {order.copies} {order.copies === 1 ? 'copy' : 'copies'} · {order.print_type === 'color' ? 'Color' : 'B&W'} · {order.page_size}
                      {order.estimated_time ? ` · ETA: ${Math.ceil(order.estimated_time / 60)} min` : ''}
                    </p>
                  </div>
                  <span className={`badge badge-${order.status}`}>
                    <span className="badge-dot" />
                    {getStatusLabel(order.status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pending Payments */}
      {pendingPayments.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="card-header">
            <h3>⏳ Awaiting Payment</h3>
          </div>
          <div className="card-body">
            {pendingPayments.map((order) => (
              <div key={order.id} className="queue-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/payment/${order.id}`)}>
                <div className="queue-number">💳</div>
                <div className="queue-info">
                  <h4>{order.file_name}</h4>
                  <p>Category: {order.category || 'Assignment'} · Total pages: {order.page_count * order.copies} · ₹{order.total_price}</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/payment/${order.id}`); }}>
                  Pay & Queue Print
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="card">
        <div className="card-header">
          <h3>📦 Print History Log</h3>
          {orders.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>View All Log →</button>
          )}
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-page" style={{ minHeight: 150 }}>
              <div className="spinner" />
            </div>
          ) : orders.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-icon">📭</div>
              <h3>No jobs logged</h3>
              <p>Submit your first PDF assignment or report to begin printing!</p>
              <button className="btn btn-primary" onClick={() => navigate('/upload')}>Submit Print Job</button>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Order No.</th>
                    <th>Document</th>
                    <th>Config</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 5).map((order) => (
                    <tr key={order.id} onClick={() => navigate(`/orders/${order.id}`)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{order.order_number}</td>
                      <td>
                        <span style={{ fontWeight: 500, display: 'block' }}>{order.file_name}</span>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{order.category || 'Assignment'}</span>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                        {order.page_count}pg × {order.copies} · {order.print_type === 'color' ? 'Color' : 'B&W'} · {order.binding_type !== 'none' ? `Binding: ${order.binding_type}` : 'No Binding'}
                      </td>
                      <td style={{ fontWeight: 600 }}>₹{order.total_price}</td>
                      <td>
                        <span className={`badge badge-${order.status}`}>
                          <span className="badge-dot" />
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
