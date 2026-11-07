import { useState, useEffect } from 'react';
import { getQualifications, QualificationItem } from '../services/portfolioService';
import { DEFAULT_QUALIFICATIONS } from '../data/portfolioDefaults';

export function useQualifications() {
  const [qualifications, setQualifications] = useState<QualificationItem[]>(DEFAULT_QUALIFICATIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getQualifications(false)
      .then((data) => {
        if (mounted && data && data.length > 0) {
          setQualifications(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Error loading qualifications:', err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { qualifications, loading };
}
