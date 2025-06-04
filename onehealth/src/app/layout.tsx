import type { Metadata } from 'next'
import { Poppins, Montserrat } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/toaster'

const poppins = Poppins({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins'
})

const montserrat = Montserrat({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-montserrat'
})

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className={`${poppins.variable} ${montserrat.variable} font-montserrat antialiased`}>
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