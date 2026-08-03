export type OrderStatus = 'pending_payment' | 'queued' | 'printing' | 'completed' | 'cancelled' | 'printed' | 'downloaded_offline';
export type PrintType = 'bw' | 'color';
export type PageSize = 'A4' | 'A3' | 'Letter' | 'Legal';

export interface OrderRecord {
  id: string;
  user_id: string;
  order_number: string;
  file_name: string;
  file_url: string | null;
  file_path: string | null;
  file_type: string;
  file_size: number;
  page_count: number;
  copies: number;
  print_type: PrintType;
  page_size: PageSize;
  status: OrderStatus;
  queue_position: number | null;
  estimated_time: number | null;
  total_price: number;
  payment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueueJob {
  orderId: string;
  orderNumber: string;
  userId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  pageCount: number;
  copies: number;
  printType: PrintType;
  pageSize: PageSize;
  addedAt: Date;
  priority: number; // lower = higher priority
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
