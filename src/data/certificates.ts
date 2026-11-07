import certificatesData from './certificates.json';
import { Certificate } from '../types';
import { sanitizeCertificates } from '../services/certificateService';

export const certificates: Certificate[] = sanitizeCertificates(certificatesData as Certificate[]);
