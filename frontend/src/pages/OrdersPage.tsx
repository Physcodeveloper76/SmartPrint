import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrderStore } from '../store/orderStore';
import { getStatusLabel, formatFileSize, type OrderStatus } from '../types';

export default function OrdersPage() {
  const { orders, fetchOrders, loading } = useOrderStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  useEffect(() => { fetchOrders(); }, []);

  const filtered = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (search && !o.order_number.toLowerCase().includes(search.toLowerCase()) &&
        !o.file_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const statuses: (OrderStatus | 'all')[] = ['all', 'pending_payment', 'queued', 'printing', 'completed', 'cancelled'];

  return (
    <div>
      <div className="page-header">
        <h1>My Orders</h1>
        <p>View and track all your print orders</p>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search orders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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

      {/* Orders */}
      {loading ? (
        <div className="loading-page"><div className="spinner spinner-lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>{search || statusFilter !== 'all' ? 'No matching orders' : 'No orders yet'}</h3>
            <p>{search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Upload your first document to get started!'}</p>
            {!search && statusFilter === 'all' && (
              <button className="btn btn-primary" onClick={() => navigate('/upload')}>Upload Document</button>
            )}
          </div>
        </div>
      ) : (
        <div className="orders-grid">
          {filtered.map((order) => (
            <div
              key={order.id}
              className="order-card"
              onClick={() => navigate(`/orders/${order.id}`)}
            >
              <div className="order-card-header">
                <span className="order-id">{order.order_number}</span>
                <span className={`badge badge-${order.status}`}>
                  <span className="badge-dot" />
                  {getStatusLabel(order.status)}
                </span>
              </div>
              <div className="order-card-body">
                <div className="file-thumb">
                  {order.file_type.includes('pdf') ? '📄' :
                   order.file_type.includes('image') ? '🖼️' : '📝'}
                </div>
                <div className="order-details">
                  <h4>{order.file_name}</h4>
                  <div className="order-meta">
                    {order.page_count} pages · {order.copies} {order.copies === 1 ? 'copy' : 'copies'} · {order.print_type === 'color' ? 'Color' : 'B&W'} · {order.page_size}
                  </div>
                </div>
              </div>
              <div className="order-card-footer">
                <span className="order-price">₹{order.total_price}</span>
                <span className="order-time">
                  {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
