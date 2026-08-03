import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useOrderStore } from '../store/orderStore';
import { useToastStore } from '../components/Toast';
import type { Order } from '../types';

export default function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { updateOrder } = useOrderStore();
  const addToast = useToastStore((s) => s.addToast);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<'form' | 'processing' | 'success'>('form');

  // Card form state
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [expiryDate, setExpiryDate] = useState('12/28');
  const [cvv, setCvv] = useState('123');
  const [cardName, setCardName] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data } = await api.get(`/orders/${orderId}`);
        setOrder(data.order);
        setLoading(false);
      } catch {
        addToast({ type: 'error', title: 'Order not found' });
        navigate('/orders');
      }
    };
    fetchOrder();
  }, [orderId]);

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length > 2) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  };

  const handlePay = async () => {
    setPhase('processing');
    try {
      const { data } = await api.post('/payments/process', {
        orderId,
        amount: order!.total_price,
        cardNumber: cardNumber.replace(/\s/g, ''),
        expiryDate,
        cvv,
        cardName,
      });
      if (data.success) {
        updateOrder(orderId!, { status: 'queued', payment_id: data.paymentId });
        setPhase('success');
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      setPhase('form');
      addToast({ type: 'error', title: 'Payment Failed', message: err.response?.data?.message || err.message });
    }
  };

  if (loading) {
    return <div className="loading-page"><div className="spinner spinner-lg" /></div>;
  }

  if (!order) return null;

  // Processing animation
  if (phase === 'processing') {
    return (
      <div className="payment-card card" style={{ maxWidth: 500, margin: '2rem auto' }}>
        <div className="payment-processing">
          <div className="processing-animation" />
          <h3>Processing Payment...</h3>
          <p>Please wait while we verify your payment</p>
        </div>
      </div>
    );
  }

  // Success state
  if (phase === 'success') {
    return (
      <div className="payment-card card" style={{ maxWidth: 500, margin: '2rem auto' }}>
        <div className="payment-success">
          <div className="success-icon">✓</div>
          <h2>Payment Successful!</h2>
          <p>Your order <strong>{order.order_number}</strong> has been added to the print queue.</p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate(`/orders/${orderId}`)}>
              Track Order
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/upload')}>
              Print Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Payment form
  return (
    <div>
      <div className="page-header">
        <h1>Payment</h1>
        <p>Complete payment for order {order.order_number}</p>
      </div>

      <div className="payment-card card" style={{ maxWidth: 500, margin: '0 auto' }}>
        <div className="card-body">
          {/* Simulated Badge */}
          <div className="simulated-badge">
            🧪 Simulated Payment Gateway — No real charges will be made
          </div>

          {/* Card Visual */}
          <div className="card-visual">
            <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.7, marginBottom: 'var(--space-6)' }}>SmartPrint Card</div>
            <div className="card-number">{cardNumber || '•••• •••• •••• ••••'}</div>
            <div className="card-details">
              <div>
                <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>CARD HOLDER</div>
                <div>{cardName || 'YOUR NAME'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>EXPIRES</div>
                <div>{expiryDate || 'MM/YY'}</div>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="payment-summary">
            <div className="summary-row">
              <span>Document</span>
              <span>{order.file_name}</span>
            </div>
            <div className="summary-row">
              <span>Pages × Copies</span>
              <span>{order.page_count} × {order.copies}</span>
            </div>
            <div className="summary-row">
              <span>Print Type</span>
              <span>{order.print_type === 'color' ? 'Color' : 'B&W'} · {order.page_size}</span>
            </div>
            <div className="summary-row total">
              <span>Total Amount</span>
              <span>₹{order.total_price}</span>
            </div>
          </div>

          {/* Card Form */}
          <div className="form-group">
            <label className="form-label" htmlFor="cardName">Card Holder Name</label>
            <input
              id="cardName"
              className="form-input"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="John Doe"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="cardNum">Card Number</label>
            <input
              id="cardNum"
              className="form-input"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="4242 4242 4242 4242"
              maxLength={19}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="expiry">Expiry Date</label>
              <input
                id="expiry"
                className="form-input"
                value={expiryDate}
                onChange={(e) => setExpiryDate(formatExpiry(e.target.value))}
                placeholder="MM/YY"
                maxLength={5}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cvv">CVV</label>
              <input
                id="cvv"
                className="form-input"
                type="password"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="•••"
                maxLength={4}
              />
            </div>
          </div>

          <button className="btn btn-primary btn-lg btn-full" onClick={handlePay}>
            🔒 Pay ₹{order.total_price}
          </button>

          <p style={{ textAlign: 'center', marginTop: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            This is a simulated payment. Use the pre-filled test card details.
          </p>
        </div>
      </div>
    </div>
  );
}
