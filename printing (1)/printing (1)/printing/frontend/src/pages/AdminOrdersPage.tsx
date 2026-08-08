import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { getStatusLabel, type Order, type OrderStatus } from '../types';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const navigate = useNavigate();

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);
      const { data } = await api.get(`/admin/orders?${params}`);
      setOrders(data.orders || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [statusFilter]);

  const statuses: (OrderStatus | 'all')[] = ['all', 'pending_payment', 'queued', 'printing', 'completed', 'cancelled'];

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status: newStatus });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>All Orders</h1>
        <p>Manage and monitor all print orders</p>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search by order number or filename..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
        />
        {statuses.map((s) => (
          <button
            key={s}
            className={`filter-chip ${statusFilter === s ? 'active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'All' : getStatusLabel(s)}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="loading-page"><div className="spinner spinner-lg" /></div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>User</th>
                    <th>File</th>
                    <th>Pages</th>
                    <th>Copies</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{order.order_number}</td>
                      <td style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                        {order.user_id.slice(0, 8)}...
                      </td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--font-size-sm)' }}>
                        {order.file_name}
                      </td>
                      <td>{order.page_count}</td>
                      <td>{order.copies}</td>
                      <td>{order.print_type === 'color' ? '🌈' : '🖤'} {order.page_size}</td>
                      <td style={{ fontWeight: 600 }}>₹{order.total_price}</td>
                      <td>
                        <span className={`badge badge-${order.status}`}>
                          <span className="badge-dot" />
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/orders/${order.id}`)}>
                            View
                          </button>
                          {order.status === 'queued' && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleStatusChange(order.id, 'cancelled')}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                        No orders found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
