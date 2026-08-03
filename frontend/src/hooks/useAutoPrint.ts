/**
 * useAutoPrint — Admin-side auto-download hook
 * =============================================
 * When the logged-in user is an admin, this hook polls the backend every
 * 5 seconds for orders with status "queued". For each new order it hasn't
 * seen before, it:
 *   1. Fetches the file as a Blob (with auth token, so no CORS issues)
 *   2. Creates a temporary object URL
 *   3. Programmatically clicks a hidden <a download> element
 *      → Windows / Chrome downloads the file silently to the default
 *        Downloads folder WITHOUT showing any permission dialog.
 *   4. Revokes the object URL after a short delay
 *   5. Updates the order status to "downloaded_offline" on the backend
 *
 * No printer driver or SumatraPDF required — works with zero physical
 * printer. The user's browser "Save PDF" setting controls where it lands.
 */

import { useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const POLL_INTERVAL_MS = 5000;
const STORAGE_KEY = 'smartprint_auto_downloaded_orders';

/** Load the set of already-downloaded order IDs from localStorage */
function loadDownloaded(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // ignore parse errors
  }
  return new Set();
}

/** Persist the set back to localStorage */
function saveDownloaded(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore quota errors
  }
}

/** Programmatically download a Blob as a file without any dialog */
function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;          // ← key: forces save-to-disk
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Revoke after a short delay so the download can start
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function useAutoPrint() {
  const { profile, isAdmin } = useAuthStore();
  const downloadedRef = useRef<Set<string>>(loadDownloaded());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Only run for admins
    if (!isAdmin()) return;

    const poll = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      try {
        // Fetch all currently queued orders
        const { data } = await axios.get('/api/admin/orders', {
          params: { status: 'queued', limit: '100' },
          headers: { Authorization: `Bearer ${token}` },
        });

        const orders: any[] = data.orders || [];

        for (const order of orders) {
          const orderId: string = order.id;

          // Skip if already downloaded
          if (downloadedRef.current.has(orderId)) continue;

          console.log(`[AutoPrint] New queued order detected: ${order.order_number} — initiating download…`);

          try {
            // Fetch the file as a binary blob (uses auth header)
            const fileRes = await axios.get(`/api/admin/orders/${orderId}/download`, {
              headers: { Authorization: `Bearer ${token}` },
              responseType: 'blob',
            });

            const blob: Blob = fileRes.data;
            const fileName = order.file_name || `order_${order.order_number}.pdf`;

            // Trigger the silent browser download
            triggerBlobDownload(blob, fileName);

            // Mark as downloaded so we don't do it again
            downloadedRef.current.add(orderId);
            saveDownloaded(downloadedRef.current);

            console.log(`[AutoPrint] Download triggered for order ${order.order_number}`);

            // Update order status to downloaded_offline on backend
            try {
              await axios.post(
                '/api/status',
                { jobId: orderId, status: 'downloaded_offline' },
                { headers: { Authorization: `Bearer ${token}` } }
              );
              console.log(`[AutoPrint] Status updated → downloaded_offline for ${order.order_number}`);
            } catch (statusErr) {
              console.warn(`[AutoPrint] Status update failed for ${order.order_number} (file was still downloaded):`, statusErr);
            }
          } catch (dlErr) {
            console.error(`[AutoPrint] Failed to download order ${order.order_number}:`, dlErr);
            // Do NOT add to downloaded set — will retry next poll
          }
        }
      } catch (pollErr) {
        // Network error — silently ignore, retry next tick
        console.warn('[AutoPrint] Poll failed:', pollErr);
      }
    };

    // Kick off immediately, then repeat
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [profile?.role]); // Re-run if role changes (e.g. after login)
}
