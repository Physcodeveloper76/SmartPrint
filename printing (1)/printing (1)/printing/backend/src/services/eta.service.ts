// ============================================================
// ETA Service — Estimated Time Algorithm
// ============================================================

import { QueueJob } from '../types';

// Time per page in seconds
const TIME_PER_PAGE = {
  bw: 5,    // 5 seconds per B&W page
  color: 8, // 8 seconds per color page
};

// Size multipliers (larger sizes take longer)
const SIZE_MULTIPLIER: Record<string, number> = {
  A4: 1.0,
  Letter: 1.0,
  A3: 1.3,
  Legal: 1.1,
};

/**
 * Calculate the print time for a single job
 */
export function calculateJobTime(job: QueueJob): number {
  const timePerPage = TIME_PER_PAGE[job.printType] || TIME_PER_PAGE.bw;
  const sizeMultiplier = SIZE_MULTIPLIER[job.pageSize] || 1.0;
  return Math.ceil(job.pageCount * job.copies * timePerPage * sizeMultiplier);
}

/**
 * Calculate ETA for a job at a given position in the queue
 * @param queue - The current queue array
 * @param targetIndex - The index of the job to calculate ETA for
 * @returns Estimated time in seconds until the job completes
 */
export function calculateETA(queue: QueueJob[], targetIndex: number): number {
  let totalTime = 0;

  // Sum up time for all jobs ahead (including the target job itself)
  for (let i = 0; i <= targetIndex && i < queue.length; i++) {
    totalTime += calculateJobTime(queue[i]);
  }

  return totalTime;
}

/**
 * Calculate time until a job at a given position starts printing
 */
export function calculateWaitTime(queue: QueueJob[], targetIndex: number): number {
  let waitTime = 0;

  // Sum up time for all jobs ahead (not including the target job)
  for (let i = 0; i < targetIndex && i < queue.length; i++) {
    waitTime += calculateJobTime(queue[i]);
  }

  return waitTime;
}

/**
 * Suggest shop arrival time (wait time minus travel time)
 * @param waitTimeSeconds - Seconds until the job starts printing
 * @param travelTimeMinutes - Estimated travel time in minutes (default 10)
 */
export function suggestArrivalTime(waitTimeSeconds: number, travelTimeMinutes = 10): Date {
  const arrivalBuffer = Math.max(0, waitTimeSeconds - travelTimeMinutes * 60);
  return new Date(Date.now() + arrivalBuffer * 1000);
}
