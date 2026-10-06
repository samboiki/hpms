/**
 * Practice validation utilities to ensure proper practice context
 * CRITICAL: These utilities prevent cross-practice data access
 */

import { practiceDataService } from '../lib/practiceDataService';
// 'sonner' is not installed, so importing it failed this whole module (the app uses react-hot-toast)
import { toast } from 'react-hot-toast';

export interface PracticeContext {
  practiceId: string;
  userId: string;
  userRole: string;
}

/**
 * Get validated practice context
 * Throws error if no valid practice context is found
 */
export async function getValidatedPracticeContext(): Promise<PracticeContext> {
  const context = await practiceDataService.getAuthContext();
  
  if (!context?.practiceId) {
    const error = new Error('No valid practice context found. Please log in again.');
    console.error('❌ [PracticeValidation] Missing practice context:', context);
    toast.error('Session error: Please log in again');
    throw error;
  }

  return context;
}

/**
 * Validate that a resource belongs to the user's practice
 * @param resourcePracticeId - The practice_id of the resource being accessed
 * @param userPracticeId - The practice_id of the current user
 * @returns true if valid, false otherwise
 */
export function validateResourceAccess(
  resourcePracticeId: string | null | undefined,
  userPracticeId: string
): boolean {
  if (!resourcePracticeId || !userPracticeId) {
    console.error('❌ [PracticeValidation] Missing practice IDs for validation');
    return false;
  }

  const isValid = resourcePracticeId === userPracticeId;
  
  if (!isValid) {
    console.error('❌ [PracticeValidation] Access denied - resource from different practice', {
      resourcePracticeId,
      userPracticeId
    });
  }

  return isValid;
}

/**
 * Safe practice ID getter that never returns a hardcoded fallback
 * @param user - User object from auth store
 * @returns practice ID or throws error
 */
export function getSafePracticeId(user: any): string {
  const practiceId = user?.practice_id || user?.user_metadata?.practice_id;
  
  if (!practiceId) {
    const error = new Error('No practice ID found for user');
    console.error('❌ [PracticeValidation] No practice ID in user object:', user);
    toast.error('Session error: No practice found');
    throw error;
  }

  // NEVER use localStorage as fallback - it's not secure
  // NEVER use hardcoded practice IDs
  
  return practiceId;
}

/**
 * Validate practice ID format (UUID v4)
 */
export function isValidPracticeId(practiceId: string): boolean {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(practiceId);
}