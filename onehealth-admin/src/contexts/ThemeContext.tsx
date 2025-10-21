import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface ThemeContextType {
  darkMode: boolean
  toggleDarkMode: () => void
  setDarkMode: (value: boolean) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default to dark mode
  const [darkMode, setDarkModeState] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved !== null ? saved === 'true' : true // Default to true (dark mode)
  })

  useEffect(() => {
    const root = window.document.documentElement
    if (darkMode) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('darkMode', darkMode.toString())
  }, [darkMode])

  const toggleDarkMode = () => {
    setDarkModeState(prev => !prev)
  }

  const setDarkMode = (value: boolean) => {
    setDarkModeState(value)
  }

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
