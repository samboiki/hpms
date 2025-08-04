import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePractice } from '../contexts/PracticeContext';
import { lightning } from '../lib/lightningCache';

/**
 * Aggressive prefetching based on route patterns
 */
export function RoutePrefetcher() {
  const location = useLocation();
  const { practiceId } = usePractice();

  useEffect(() => {
    if (!practiceId) return;

    const path = location.pathname;
    console.log(`🚀 Route changed to: ${path}, prefetching relevant data...`);

    // Prefetch based on route patterns
    const prefetchTasks: Promise<any>[] = [];

    if (path === '/' || path === '/dashboard') {
      // Dashboard - prefetch overview data
      prefetchTasks.push(
        lightning.getPatients(practiceId),
        lightning.getTodayVisits(practiceId)
      );
    } else if (path.includes('/patients')) {
      // Patients page - prefetch all patients and recent visit counts
      prefetchTasks.push(
        lightning.getPatients(practiceId).then(patients => {
          // Prefetch visit counts for first 20 patients
          const countPromises = patients.slice(0, 20).map(p => 
            lightning.getVisitCount(p.id).catch(() => 0)
          );
          return Promise.all(countPromises);
        })
      );
    } else if (path.includes('/visits') || path.includes('/appointments')) {
      // Visits/Appointments - prefetch today's visits
      prefetchTasks.push(
        lightning.getTodayVisits(practiceId),
        lightning.getPatients(practiceId) // For patient lookups
      );
    } else if (path.match(/\/patient\/([a-f0-9-]+)/)) {
      // Individual patient page - prefetch patient visits
      const patientId = path.split('/')[2];
      if (patientId) {
        prefetchTasks.push(
          lightning.getVisits(patientId),
          lightning.getVisitCount(patientId)
        );
      }
    }

    // Execute all prefetch tasks
    Promise.all(prefetchTasks).then(() => {
      console.log(`✅ Prefetching completed for ${path}`);
    }).catch(error => {
      console.error('Prefetch error:', error);
    });
  }, [location.pathname, practiceId]);

  return null;
}