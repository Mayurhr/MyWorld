import { useState, useEffect, useCallback } from 'react';
import { Certificate } from '../types';
import { getCertificates } from '../services/portfolioService';
import { fetchAllCertificates, sanitizeCertificates } from '../services/certificateService';
import bundledCertificates from '../data/certificates.json';

interface UseCertificatesResult {
  certificates: Certificate[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCertificates(): UseCertificatesResult {
  const [certificates, setCertificates] = useState<Certificate[]>(() => {
    const initial = sanitizeCertificates(bundledCertificates as Certificate[]);
    return initial;
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Attempt to load published certificates from Firestore
      const liveCerts = await getCertificates(false);
      if (liveCerts && liveCerts.length > 0) {
        setCertificates(liveCerts);
        return;
      }

      // Fallback to static JSON if Firestore is empty
      const data = await fetchAllCertificates();
      setCertificates(data);
    } catch (err) {
      console.warn('Error fetching live certificates, using local authoritative records:', err);
      try {
        const data = await fetchAllCertificates();
        setCertificates(data);
      } catch (fallbackErr) {
        setError('Failed to fetch certificates.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { certificates, loading, error, refresh: loadData };
}
