// ============================================================
// Payment Service — Simulated Payment Gateway
// ============================================================

import { v4 as uuidv4 } from 'uuid';

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

/**
 * Simulate payment processing.
 * In production, replace with Stripe/Razorpay SDK.
 */
export async function processPayment(request: PaymentRequest): Promise<PaymentResult> {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Basic validation
  const cardDigits = request.cardNumber.replace(/\s/g, '');

  if (cardDigits.length < 13 || cardDigits.length > 19) {
    return {
      success: false,
      paymentId: '',
      message: 'Invalid card number',
    };
  }

  if (request.amount <= 0) {
    return {
      success: false,
      paymentId: '',
      message: 'Invalid amount',
    };
  }

  // Simulate decline for specific test cards
  if (cardDigits === '4000000000000002') {
    return {
      success: false,
      paymentId: '',
      message: 'Card declined (test decline card)',
    };
  }

  // Success!
  const paymentId = `PAY_${uuidv4().slice(0, 8).toUpperCase()}`;

  console.log(`[Payment] ✓ Payment ${paymentId} processed: ₹${request.amount} for order ${request.orderId}`);

  return {
    success: true,
    paymentId,
    message: 'Payment successful',
  };
}
