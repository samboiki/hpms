import { ReactNode } from 'react'
import { ProfessionalSidebar } from './layout/ProfessionalSidebar'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* Professional Sidebar */}
      <ProfessionalSidebar />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
