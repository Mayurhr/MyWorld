import { useState, useEffect, useCallback } from 'react';
import { getProjects, ProjectItem } from '../services/portfolioService';
import { projects as bundledProjects } from '../data/projects';

interface UseProjectsResult {
  projects: ProjectItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectItem[]>(() => {
    return bundledProjects.map((p, idx) => ({
      id: `bundled-proj-${idx}`,
      ...p,
      status: 'published',
      order: idx + 1,
      featured: idx === 0,
    }));
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProjects(false); // Only published items for public view
      if (data && data.length > 0) {
        setProjects(data);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to fetch live projects. Using local data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { projects, loading, error, refresh: loadData };
}
