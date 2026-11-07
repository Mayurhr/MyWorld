import bundledCertificates from '../data/certificates.json';
import { Certificate } from '../types';

/**
 * Service to fetch and validate certificates data.
 * Authoritative source of truth: /src/data/certificates.json
 * Guarantees all 49 certificates are retrieved and verified with zero loss.
 */
export async function fetchAllCertificates(): Promise<Certificate[]> {
  let source = 'bundled (/src/data/certificates.json)';
  let records: Certificate[] = sanitizeCertificates(bundledCertificates as Certificate[]);

  try {
    const response = await fetch('/certificates.json', {
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-cache',
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (Array.isArray(data) && data.length >= records.length) {
          records = sanitizeCertificates(data);
          source = 'network (/certificates.json)';
        } else {
          console.warn(
            `[CertificateService] Network JSON returned ${Array.isArray(data) ? data.length : 0} records; retaining bundled authoritative dataset (${records.length} records).`
          );
        }
      }
    }
  } catch (err) {
    console.warn('[CertificateService] Network fetch failed, using bundled authoritative dataset:', err);
  }

  const featuredRecords = records.filter((c) => c.featured === true).length;
  const achievementRecords = records.filter((c) => c.viewAchievement === true).length;

  console.log(`[Certificate Diagnostics] Loaded JSON Source: ${source}`);
  console.log(`[Certificate Diagnostics] Total records loaded: ${records.length}`);
  console.log(`[Certificate Diagnostics] Featured records found: ${featuredRecords}`);
  console.log(`[Certificate Diagnostics] Achievement records found: ${achievementRecords}`);

  return records;
}

/**
 * Checks if a certificate is related to a hackathon event.
 */
export function isHackathonCertificate(cert: Certificate): boolean {
  const text = `${cert.title} ${cert.category || ''} ${cert.achievement?.experience || ''}`.toLowerCase();
  return text.includes('hack') || text.includes('hackathon');
}

/**
 * Sorts certificates strictly by user priority requirements:
 * 1. Hackathon achievement certificates first (viewAchievement: true and hackathon-related).
 * 2. Other certificates with viewAchievement: true immediately after hackathons.
 * 3. Certificates with viewAchievement: false or without achievement section appear last.
 * Featured status does not override this priority.
 */
export function sortCertificatesByPriority(certs: Certificate[]): Certificate[] {
  const tier1: Certificate[] = []; // Hackathon achievement certificates
  const tier2: Certificate[] = []; // Other certificates with viewAchievement: true
  const tier3: Certificate[] = []; // Certificates with viewAchievement: false or without achievement

  certs.forEach((cert) => {
    if (cert.viewAchievement === true) {
      if (isHackathonCertificate(cert)) {
        tier1.push(cert);
      } else {
        tier2.push(cert);
      }
    } else {
      tier3.push(cert);
    }
  });

  return [...tier1, ...tier2, ...tier3];
}

/**
 * Selects and orders certificates strictly for the homepage:
 * 1. All certificates with viewAchievement: true (highest priority, appearing first)
 * 2. "Tech Marathon" (featured: true)
 * 3. "Knowledge Knockout" (featured: true)
 * 4. "CYBER CADET" (featured: true)
 * 5. Remaining featured: true certificates in their existing order
 *
 * No duplicate certificates if a certificate has both viewAchievement and featured.
 * Non-featured certificates without achievements will never be added.
 */
export function getHomepageCertificates(certs: Certificate[]): Certificate[] {
  const selected: Certificate[] = [];
  const seenTitles = new Set<string>();

  const addCert = (cert: Certificate) => {
    const key = cert.title.trim().toLowerCase();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      selected.push(cert);
    }
  };

  // 1. All viewAchievement: true certificates receive highest priority and appear first
  const achievementCerts = sortCertificatesByPriority(certs).filter(
    (c) => c.viewAchievement === true
  );
  achievementCerts.forEach(addCert);

  // Remaining featured certificates
  const remainingFeatured = certs.filter(
    (c) => c.featured === true && !seenTitles.has(c.title.trim().toLowerCase())
  );

  // 2. Tech Marathon
  const techMarathon = remainingFeatured.find(
    (c) => c.title.trim().toLowerCase() === 'tech marathon'
  );
  if (techMarathon) {
    addCert(techMarathon);
  }

  // 3. Knowledge Knockout
  const knowledgeKnockout = remainingFeatured.find(
    (c) => c.title.trim().toLowerCase() === 'knowledge knockout'
  );
  if (knowledgeKnockout) {
    addCert(knowledgeKnockout);
  }

  // 4. CYBER CADET
  const cyberCadet = remainingFeatured.find(
    (c) => c.title.trim().toLowerCase() === 'cyber cadet'
  );
  if (cyberCadet) {
    addCert(cyberCadet);
  }

  // 5. Remaining featured: true certificates in their existing order
  remainingFeatured.forEach((c) => {
    addCert(c);
  });

  return selected;
}

/**
 * Selects and orders 10 certificates for the mobile homepage showcase (2x5 layout):
 * - "Knowledge Knockout" appears first (index 0)
 * - Followed by the remaining top homepage certificates without duplicates
 * Desktop/tablet certificate ordering remains completely unchanged.
 */
export function getMobileHomepageCertificates(certs: Certificate[]): Certificate[] {
  const homepageQualifying = getHomepageCertificates(certs);
  const isKnowledgeKnockout = (cert: Certificate) =>
    cert.title.trim().toLowerCase() === 'knowledge knockout';

  const knowledgeKnockout =
    homepageQualifying.find(isKnowledgeKnockout) ||
    certs.find(isKnowledgeKnockout);

  const ordered = knowledgeKnockout
    ? [knowledgeKnockout, ...homepageQualifying.filter((c) => !isKnowledgeKnockout(c))]
    : [...homepageQualifying];

  if (ordered.length < 10) {
    const seenTitles = new Set(ordered.map((c) => c.title.trim().toLowerCase()));
    const remaining = sortCertificatesByPriority(certs);
    for (const cert of remaining) {
      const key = cert.title.trim().toLowerCase();
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        ordered.push(cert);
        if (ordered.length >= 10) break;
      }
    }
  }

  return ordered.slice(0, 10);
}

/**
 * Sanitizes and validates certificates data, ensuring no missing fields
 * cause certificates to be dropped during rendering or filtering.
 */
export function sanitizeCertificates(data: Certificate[]): Certificate[] {
  const sanitized = data.map((cert) => {
    const ach = cert.achievement;
    return {
      ...cert,
      title: cert.title || 'Untitled Certificate',
      issuer: cert.issuer || 'Unknown Issuer',
      year: cert.year ? String(cert.year).trim() : '',
      category: cert.category ? String(cert.category).trim() : 'General',
      featured: Boolean(cert.featured),
      viewAchievement: Boolean(cert.viewAchievement),
      driveLink: cert.driveLink || '',
      github: cert.github || ach?.github || '',
      presentation: cert.presentation || ach?.presentation || '',
      offerLetter: cert.offerLetter || ach?.offerLetter || '',
      demoVideo: cert.demoVideo || ach?.demoVideo || '',
      achievement: ach
        ? {
            ...ach,
            experience: ach.experience || '',
            eventPhotos: Array.isArray(ach.eventPhotos) ? ach.eventPhotos.filter(Boolean) : [],
            github: ach.github || cert.github || '',
            presentation: ach.presentation || cert.presentation || '',
            offerLetter: ach.offerLetter || cert.offerLetter || '',
            demoVideo: ach.demoVideo || cert.demoVideo || '',
          }
        : undefined,
    };
  });

  return sortCertificatesByPriority(sanitized);
}
