// ============================================================
// Print Service — Simulated Printer
// ============================================================

import { QueueJob } from '../types';
import { calculateJobTime } from './eta.service';

/**
 * Simulated printer — waits for the estimated print time,
 * then marks the job as complete.
 *
 * In production, replace this with:
 * - `pdf-to-printer` on Windows
 * - CUPS commands on Linux/macOS
 */
export async function simulatePrint(job: QueueJob): Promise<void> {
  const printTime = calculateJobTime(job);

  console.log(`[Printer] ▶ Starting job ${job.orderNumber}`);
  console.log(`  File: ${job.fileName}`);
  console.log(`  Pages: ${job.pageCount} × ${job.copies} copies`);
  console.log(`  Type: ${job.printType} · Size: ${job.pageSize}`);
  console.log(`  Estimated time: ${printTime}s`);

  // Simulate printing with realistic delay
  // Use a faster simulation (1/5th of real time) for development
  const simulatedDelay = Math.min(printTime * 200, 30000); // Cap at 30s for dev

  await new Promise<void>((resolve) => {
    setTimeout(() => {
      console.log(`[Printer] ✓ Completed job ${job.orderNumber}`);
      resolve();
    }, simulatedDelay);
  });
}

/**
 * Interface for a real printer backend.
 * Implement this when connecting to actual printers.
 */
export interface PrinterBackend {
  name: string;
  isAvailable(): Promise<boolean>;
  print(filePath: string, options: {
    copies: number;
    colorMode: 'color' | 'monochrome';
    paperSize: string;
  }): Promise<void>;
}

/**
 * Simulated printer backend
 */
export class SimulatedPrinter implements PrinterBackend {
  name = 'Simulated Printer';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async print(filePath: string, options: any): Promise<void> {
    console.log(`[SimulatedPrinter] Printing ${filePath}`, options);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
