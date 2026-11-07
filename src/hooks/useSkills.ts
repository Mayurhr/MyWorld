import { useState, useEffect } from 'react';
import { getSkills, SkillCategoryItem } from '../services/portfolioService';
import { DEFAULT_SKILL_CATEGORIES } from '../data/portfolioDefaults';

export function useSkills() {
  const [skillCategories, setSkillCategories] = useState<SkillCategoryItem[]>(DEFAULT_SKILL_CATEGORIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getSkills(false)
      .then((data) => {
        if (mounted && data && data.length > 0) {
          setSkillCategories(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Error loading skills:', err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { skillCategories, loading };
}
