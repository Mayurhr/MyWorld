import { useState, useEffect } from 'react';
import { getSocialLinks, SocialLinkItem } from '../services/portfolioService';
import { DEFAULT_SOCIAL_LINKS } from '../data/portfolioDefaults';

export function useSocialLinks() {
  const [socialLinks, setSocialLinks] = useState<SocialLinkItem[]>(DEFAULT_SOCIAL_LINKS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getSocialLinks(false)
      .then((data) => {
        if (mounted && data && data.length > 0) {
          setSocialLinks(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Error loading social links:', err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { socialLinks, loading };
}
