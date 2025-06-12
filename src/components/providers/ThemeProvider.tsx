import React, { useEffect } from 'react';
import { useThemeStore } from '../../stores/themeStore';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { currentTheme, setTheme } = useThemeStore();

  useEffect(() => {
    // Apply theme on mount
    if (currentTheme) {
      setTheme(currentTheme.id);
    }
  }, [currentTheme?.id, setTheme]);

  return <>{children}</>;
};

export default ThemeProvider;