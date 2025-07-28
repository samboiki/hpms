import type { Metadata } from 'next'
import { Rubik, Montserrat } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/toaster'
// import { CustomCursor } from '@/components/CustomCursor'

const rubik = Rubik({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-rubik',
  display: 'swap',
  preload: true,
})

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-montserrat',
  display: 'swap',
  preload: true,
})

export const metadata: Metadata = {
  title: 'OneHealth - Practice Management System',
  description: 'Comprehensive practice management solution for healthcare providers in Namibia',
  keywords: 'healthcare, practice management, medical, dental, clinic, Namibia',
  authors: [{ name: 'OneHealth Team' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/onehealthfavicon.png',
    apple: '/onehealthfavicon.png',
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

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#8b5cf6',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${rubik.variable} ${montserrat.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-sans antialiased">
        <Providers>
          {/* <CustomCursor /> */}
          <div className="min-h-screen bg-background">
            {children}
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}