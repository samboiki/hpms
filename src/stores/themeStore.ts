import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: {
      from: string;
      to: string;
      via?: string;
    };
    secondary: {
      from: string;
      to: string;
      via?: string;
    };
    accent: {
      from: string;
      to: string;
      via?: string;
    };
    text: {
      primary: string;
      secondary: string;
      muted: string;
    };
    background: {
      primary: string;
      secondary: string;
      card: string;
    };
    border: {
      primary: string;
      secondary: string;
    };
    status: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
  };
  gradients: {
    sidebar: string;
    button: string;
    card: string;
    accent: string;
  };
}

const defaultThemes: Theme[] = [
  {
    id: 'sunset',
    name: 'Sunset Warmth',
    description: 'Warm orange to golden yellow gradient',
    colors: {
      primary: {
        from: '#f46b45',
        to: '#eea849'
      },
      secondary: {
        from: '#ff7b7b',
        to: '#ff9f43'
      },
      accent: {
        from: '#fd79a8',
        to: '#fdcb6e'
      },
      text: {
        primary: '#2d3748',
        secondary: '#4a5568',
        muted: '#718096'
      },
      background: {
        primary: '#ffffff',
        secondary: '#f7fafc',
        card: '#edf1f4'
      },
      border: {
        primary: '#e2e8f0',
        secondary: '#cbd5e0'
      },
      status: {
        success: '#48bb78',
        warning: '#ed8936',
        error: '#f56565',
        info: '#4299e1'
      }
    },
    gradients: {
      sidebar: 'from-[#f46b45] to-[#eea849]',
      button: 'from-[#f46b45] to-[#eea849]',
      card: 'from-gray-400 to-gray-500',
      accent: 'from-[#fd79a8] to-[#fdcb6e]'
    }
  },
  {
    id: 'ocean',
    name: 'Ocean Breeze',
    description: 'Cool blue to teal gradient',
    colors: {
      primary: {
        from: '#01b9d5',
        to: '#4bc0c8'
      },
      secondary: {
        from: '#3182ce',
        to: '#38b2ac'
      },
      accent: {
        from: '#667eea',
        to: '#764ba2'
      },
      text: {
        primary: '#2d3748',
        secondary: '#4a5568',
        muted: '#718096'
      },
      background: {
        primary: '#ffffff',
        secondary: '#f7fafc',
        card: '#edf1f4'
      },
      border: {
        primary: '#e2e8f0',
        secondary: '#cbd5e0'
      },
      status: {
        success: '#48bb78',
        warning: '#ed8936',
        error: '#f56565',
        info: '#4299e1'
      }
    },
    gradients: {
      sidebar: 'from-[#01b9d5] to-[#4bc0c8]',
      button: 'from-[#01b9d5] to-[#4bc0c8]',
      card: 'from-gray-400 to-gray-500',
      accent: 'from-[#667eea] to-[#764ba2]'
    }
  },
  {
    id: 'forest',
    name: 'Forest Fresh',
    description: 'Green to emerald gradient',
    colors: {
      primary: {
        from: '#48bb78',
        to: '#38a169'
      },
      secondary: {
        from: '#68d391',
        to: '#9ae6b4'
      },
      accent: {
        from: '#9f7aea',
        to: '#b794f6'
      },
      text: {
        primary: '#2d3748',
        secondary: '#4a5568',
        muted: '#718096'
      },
      background: {
        primary: '#ffffff',
        secondary: '#f7fafc',
        card: '#edf1f4'
      },
      border: {
        primary: '#e2e8f0',
        secondary: '#cbd5e0'
      },
      status: {
        success: '#48bb78',
        warning: '#ed8936',
        error: '#f56565',
        info: '#4299e1'
      }
    },
    gradients: {
      sidebar: 'from-[#48bb78] to-[#38a169]',
      button: 'from-[#48bb78] to-[#38a169]',
      card: 'from-gray-400 to-gray-500',
      accent: 'from-[#9f7aea] to-[#b794f6]'
    }
  },
  {
    id: 'purple',
    name: 'Purple Majesty',
    description: 'Purple to violet gradient',
    colors: {
      primary: {
        from: '#8b5cf6',
        to: '#a78bfa'
      },
      secondary: {
        from: '#9f7aea',
        to: '#b794f6'
      },
      accent: {
        from: '#ec4899',
        to: '#f472b6'
      },
      text: {
        primary: '#2d3748',
        secondary: '#4a5568',
        muted: '#718096'
      },
      background: {
        primary: '#ffffff',
        secondary: '#f7fafc',
        card: '#edf1f4'
      },
      border: {
        primary: '#e2e8f0',
        secondary: '#cbd5e0'
      },
      status: {
        success: '#48bb78',
        warning: '#ed8936',
        error: '#f56565',
        info: '#4299e1'
      }
    },
    gradients: {
      sidebar: 'from-[#8b5cf6] to-[#a78bfa]',
      button: 'from-[#8b5cf6] to-[#a78bfa]',
      card: 'from-gray-400 to-gray-500',
      accent: 'from-[#ec4899] to-[#f472b6]'
    }
  },
  {
    id: 'cosmic',
    name: 'Cosmic Vibes',
    description: 'Cyan to purple to coral gradient',
    colors: {
      primary: {
        from: '#12c2e9',
        via: '#c471ed',
        to: '#f64f59'
      },
      secondary: {
        from: '#667eea',
        to: '#764ba2'
      },
      accent: {
        from: '#ff9a9e',
        to: '#fecfef'
      },
      text: {
        primary: '#2d3748',
        secondary: '#4a5568',
        muted: '#718096'
      },
      background: {
        primary: '#ffffff',
        secondary: '#f7fafc',
        card: '#edf1f4'
      },
      border: {
        primary: '#e2e8f0',
        secondary: '#cbd5e0'
      },
      status: {
        success: '#48bb78',
        warning: '#ed8936',
        error: '#f56565',
        info: '#4299e1'
      }
    },
    gradients: {
      sidebar: 'from-[#12c2e9] via-[#c471ed] to-[#f64f59]',
      button: 'from-[#12c2e9] via-[#c471ed] to-[#f64f59]',
      card: 'from-gray-400 to-gray-500',
      accent: 'from-[#ff9a9e] to-[#fecfef]'
    }
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    description: 'Clean grayscale theme',
    colors: {
      primary: {
        from: '#4a5568',
        to: '#2d3748'
      },
      secondary: {
        from: '#718096',
        to: '#a0aec0'
      },
      accent: {
        from: '#cbd5e0',
        to: '#e2e8f0'
      },
      text: {
        primary: '#2d3748',
        secondary: '#4a5568',
        muted: '#718096'
      },
      background: {
        primary: '#ffffff',
        secondary: '#f7fafc',
        card: '#edf1f4'
      },
      border: {
        primary: '#e2e8f0',
        secondary: '#cbd5e0'
      },
      status: {
        success: '#48bb78',
        warning: '#ed8936',
        error: '#f56565',
        info: '#4299e1'
      }
    },
    gradients: {
      sidebar: 'from-[#4a5568] to-[#2d3748]',
      button: 'from-[#4a5568] to-[#2d3748]',
      card: 'from-gray-400 to-gray-500',
      accent: 'from-[#cbd5e0] to-[#e2e8f0]'
    }
  },
  {
    id: 'sapphire',
    name: 'Sapphire Dream',
    description: 'Brilliant blue with sapphire gradients',
    colors: {
      primary: {
        from: '#489bfd',
        to: '#1e40af'
      },
      secondary: {
        from: '#60a5fa',
        to: '#3b82f6'
      },
      accent: {
        from: '#06b6d4',
        to: '#0891b2'
      },
      text: {
        primary: '#1e293b',
        secondary: '#475569',
        muted: '#64748b'
      },
      background: {
        primary: '#ffffff',
        secondary: '#f8fafc',
        card: '#f1f5f9'
      },
      border: {
        primary: '#e2e8f0',
        secondary: '#cbd5e0'
      },
      status: {
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#489bfd'
      }
    },
    gradients: {
      sidebar: 'from-[#489bfd] to-[#1e40af]',
      button: 'from-[#489bfd] to-[#1e40af]',
      card: 'from-blue-400 to-blue-600',
      accent: 'from-[#06b6d4] to-[#0891b2]'
    }
  },
  {
    id: 'emerald',
    name: 'Emerald Luxury',
    description: 'Rich emerald with golden accents',
    colors: {
      primary: {
        from: '#059669',
        to: '#047857'
      },
      secondary: {
        from: '#10b981',
        to: '#059669'
      },
      accent: {
        from: '#f59e0b',
        to: '#d97706'
      },
      text: {
        primary: '#1f2937',
        secondary: '#374151',
        muted: '#6b7280'
      },
      background: {
        primary: '#ffffff',
        secondary: '#f9fafb',
        card: '#f3f4f6'
      },
      border: {
        primary: '#e5e7eb',
        secondary: '#d1d5db'
      },
      status: {
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6'
      }
    },
    gradients: {
      sidebar: 'from-[#059669] to-[#047857]',
      button: 'from-[#059669] to-[#047857]',
      card: 'from-emerald-500 to-emerald-700',
      accent: 'from-[#f59e0b] to-[#d97706]'
    }
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold Elite',
    description: 'Elegant rose gold with warm copper tones',
    colors: {
      primary: {
        from: '#f43f5e',
        to: '#be185d'
      },
      secondary: {
        from: '#fb7185',
        to: '#f43f5e'
      },
      accent: {
        from: '#ea580c',
        to: '#c2410c'
      },
      text: {
        primary: '#1f2937',
        secondary: '#374151',
        muted: '#6b7280'
      },
      background: {
        primary: '#ffffff',
        secondary: '#fef7f7',
        card: '#fef2f2'
      },
      border: {
        primary: '#fce7e7',
        secondary: '#fecaca'
      },
      status: {
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6'
      }
    },
    gradients: {
      sidebar: 'from-[#f43f5e] to-[#be185d]',
      button: 'from-[#f43f5e] to-[#be185d]',
      card: 'from-rose-500 to-rose-700',
      accent: 'from-[#ea580c] to-[#c2410c]'
    }
  },
  {
    id: 'midnight',
    name: 'Midnight Galaxy',
    description: 'Deep space blues with starlight accents',
    colors: {
      primary: {
        from: '#1e1b4b',
        to: '#0f172a'
      },
      secondary: {
        from: '#312e81',
        to: '#1e1b4b'
      },
      accent: {
        from: '#c084fc',
        to: '#a855f7'
      },
      text: {
        primary: '#f8fafc',
        secondary: '#e2e8f0',
        muted: '#94a3b8'
      },
      background: {
        primary: '#0f172a',
        secondary: '#1e293b',
        card: '#334155'
      },
      border: {
        primary: '#475569',
        secondary: '#64748b'
      },
      status: {
        success: '#22c55e',
        warning: '#eab308',
        error: '#ef4444',
        info: '#3b82f6'
      }
    },
    gradients: {
      sidebar: 'from-[#1e1b4b] to-[#0f172a]',
      button: 'from-[#1e1b4b] to-[#0f172a]',
      card: 'from-slate-600 to-slate-800',
      accent: 'from-[#c084fc] to-[#a855f7]'
    }
  }
];

interface ThemeState {
  currentTheme: Theme;
  themes: Theme[];
  setTheme: (themeId: string, practiceId?: string) => void;
  loadThemeFromDatabase: (practiceId: string) => Promise<void>;
  getThemeById: (themeId: string) => Theme | undefined;
  addCustomTheme: (theme: Theme) => void;
  removeCustomTheme: (themeId: string) => void;
  resetToDefaults: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      currentTheme: defaultThemes[0], // Default to sunset theme
      themes: defaultThemes,
      setTheme: async (themeId: string, practiceId?: string) => {
        const theme = get().themes.find(t => t.id === themeId);
        if (theme) {
          set({ currentTheme: theme });
          
          // Apply CSS custom properties to document root
          const root = document.documentElement;
          root.style.setProperty('--theme-primary-from', theme.colors.primary.from);
          root.style.setProperty('--theme-primary-to', theme.colors.primary.to);
          root.style.setProperty('--theme-primary-via', theme.colors.primary.via || '');
          root.style.setProperty('--theme-sidebar-gradient', theme.gradients.sidebar);
          root.style.setProperty('--theme-button-gradient', theme.gradients.button);
          root.style.setProperty('--theme-card-gradient', theme.gradients.card);
          root.style.setProperty('--theme-accent-gradient', theme.gradients.accent);
          
          // Text colors
          root.style.setProperty('--theme-text-primary', theme.colors.text.primary);
          root.style.setProperty('--theme-text-secondary', theme.colors.text.secondary);
          root.style.setProperty('--theme-text-muted', theme.colors.text.muted);
          
          // Background colors
          root.style.setProperty('--theme-bg-primary', theme.colors.background.primary);
          root.style.setProperty('--theme-bg-secondary', theme.colors.background.secondary);
          root.style.setProperty('--theme-bg-card', theme.colors.background.card);
          
          // Border colors
          root.style.setProperty('--theme-border-primary', theme.colors.border.primary);
          root.style.setProperty('--theme-border-secondary', theme.colors.border.secondary);
          
          // Save to database if practiceId is provided
          if (practiceId) {
            try {
              const { error } = await supabase
                .from('practices')
                .update({ theme_id: themeId })
                .eq('id', practiceId);
                
              if (error) {
                console.error('Error saving theme preference:', error);
              } else {
                console.log('✅ Theme preference saved to database');
              }
            } catch (error) {
              console.error('Error saving theme preference:', error);
            }
          }
        }
      },
      loadThemeFromDatabase: async (practiceId: string) => {
        try {
          const { data, error } = await supabase
            .from('practices')
            .select('theme_id')
            .eq('id', practiceId)
            .single();
            
          if (!error && data?.theme_id) {
            const theme = get().themes.find(t => t.id === data.theme_id);
            if (theme) {
              set({ currentTheme: theme });
              
              // Apply CSS custom properties
              const root = document.documentElement;
              root.style.setProperty('--theme-primary-from', theme.colors.primary.from);
              root.style.setProperty('--theme-primary-to', theme.colors.primary.to);
              root.style.setProperty('--theme-primary-via', theme.colors.primary.via || '');
              root.style.setProperty('--theme-sidebar-gradient', theme.gradients.sidebar);
              root.style.setProperty('--theme-button-gradient', theme.gradients.button);
              root.style.setProperty('--theme-card-gradient', theme.gradients.card);
              root.style.setProperty('--theme-accent-gradient', theme.gradients.accent);
              root.style.setProperty('--theme-text-primary', theme.colors.text.primary);
              root.style.setProperty('--theme-text-secondary', theme.colors.text.secondary);
              root.style.setProperty('--theme-text-muted', theme.colors.text.muted);
              root.style.setProperty('--theme-bg-primary', theme.colors.background.primary);
              root.style.setProperty('--theme-bg-secondary', theme.colors.background.secondary);
              root.style.setProperty('--theme-bg-card', theme.colors.background.card);
              root.style.setProperty('--theme-border-primary', theme.colors.border.primary);
              root.style.setProperty('--theme-border-secondary', theme.colors.border.secondary);
              
              console.log('✅ Theme loaded from database:', data.theme_id);
            }
          }
        } catch (error) {
          console.error('Error loading theme from database:', error);
        }
      },
      getThemeById: (themeId: string) => {
        return get().themes.find(t => t.id === themeId);
      },
      addCustomTheme: (theme: Theme) => {
        set(state => ({
          themes: [...state.themes, theme]
        }));
      },
      removeCustomTheme: (themeId: string) => {
        set(state => ({
          themes: state.themes.filter(t => t.id !== themeId)
        }));
      },
      resetToDefaults: () => {
        set({
          themes: defaultThemes,
          currentTheme: defaultThemes[0]
        });
      }
    }),
    {
      name: 'hpms-theme-storage',
      partialize: (state) => ({
        currentTheme: state.currentTheme,
        themes: state.themes
      })
    }
  )
);

// Theme utility functions
export const getGradientClass = (gradient: string) => {
  return `bg-gradient-to-b ${gradient}`;
};

export const getButtonClass = (theme: Theme, variant: 'primary' | 'secondary' | 'accent' = 'primary') => {
  const base = 'px-4 py-2 rounded-xl text-white font-medium transition-all duration-200 hover:shadow-lg';
  
  switch (variant) {
    case 'primary':
      return `${base} bg-gradient-to-r ${theme.gradients.button} hover:scale-[1.02]`;
    case 'secondary':
      return `${base} bg-gradient-to-r ${theme.gradients.card} hover:scale-[1.02]`;
    case 'accent':
      return `${base} bg-gradient-to-r ${theme.gradients.accent} hover:scale-[1.02]`;
    default:
      return `${base} bg-gradient-to-r ${theme.gradients.button} hover:scale-[1.02]`;
  }
};

// Hook to use theme in components
export const useTheme = () => {
  const { currentTheme, setTheme, themes, loadThemeFromDatabase } = useThemeStore();
  return { currentTheme, setTheme, themes, loadThemeFromDatabase };
};