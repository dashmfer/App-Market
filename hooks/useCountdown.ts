"use client";

import { useState, useEffect, useCallback } from "react";

interface CountdownResult {
  timeLeft: string;
  isExpired: boolean;
  isEndingSoon: boolean;
  totalSeconds: number;
}

/**
 * Custom hook for real-time countdown that updates every second
 * @param endTime - The target end time (Date object or ISO string)
 * @param endingSoonThreshold - Milliseconds threshold for "ending soon" (default: 24 hours)
 */
export function useCountdown(
  endTime: Date | string | undefined | null,
  endingSoonThreshold: number = 24 * 60 * 60 * 1000 // 24 hours
): CountdownResult {
  const getTimeLeft = useCallback((): CountdownResult => {
    if (!endTime) {
      return { timeLeft: "No end time", isExpired: true, isEndingSoon: false, totalSeconds: 0 };
    }

    const endDate = typeof endTime === "string" ? new Date(endTime) : endTime;
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();

    if (diff <= 0) {
      return { timeLeft: "Ended", isExpired: true, isEndingSoon: false, totalSeconds: 0 };
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    let timeLeft: string;

    if (days > 0) {
      timeLeft = days === 1 ? "1 day" : `${days} days`;
    } else if (hours > 0) {
      timeLeft = hours === 1 ? "1 hour" : `${hours} hours`;
      if (minutes > 0) {
        timeLeft += ` ${minutes}m`;
      }
    } else if (minutes > 0) {
      timeLeft = `${minutes}m ${seconds}s`;
    } else {
      timeLeft = `${seconds}s`;
    }

    const isEndingSoon = diff < endingSoonThreshold;

    return { timeLeft, isExpired: false, isEndingSoon, totalSeconds };
  }, [endTime, endingSoonThreshold]);

  const [countdown, setCountdown] = useState<CountdownResult>(getTimeLeft);

  useEffect(() => {
    // Update immediately
    setCountdown(getTimeLeft());

    // Update every second
    const interval = setInterval(() => {
      const result = getTimeLeft();
      setCountdown(result);

      // Clear interval if expired
      if (result.isExpired) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [getTimeLeft]);

  return countdown;
}
