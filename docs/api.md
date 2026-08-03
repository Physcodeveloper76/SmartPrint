# SmartPrint API Documentation

Base URL: `http://localhost:3001/api`

All protected endpoints require `Authorization: Bearer <supabase_jwt>` header.

---

## Health Check

### `GET /health`
Returns server status.

**Response:**
```json
{ "status": "ok", "timestamp": "2026-07-12T06:00:00.000Z" }
```

---

## Orders

### `POST /orders`
Create a new print order with file upload.

**Auth:** Required  
**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | ✅ | PDF, DOCX, JPG, or PNG (max 25MB) |
| copies | number | ❌ | Number of copies (default: 1) |
| printType | string | ❌ | `bw` or `color` (default: `bw`) |
| pageSize | string | ❌ | `A4`, `A3`, `Letter`, `Legal` (default: `A4`) |
| pageCount | number | ❌ | Number of pages (default: 1) |

**Response (201):**
```json
{
  "order": {
    "id": "uuid",
    "order_number": "SP-ABC123-XYZ",
    "file_name": "document.pdf",
    "status": "pending_payment",
    "total_price": 10.00,
    ...
  }
}
```

---

### `GET /orders`
List all orders for the authenticated user.

**Auth:** Required

**Response (200):**
```json
{ "orders": [ { ...order }, { ...order } ] }
```

---

### `GET /orders/:id`
Get a single order by ID.

**Auth:** Required (owner or admin)

**Response (200):**
```json
{ "order": { ...order } }
```

---

### `PATCH /orders/:id/cancel`
Cancel an order (only if `pending_payment` or `queued`).

**Auth:** Required (owner or admin)

**Response (200):**
```json
{ "message": "Order cancelled" }
```

---

## Payments

### `POST /payments/process`
Process a simulated payment.

**Auth:** Required

**Body:**
```json
{
  "orderId": "uuid",
  "amount": 10.00,
  "cardNumber": "4242424242424242",
  "expiryDate": "12/28",
  "cvv": "123",
  "cardName": "John Doe"
}
```

**Response (200):**
```json
{
  "success": true,
  "paymentId": "PAY_ABC12345",
  "message": "Payment successful. Order added to print queue."
}
```

---

## Admin

All admin endpoints require admin role.

### `GET /admin/dashboard`
Get dashboard statistics.

**Response (200):**
```json
{
  "stats": {
    "totalOrders": 42,
    "pendingOrders": 3,
    "completedOrders": 35,
    "activeQueue": 4,
    "todayRevenue": 250.00,
    "totalRevenue": 5420.00
  }
}
```

---

### `GET /admin/orders`
List all orders with optional filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| status | string | Filter by status |
| search | string | Search order number or filename |
| limit | number | Max results (default: 50) |

---

### `GET /admin/queue`
Get current print queue state.

**Response (200):**
```json
{
  "queue": [
    {
      "orderId": "uuid",
      "orderNumber": "SP-ABC123",
      "fileName": "doc.pdf",
      "pageCount": 5,
      "copies": 2,
      "printType": "bw",
      "pageSize": "A4",
      "status": "printing",
      "position": 0,
      "estimatedTime": 50
    }
  ]
}
```

---

### `PATCH /admin/orders/:id/status`
Update order status.

**Body:**
```json
{ "status": "completed" }
```

---

### `POST /admin/orders/:id/prioritize`
Move an order to the front of the queue.

---

### `POST /admin/orders/:id/cancel`
Cancel an order and remove from queue.

---

## Socket.IO Events

### Client → Server
Connect with: `io(url, { auth: { token: jwt } })`

### Server → Client

| Event | Data | Description |
|-------|------|-------------|
| `order:status` | `{ orderId, status, queuePosition?, estimatedTime? }` | Order status changed |
| `queue:update` | `{ orderId, position, estimatedTime }` | Queue position updated |
| `notification` | `{ id, title, message, type, read, created_at }` | New notification |

---

## Pricing

| Print Type | Base Price |
|-----------|-----------|
| B&W | ₹2/page |
| Color | ₹5/page |

| Page Size | Multiplier |
|-----------|-----------|
| A4 | 1.0× |
| Letter | 1.0× |
| A3 | 1.5× |
| Legal | 1.2× |

**Formula:** `total = basePrice × pages × copies × sizeMultiplier`
