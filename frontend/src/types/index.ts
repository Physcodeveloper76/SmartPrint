// ============================================================
// SmartPrint — Shared TypeScript Types
// ============================================================

export type UserRole = 'user' | 'admin';
export type PrintType = 'bw' | 'color';
export type PageSize = 'A4' | 'A3' | 'Letter' | 'Legal';
export type OrderStatus = 'pending_payment' | 'queued' | 'printing' | 'completed' | 'cancelled' | 'printed' | 'downloaded_offline';
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  department?: string;
  quota_limit?: number;
  quota_used?: number;
}

export interface Order {
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
  category?: string;
  printer_name?: string;
  binding_type?: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
}

export interface QueueItem {
  orderId: string;
  orderNumber: string;
  fileName: string;
  pageCount: number;
  copies: number;
  printType: PrintType;
  pageSize: PageSize;
  status: OrderStatus;
  position: number;
  estimatedTime: number;
  userName?: string;
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  activeQueue: number;
  todayRevenue: number;
  totalRevenue: number;
}

export interface PaymentRequest {
  orderId: string;
  amount: number;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardName: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  message: string;
}

export interface UploadFormData {
  file: File | null;
  copies: number;
  printType: PrintType;
  pageSize: PageSize;
}

export interface PricingConfig {
  bwPerPage: number;
  colorPerPage: number;
  a3Multiplier: number;
  legalMultiplier: number;
  letterMultiplier: number;
}

export const PRICING: PricingConfig = {
  bwPerPage: 2,
  colorPerPage: 5,
  a3Multiplier: 1.5,
  legalMultiplier: 1.2,
  letterMultiplier: 1.0,
};

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];

export const FILE_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
};

export function calculatePrice(
  pageCount: number,
  copies: number,
  printType: PrintType,
  pageSize: PageSize
): number {
  const basePrice = printType === 'color' ? PRICING.colorPerPage : PRICING.bwPerPage;
  let sizeMultiplier = 1;
  if (pageSize === 'A3') sizeMultiplier = PRICING.a3Multiplier;
  else if (pageSize === 'Legal') sizeMultiplier = PRICING.legalMultiplier;
  else if (pageSize === 'Letter') sizeMultiplier = PRICING.letterMultiplier;
  return Math.round(basePrice * pageCount * copies * sizeMultiplier * 100) / 100;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}

export function getStatusColor(status: OrderStatus): string {
  switch (status) {
    case 'pending_payment': return 'var(--color-warning)';
    case 'queued': return 'var(--color-info)';
    case 'printing': return 'var(--color-primary)';
    case 'completed':
    case 'printed': return 'var(--color-success)';
    case 'downloaded_offline': return 'var(--color-warning)';
    case 'cancelled': return 'var(--color-danger)';
    default: return 'var(--color-text-muted)';
  }
}

export function getStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'pending_payment': return 'Awaiting Payment';
    case 'queued': return 'In Queue';
    case 'printing': return 'Printing';
    case 'completed': return 'Completed';
    case 'printed': return 'Printed';
    case 'downloaded_offline': return 'Downloaded (Offline)';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}
