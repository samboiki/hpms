import React, { useEffect } from 'react';
import { useThemeStore } from '../../stores/themeStore';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { currentTheme, setTheme } = useThemeStore();

  useEffect(() => {
    // Apply theme CSS variables on mount and when theme changes
    if (currentTheme) {
      const root = document.documentElement;
      root.style.setProperty('--theme-primary-from', currentTheme.colors.primary.from);
      root.style.setProperty('--theme-primary-to', currentTheme.colors.primary.to);
      root.style.setProperty('--theme-primary-via', currentTheme.colors.primary.via || '');
      root.style.setProperty('--theme-sidebar-gradient', currentTheme.gradients.sidebar);
      root.style.setProperty('--theme-button-gradient', currentTheme.gradients.button);
      root.style.setProperty('--theme-card-gradient', currentTheme.gradients.card);
      root.style.setProperty('--theme-accent-gradient', currentTheme.gradients.accent);
      
      // Text colors
      root.style.setProperty('--theme-text-primary', currentTheme.colors.text.primary);
      root.style.setProperty('--theme-text-secondary', currentTheme.colors.text.secondary);
      root.style.setProperty('--theme-text-muted', currentTheme.colors.text.muted);
      
      // Background colors
      root.style.setProperty('--theme-bg-primary', currentTheme.colors.background.primary);
      root.style.setProperty('--theme-bg-secondary', currentTheme.colors.background.secondary);
      root.style.setProperty('--theme-bg-card', currentTheme.colors.background.card);
      
      // Border colors
      root.style.setProperty('--theme-border-primary', currentTheme.colors.border.primary);
      root.style.setProperty('--theme-border-secondary', currentTheme.colors.border.secondary);
    }
  }, [currentTheme]); // Only depend on currentTheme object, not setTheme

  return <>{children}</>;
};

export default ThemeProvider;