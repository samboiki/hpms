import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/toaster'

export const metadata: Metadata = {
  title: 'OneHealth - Practice Management System',
  description: 'Comprehensive practice management solution for healthcare providers in Namibia',
  keywords: 'healthcare, practice management, medical, dental, clinic, Namibia',
  authors: [{ name: 'OneHealth Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#14b8a6',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'OneHealth - Practice Management System',
    description: 'Comprehensive practice management solution for healthcare providers in Namibia',
    type: 'website',
    locale: 'en_US',
    siteName: 'OneHealth',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OneHealth - Practice Management System',
    description: 'Comprehensive practice management solution for healthcare providers in Namibia',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head></head>
      <body className="antialiased">
        <Providers>
          <div className="min-h-screen bg-background">
            {children}
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}