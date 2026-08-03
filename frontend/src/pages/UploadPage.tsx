import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useOrderStore } from '../store/orderStore';
import { useToastStore } from '../components/Toast';
import api from '../lib/api';
import {
  FILE_TYPE_LABELS,
  formatFileSize, type PrintType, type PageSize
} from '../types';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [copies, setCopies] = useState(1);
  const [printType, setPrintType] = useState<PrintType>('bw');
  const [pageSize, setPageSize] = useState<PageSize>('A4');
  const [pageCount, setPageCount] = useState(1);
  const [category, setCategory] = useState('assignment');
  const [printerName, setPrinterName] = useState('Library Desk');
  const [bindingType, setBindingType] = useState('none');
  const [submitting, setSubmitting] = useState(false);

  // Inline payment state
  const [payPhase, setPayPhase] = useState<'upload' | 'payment' | 'processing' | 'success'>('upload');
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [expiryDate, setExpiryDate] = useState('12/28');
  const [cvv, setCvv] = useState('123');
  const [cardName, setCardName] = useState('');

  const { createOrder, updateOrder } = useOrderStore();
  const addToast = useToastStore((s) => s.addToast);
  const navigate = useNavigate();

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      const f = accepted[0];
      setFile(f);

      // Generate preview for images
      if (f.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result as string);
        reader.readAsDataURL(f);
      } else {
        setPreview(null);
      }

      // Estimate page count based on file size
      if (f.type === 'application/pdf') {
        setPageCount(Math.max(1, Math.ceil(f.size / 100000)));
      } else if (f.type.startsWith('image/')) {
        setPageCount(1);
      } else {
        setPageCount(Math.max(1, Math.ceil(f.size / 50000)));
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: 25 * 1024 * 1024,
    maxFiles: 1,
    onDropRejected: (rejections) => {
      const msg = rejections[0]?.errors?.[0]?.message || 'File rejected';
      addToast({ type: 'error', title: 'Upload Error', message: msg });
    },
  });

  // Calculate local price incorporating binding options
  const basePrice = printType === 'color' ? 5 : 2;
  const sizeMultiplier = pageSize === 'A3' ? 1.5 : pageSize === 'Legal' ? 1.2 : 1;
  const bindingCost = bindingType === 'spiral' ? 20 : bindingType === 'hardcover' ? 50 : 0;
  const totalPrice = Math.round(((basePrice * pageCount * copies * sizeMultiplier) + bindingCost) * 100) / 100;

  const getFileExtension = (name: string) => name.split('.').pop()?.toLowerCase() || '';

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length > 2) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  };

  // Step 1: Create order then show inline payment panel
  const handleProceedToPayment = async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('copies', String(copies));
      formData.append('printType', printType);
      formData.append('pageSize', pageSize);
      formData.append('pageCount', String(pageCount));
      formData.append('category', category);
      formData.append('printerName', printerName);
      formData.append('bindingType', bindingType);

      const order = await createOrder(formData);
      setCreatedOrderId(order.id);
      setCreatedOrderNumber(order.order_number);
      // No navigation — show inline payment panel
      setPayPhase('payment');
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Submission Failed',
        message: err.response?.data?.message || 'Verification or network error.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async () => {
    if (!createdOrderId) return;
    setPayPhase('processing');
    try {
      const { data } = await api.post('/payments/process', {
        orderId: createdOrderId,
        amount: totalPrice,
        cardNumber: cardNumber.replace(/\s/g, ''),
        expiryDate,
        cvv,
        cardName,
      });

      if (data.success) {
        updateOrder(createdOrderId, { status: 'queued', payment_id: data.paymentId });
        addToast({
          type: 'success',
          title: 'Payment Successful!',
          message: `Order ${createdOrderNumber} added to print queue.`,
        });
        setPayPhase('success');
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      setPayPhase('payment');
      addToast({
        type: 'error',
        title: 'Payment Failed',
        message: err.response?.data?.message || err.message,
      });
    }
  };

  if (payPhase === 'success') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div className="card-body" style={{ padding: 'var(--space-10)' }}>
            <div style={{ fontSize: '4rem', marginBottom: 'var(--space-4)' }}>✅</div>
            <h2 style={{ marginBottom: 'var(--space-2)' }}>Payment Successful!</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
              Order <strong>{createdOrderNumber}</strong> has been added to the print queue.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => navigate(`/orders/${createdOrderId}`)}>
                Track Order
              </button>
              <button className="btn btn-secondary" onClick={() => {
                setPayPhase('upload');
                setFile(null);
                setPreview(null);
                setCreatedOrderId(null);
                setCreatedOrderNumber(null);
                setCopies(1);
                setPrintType('bw');
                setPageSize('A4');
                setPageCount(1);
                setCategory('assignment');
                setPrinterName('Library Desk');
                setBindingType('none');
                setCardName('');
              }}>
                Print Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (payPhase === 'processing') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: 480, width: '100%' }}>
          <div className="payment-processing">
            <div className="processing-animation" />
            <h3>Processing Payment...</h3>
            <p>Please wait while we verify your payment</p>
          </div>
        </div>
      </div>
    );
  }

  if (payPhase === 'payment') {
    return (
      <div>
        <div className="page-header">
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: 'var(--space-2)' }}
            onClick={() => setPayPhase('upload')}
          >
            ← Back to Upload
          </button>
          <h1>Complete Payment</h1>
          <p>Order <strong>{createdOrderNumber}</strong> — Total ₹{totalPrice.toFixed(2)}</p>
        </div>

        <div className="payment-card card" style={{ maxWidth: 500, margin: '0 auto' }}>
          <div className="card-body">
            <div className="simulated-badge">
              🧪 Simulated Payment Gateway — No real charges will be made
            </div>

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

            <div className="payment-summary">
              <div className="summary-row">
                <span>Document</span>
                <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file?.name}</span>
              </div>
              <div className="summary-row">
                <span>Pages × Copies</span>
                <span>{pageCount} × {copies}</span>
              </div>
              <div className="summary-row">
                <span>Print Type</span>
                <span>{printType === 'color' ? 'Color' : 'B&W'} · {pageSize}</span>
              </div>
              {bindingCost > 0 && (
                <div className="summary-row">
                  <span>Binding</span>
                  <span>+₹{bindingCost}</span>
                </div>
              )}
              <div className="summary-row total">
                <span>Total Amount</span>
                <span>₹{totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cardName">Card Holder Name</label>
              <input
                id="cardName"
                className="form-input"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="John Doe"
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
              🔒 Pay ₹{totalPrice.toFixed(2)}
            </button>

            <p style={{ textAlign: 'center', marginTop: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              This is a simulated payment. Use the pre-filled test card details.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Submit Document to Queue</h1>
        <p>Upload your academic report or workspace files, customize printer settings, and binding styles.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--space-6)', alignItems: 'start' }}>
        <div>
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="card-body">
              <div
                {...getRootProps()}
                className={`upload-zone ${isDragActive ? 'drag-active' : ''}`}
              >
                <input {...getInputProps()} />
                <div className="upload-icon">📁</div>
                <h3>{isDragActive ? 'Drop your document here!' : 'Drag & drop assignment PDF / Image'}</h3>
                <p>or <span className="browse-link">browse system files</span></p>
                <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
                  Supported: PDF, DOCX, JPG, PNG · Max 25MB
                </p>
              </div>

              {file && (
                <div className="file-preview">
                  <div className={`file-icon ${getFileExtension(file.name)}`}>
                    {file.type === 'application/pdf' ? '📄' :
                     file.type.startsWith('image/') ? '🖼️' : '📝'}
                  </div>
                  <div className="file-info">
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">
                      {formatFileSize(file.size)} · {FILE_TYPE_LABELS[file.type] || 'Unknown'} · ~{pageCount} {pageCount === 1 ? 'page' : 'pages'}
                    </div>
                  </div>
                  <button className="file-remove" onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}>✕</button>
                </div>
              )}

              {preview && (
                <div style={{
                  marginTop: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  border: '1px solid var(--color-border)',
                  maxHeight: 300,
                }}>
                  <img src={preview} alt="Preview" style={{ width: '100%', objectFit: 'contain', maxHeight: 300 }} />
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>⚙️ Campus Print Hub Settings</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="category">Document Category</label>
                  <select
                    id="category"
                    className="form-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="assignment">🎓 Class Assignment</option>
                    <option value="lab_manual">🧪 Lab Manual / Report</option>
                    <option value="thesis">📚 Thesis / Project Report</option>
                    <option value="office">💼 Administrative Form</option>
                    <option value="other">📝 Other Document</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="printerName">Select Campus Printer</label>
                  <select
                    id="printerName"
                    className="form-select"
                    value={printerName}
                    onChange={(e) => setPrinterName(e.target.value)}
                  >
                    <option value="Library Desk">Library 1st Floor Printer</option>
                    <option value="CS Department Lab">CS Lab (Turing Hall)</option>
                    <option value="Student Center Lounge">Student Center Lounge</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="pageCount">Estimated Page Count</label>
                  <input
                    id="pageCount"
                    type="number"
                    className="form-input"
                    value={pageCount}
                    onChange={(e) => setPageCount(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    max={500}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="copies">Number of Copies</label>
                  <input
                    id="copies"
                    type="number"
                    className="form-input"
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    max={100}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                <label className="form-label" htmlFor="bindingType">Post-Print Binding Options</label>
                <select
                  id="bindingType"
                  className="form-select"
                  value={bindingType}
                  onChange={(e) => setBindingType(e.target.value)}
                >
                  <option value="none">None (Loose sheets)</option>
                  <option value="stapled">Stapled (Top-left corner)</option>
                  <option value="spiral">Spiral Binding (+₹20.00)</option>
                  <option value="hardcover">Hardcover Book Binding (+₹50.00)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                <label className="form-label">Color Mode Selection</label>
                <div className="form-radio-group">
                  <div
                    className={`form-radio-card ${printType === 'bw' ? 'selected' : ''}`}
                    onClick={() => setPrintType('bw')}
                  >
                    <input type="radio" name="printType" checked={printType === 'bw'} readOnly />
                    <div className="radio-label">🖤 Black & White</div>
                    <div className="radio-desc">₹2.00 / page</div>
                  </div>
                  <div
                    className={`form-radio-card ${printType === 'color' ? 'selected' : ''}`}
                    onClick={() => setPrintType('color')}
                  >
                    <input type="radio" name="printType" checked={printType === 'color'} readOnly />
                    <div className="radio-label">🌈 Color Print</div>
                    <div className="radio-desc">₹5.00 / page</div>
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                <label className="form-label" htmlFor="pageSize">Paper Page Size</label>
                <select
                  id="pageSize"
                  className="form-select"
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as PageSize)}
                >
                  <option value="A4">A4 (Standard academic sheet)</option>
                  <option value="A3">A3 (Drawing/Design sheet — 1.5× price)</option>
                  <option value="Letter">Letter size</option>
                  <option value="Legal">Legal size (1.2× price)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ position: 'sticky', top: 'calc(var(--header-height) + var(--space-8))' }}>
          <div className="card-header">
            <h3>📋 Order Summary</h3>
          </div>
          <div className="card-body">
            {file ? (
              <>
                <div className="detail-section">
                  <div className="detail-row">
                    <span className="label">File</span>
                    <span className="value" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Category</span>
                    <span className="value" style={{ textTransform: 'capitalize' }}>{category.replace('_', ' ')}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Printer</span>
                    <span className="value">{printerName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Pages</span>
                    <span className="value">{pageCount}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Copies</span>
                    <span className="value">{copies}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Type</span>
                    <span className="value">{printType === 'color' ? 'Color' : 'Black & White'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Size</span>
                    <span className="value">{pageSize}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Binding</span>
                    <span className="value" style={{ textTransform: 'capitalize' }}>{bindingType}</span>
                  </div>
                </div>

                <div className="payment-summary" style={{ margin: 'var(--space-4) 0' }}>
                  <div className="summary-row">
                    <span>Base Print Cost</span>
                    <span>{pageCount} × ₹{printType === 'color' ? 5 : 2}</span>
                  </div>
                  <div className="summary-row">
                    <span>Copies Multiplier</span>
                    <span>× {copies}</span>
                  </div>
                  {pageSize !== 'A4' && pageSize !== 'Letter' && (
                    <div className="summary-row">
                      <span>Size multiplier</span>
                      <span>× {pageSize === 'A3' ? '1.5' : '1.2'}</span>
                    </div>
                  )}
                  {bindingCost > 0 && (
                    <div className="summary-row">
                      <span>Binding Charge</span>
                      <span>+ ₹{bindingCost.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="summary-row total">
                    <span>Total Cost</span>
                    <span>₹{totalPrice.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-lg btn-full"
                  onClick={handleProceedToPayment}
                  disabled={submitting}
                >
                  {submitting ? (
                    <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Submitting Order...</>
                  ) : (
                    <>💳 Proceed to Payment — ₹{totalPrice.toFixed(2)}</>
                  )}
                </button>
              </>
            ) : (
              <div className="empty-state" style={{ padding: 'var(--space-8) 0' }}>
                <div className="empty-icon">📎</div>
                <h3>No file selected</h3>
                <p>Upload a document to display pricing breakdown.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .page-content > div > div:first-child {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
