// Utility functions for handling user avatars

interface UnsplashImage {
  url: string;
  photographer: string;
}

// Curated list of professional avatars from Unsplash
const MALE_AVATARS: UnsplashImage[] = [
  { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face', photographer: 'Joseph Gonzalez' },
  { url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face', photographer: 'Jurica Koletić' },
  { url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face', photographer: 'Ayo Ogunseinde' },
  { url: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&h=200&fit=crop&crop=face', photographer: 'Austin Wade' },
  { url: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=200&h=200&fit=crop&crop=face', photographer: 'Nicolas Horn' },
  { url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=face', photographer: 'The Lazy Artist Gallery' },
  { url: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=200&h=200&fit=crop&crop=face', photographer: 'Leonard' },
  { url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face', photographer: 'Albert Dera' },
  { url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&h=200&fit=crop&crop=face', photographer: 'Julian Wan' },
  { url: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=200&h=200&fit=crop&crop=face', photographer: 'Elizeu Dias' }
];

const FEMALE_AVATARS: UnsplashImage[] = [
  { url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face', photographer: 'Michael Dam' },
  { url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face', photographer: 'Blake Carpenter' },
  { url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=face', photographer: 'Toa Heftiba' },
  { url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face', photographer: 'Aiony Haust' },
  { url: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=200&h=200&fit=crop&crop=face', photographer: 'Sipan Hakobyan' },
  { url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face', photographer: 'Ayo Ogunseinde' },
  { url: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=200&h=200&fit=crop&crop=face', photographer: 'Jake Nackos' },
  { url: 'https://images.unsplash.com/photo-1593104547489-5cfb3839a3b5?w=200&h=200&fit=crop&crop=face', photographer: 'Alex Perez' },
  { url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&h=200&fit=crop&crop=face', photographer: 'Michael Dam' },
  { url: 'https://images.unsplash.com/photo-1588516903720-8ceb67f9ef84?w=200&h=200&fit=crop&crop=face', photographer: 'Christina @ wocintechchat.com' }
];

const NEUTRAL_AVATARS: UnsplashImage[] = [
  { url: 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=200&h=200&fit=crop&crop=face', photographer: '3D Paradise' },
  { url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&crop=face', photographer: 'Ashton Bingham' },
  { url: 'https://images.unsplash.com/photo-1586297135537-94bc9ba060aa?w=200&h=200&fit=crop&crop=face', photographer: 'Charles Deluvio' }
];

/**
 * Get a random avatar URL based on gender
 * @param gender - The gender of the user (male, female, other, or undefined)
 * @param seed - Optional seed for consistent avatar selection (e.g., user email or ID)
 * @returns A professional avatar URL from Unsplash
 */
export function getGenderAppropriateAvatar(gender?: string | null, seed?: string): string {
  let avatarPool: UnsplashImage[];
  
  switch (gender?.toLowerCase()) {
    case 'male':
      avatarPool = MALE_AVATARS;
      break;
    case 'female':
      avatarPool = FEMALE_AVATARS;
      break;
    default:
      // For 'other' or undefined gender, use a mix of all avatars
      avatarPool = [...NEUTRAL_AVATARS, ...MALE_AVATARS, ...FEMALE_AVATARS];
  }
  
  // Use seed for consistent avatar selection if provided
  if (seed) {
    const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const index = hash % avatarPool.length;
    return avatarPool[index].url;
  }
  
  // Random selection if no seed
  const randomIndex = Math.floor(Math.random() * avatarPool.length);
  return avatarPool[randomIndex].url;
}

/**
 * Get a fallback avatar based on user initials and gender
 * @param fullName - The user's full name
 * @param gender - The user's gender
 * @returns JSX element for a fallback avatar
 */
export function getFallbackAvatarColors(gender?: string | null): string {
  switch (gender?.toLowerCase()) {
    case 'male':
      return 'from-blue-500 to-indigo-600';
    case 'female':
      return 'from-pink-500 to-purple-600';
    default:
      return 'from-purple-500 to-indigo-600';
  }
}