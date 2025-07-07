/**
 * Helper functions for handling images with fallbacks
 */

export interface TeamMemberImage {
  unsplashUrl?: string;
  directImageUrl?: string;
  localPath?: string;
  fallbackUrl?: string;
}

/**
 * Get the best available image URL for a team member
 * Priority: localPath > directImageUrl > fallbackUrl
 */
export const getTeamMemberImage = (
  member: {
    name: string;
    imageOptions?: TeamMemberImage;
  }
): string => {
  const { imageOptions } = member;
  
  if (imageOptions?.localPath) {
    return imageOptions.localPath;
  }
  
  if (imageOptions?.directImageUrl) {
    return imageOptions.directImageUrl;
  }
  
  // Generate a fallback avatar using UI Avatars
  const fallback = imageOptions?.fallbackUrl || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=00BCD4&color=fff&size=400`;
  
  return fallback;
};

/**
 * Map of Unsplash photo IDs to direct image URLs
 * This needs to be manually maintained as Unsplash doesn't provide
 * a direct mapping from their webpage URLs to image URLs
 */
export const UNSPLASH_PHOTO_MAP: Record<string, string> = {
  // Example mappings - these need to be updated with actual photo IDs
  'kXmKqYOGA4Y': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
  '9Ex31S3eoRY': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2',
  'UXyxCSLdswg': 'https://images.unsplash.com/photo-1580489944761-15a19d654956',
  't2obqqft_xM': 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2',
};

/**
 * Convert Unsplash webpage URL to direct image URL
 * @param unsplashUrl - The Unsplash webpage URL
 * @param size - Image dimensions (default: 400x400)
 * @returns Direct image URL or null if not found
 */
export const convertUnsplashUrl = (
  unsplashUrl: string,
  size: { width: number; height: number } = { width: 400, height: 400 }
): string | null => {
  // Extract photo ID from URL
  const match = unsplashUrl.match(/photos\/[^/]+-([^/]+)$/);
  if (!match) return null;
  
  const photoId = match[1];
  const baseUrl = UNSPLASH_PHOTO_MAP[photoId];
  
  if (!baseUrl) return null;
  
  return `${baseUrl}?w=${size.width}&h=${size.height}&fit=crop`;
};

/**
 * Professional headshot image URLs from Unsplash
 * These are verified working direct image URLs
 */
export const PROFESSIONAL_HEADSHOTS = {
  female1: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
  female2: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
  female3: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=400&fit=crop',
  female4: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop',
  female5: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop',
  male1: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
  male2: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
  male3: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
  male4: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop',
  male5: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop',
};

/**
 * Get a random professional headshot
 */
export const getRandomProfessionalHeadshot = (gender?: 'male' | 'female'): string => {
  const allHeadshots = Object.values(PROFESSIONAL_HEADSHOTS);
  const femaleHeadshots = Object.entries(PROFESSIONAL_HEADSHOTS)
    .filter(([key]) => key.startsWith('female'))
    .map(([, url]) => url);
  const maleHeadshots = Object.entries(PROFESSIONAL_HEADSHOTS)
    .filter(([key]) => key.startsWith('male'))
    .map(([, url]) => url);
  
  let pool = allHeadshots;
  if (gender === 'female') pool = femaleHeadshots;
  if (gender === 'male') pool = maleHeadshots;
  
  return pool[Math.floor(Math.random() * pool.length)];
};