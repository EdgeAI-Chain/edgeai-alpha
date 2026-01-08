import { useState, useEffect, useRef, useCallback } from 'react';

interface UseSmartPollingOptions {
  interval?: number;      // Normal polling interval in ms (default: 5000)
  maxRetries?: number;    // Max consecutive retries before pausing (default: 5)
  backoffFactor?: number; // Multiplier for backoff delay (default: 2)
  maxDelay?: number;      // Max delay in ms during backoff (default: 30000)
}

export function useSmartPolling<T>(
  fetchFn: () => Promise<T>,
  options: UseSmartPollingOptions = {}
) {
  const {
    interval = 5000,
    maxRetries = 5,
    backoffFactor = 2,
    maxDelay = 30000
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPolling, setIsPolling] = useState<boolean>(true);
  
  // Refs to keep track of state without triggering re-renders
  const retryCountRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const executePoll = useCallback(async () => {
    if (!mountedRef.current || !isPolling) return;

    try {
      const result = await fetchFn();
      
      if (mountedRef.current) {
        setData(result);
        setError(null);
        setLoading(false);
        retryCountRef.current = 0; // Reset retry count on success
        
        // Schedule next poll with normal interval
        timeoutRef.current = setTimeout(executePoll, interval);
      }
    } catch (err) {
      if (mountedRef.current) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        setLoading(false);
        
        // Calculate backoff delay
        retryCountRef.current += 1;
        
        if (retryCountRef.current <= maxRetries) {
          const delay = Math.min(
            interval * Math.pow(backoffFactor, retryCountRef.current - 1),
            maxDelay
          );
          console.warn(`Polling failed. Retrying in ${delay}ms (Attempt ${retryCountRef.current}/${maxRetries})`);
          timeoutRef.current = setTimeout(executePoll, delay);
        } else {
          console.error('Max polling retries reached. Stopping polling.');
          setIsPolling(false);
        }
      }
    }
  }, [fetchFn, interval, maxRetries, backoffFactor, maxDelay, isPolling]);

  // Start/Stop polling
  useEffect(() => {
    mountedRef.current = true;
    
    if (isPolling) {
      executePoll();
    }

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [executePoll, isPolling]);

  // Manual retry function
  const retry = useCallback(() => {
    retryCountRef.current = 0;
    setIsPolling(true);
    setLoading(true);
    // executePoll will be triggered by the useEffect dependency change on isPolling
    // or if already polling, we might want to clear timeout and start immediately
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    executePoll();
  }, [executePoll]);

  return { data, error, loading, isPolling, retry };
}
