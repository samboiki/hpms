// Simple color utilities without external dependencies

export interface ExtractedColors {
  dominant: string;
  palette: string[];
  vibrant: string;
  muted: string;
  gradients: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export async function extractColorsFromLogo(logoUrl: string): Promise<ExtractedColors> {
  // For now, return a sophisticated color scheme based on the practice's primary color
  // In a real implementation, you could use canvas API to extract colors
  return Promise.resolve({
    dominant: '#2563eb',
    palette: ['#2563eb', '#3b82f6', '#60a5fa', '#93bbfc', '#1e40af'],
    vibrant: '#3b82f6',
    muted: '#1e40af',
    gradients: {
      primary: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%)',
      secondary: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
      accent: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)'
    }
  });
}

// Enhanced color utilities
export function lightenColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

export function darkenColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = (num >> 8 & 0x00FF) - amt;
  const B = (num & 0x0000FF) - amt;
  
  return '#' + (0x1000000 + (R > 0 ? R : 0) * 0x10000 +
    (G > 0 ? G : 0) * 0x100 +
    (B > 0 ? B : 0)).toString(16).slice(1);
}

export function getComplementaryColor(color: string): string {
  const num = parseInt(color.replace('#', ''), 16);
  const R = 255 - (num >> 16);
  const G = 255 - (num >> 8 & 0x00FF);
  const B = 255 - (num & 0x0000FF);
  
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}