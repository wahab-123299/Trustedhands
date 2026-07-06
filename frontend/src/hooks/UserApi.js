import { useState, useEffect, useRef } from 'react';

const useApi = (url, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(url, {
          ...options,
          signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          credentials: 'include',
        });

        if (signal.aborted) return;

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (!signal.aborted) {
          setData(result);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('[useApi] Request aborted:', url);
          return;
        }
        setError(err.message);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };

    if (url) {
      fetchData();
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [url, JSON.stringify(options)]);

  return { data, loading, error };
};

export default useApi;