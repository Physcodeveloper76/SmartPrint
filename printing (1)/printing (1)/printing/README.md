# SmartPrint Automation System

A full-stack web application for automated document printing with real-time queue tracking, simulated payment processing, and admin controls.

## ✨ Features

### User Panel

- 🔐 User authentication (Sign up / Login via Supabase Auth)
- 📤 Drag & drop file upload (PDF, DOCX, JPG, PNG)
- ⚙️ Print options: copies, B&W/Color, page size (A4/A3/Letter/Legal)
- 📄 Document preview before submission
- 💳 Simulated payment gateway with card visualization
- 📊 Real-time queue position tracking with progress bar
- ⏱️ Estimated print completion time (dynamic ETA)
- 🔔 In-app notification system

### Admin Panel

- 🎛️ Dashboard with stats (orders, revenue, queue length)
- 📋 All orders management with search & filters
- 🖨️ Print queue with real-time updates
- ⬆️ Priority controls (prioritize, cancel)
- 📊 Revenue analytics

## 🛠️ Tech Stack

| Layer     | Technology                             |
| :-------- | :------------------------------------- |
| Frontend  | React 18 + TypeScript + Vite           |
| Styling   | Vanilla CSS (custom design system)     |
| State     | Zustand                                |
| Auth & DB | Supabase (PostgreSQL + Auth + Storage) |
| Backend   | Node.js + Express                      |
| Real-time | Socket.IO                              |
| Queue     | In-memory FIFO with priority support   |
| Payments  | Simulated gateway                      |
| Printing  | Simulated (pluggable interface)        |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration file:
   ```
   supabase/migrations/001_initial.sql
   ```
3. Copy your project **URL**, **anon key**, and **service role key** from **Settings > API**

### 2. Environment Setup

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your Supabase credentials

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your Supabase URL and anon key
```

### 3. Install & Run

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start backend (Terminal 1)
cd backend && npm run dev

# Start frontend (Terminal 2)
cd frontend && npm run dev
```

Visit **http://localhost:5173** to use the app.

### 4. Create Admin User

1. Sign up through the app normally
2. In Supabase SQL Editor, run:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE id = 'YOUR_USER_UUID';
   ```

## 📖 API Documentation

See [docs/api.md](docs/api.md) for full API documentation.

## 🧪 Simulated Payment

The payment gateway is simulated. Use these test details:

- **Card**: `4242 4242 4242 4242`
- **Expiry**: `12/28`
- **CVV**: `123`
- **Decline test**: `4000 0000 0000 0002`

## 🖨️ Print Queue Algorithm

- **FIFO** (First In, First Out) queue with admin priority override
- **ETA Formula**: `totalTime = Σ(pages × copies × timePerPage × sizeMultiplier)`
  - B&W: 5s/page, Color: 8s/page
  - A3: 1.3x, Legal: 1.1x multiplier
- Auto-processes next job when current one completes
- Real-time position and ETA updates via Socket.IO

## 📁 Project Structure

```
printing/
├── frontend/           # React + Vite SPA
│   └── src/
│       ├── components/ # Shared UI (Layout, Sidebar, Header, Toast)
│       ├── hooks/      # Custom hooks (useSocket)
│       ├── lib/        # Supabase, API, Socket clients
│       ├── pages/      # All page components
│       ├── store/      # Zustand stores (auth, orders, notifications)
│       ├── types/      # TypeScript types & utilities
│       └── index.css   # Complete design system
│
├── backend/            # Express API server
│   └── src/
│       ├── config/     # Supabase, env configuration
│       ├── middleware/  # Auth, upload, error handling
│       ├── routes/     # API route handlers
│       ├── services/   # Queue, ETA, Print, Payment, Notifications
│       └── socket/     # Socket.IO server
│
├── supabase/           # Database migrations
├── docs/               # API documentation
└── docker-compose.yml  # Container deployment
```

## 🐳 Docker Deployment

```bash
docker-compose up --build
```

## License

MIT
skjxfbvASHDbvcKLHSJDbvHWSDJKBV
