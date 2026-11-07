import { useState, useEffect } from 'react';
import { getResume, ResumeData } from '../services/portfolioService';

export function useResume() {
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getResume()
      .then((data) => {
        if (mounted) {
          setResume(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Error loading resume:', err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { resume, loading };
}
