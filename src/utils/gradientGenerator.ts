/**
 * Header Gradient Generator for Invoices and Receipts
 * Generates gradients based on practice primary color
 */

// Helper function to convert hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ]
    : [1, 185, 213]; // Default cyan color
}

// Helper function to convert RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Helper function to lighten/darken a color
function adjustBrightness(hex: string, percent: number): string {
  const [r, g, b] = hexToRgb(hex);
  
  const adjust = (color: number) => {
    const adjusted = Math.round(color * (1 + percent / 100));
    return Math.max(0, Math.min(255, adjusted));
  };
  
  return rgbToHex(adjust(r), adjust(g), adjust(b));
}

// Generate gradient colors based on primary color
export function generateHeaderGradient(primaryColor?: string) {
  const baseColor = primaryColor || '#01b9d4';
  
  // Create gradient from lighter to darker
  const lightColor = adjustBrightness(baseColor, 20);  // 20% lighter
  const darkColor = adjustBrightness(baseColor, -15);  // 15% darker
  
  return {
    light: lightColor,
    primary: baseColor,
    dark: darkColor,
    // Create gradient string for backgrounds
    gradient: `linear-gradient(135deg, ${lightColor} 0%, ${baseColor} 50%, ${darkColor} 100%)`,
    // Duo-tone title colors
    titlePrimary: darkColor,    // Darker shade for first word
    titleSecondary: lightColor, // Lighter shade for second word
    // Header background gradient
    headerGradient: `linear-gradient(90deg, ${lightColor} 0%, ${baseColor} 100%)`,
  };
}

// Generate complementary colors for different sections
export function generateSectionColors(primaryColor?: string) {
  const baseColor = primaryColor || '#01b9d4';
  
  // Generate complementary and analogous colors
  return {
    primary: baseColor,
    accent: adjustBrightness(baseColor, 10),
    muted: adjustBrightness(baseColor, -30),
    background: adjustBrightness(baseColor, 90),
    border: adjustBrightness(baseColor, 60),
    text: adjustBrightness(baseColor, -60),
  };
}

// Generate payment details colors (special #76a5af for receipts)
export function generatePaymentColors(primaryColor?: string, isReceipt: boolean = false) {
  if (isReceipt) {
    return {
      background: '#76a5af',
      text: '#ffffff',
      border: adjustBrightness('#76a5af', -20),
      accent: adjustBrightness('#76a5af', 20),
    };
  }
  
  const colors = generateSectionColors(primaryColor);
  return {
    background: colors.primary,
    text: '#ffffff',
    border: colors.muted,
    accent: colors.accent,
  };
}

// Get icon color based on theme
export function getIconColor(primaryColor?: string): string {
  return adjustBrightness(primaryColor || '#01b9d4', -20);
}