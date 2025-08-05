'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Redirect to login page for admin portal
export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to login page for admin portal
    router.push('/auth/login')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500">Redirecting to login...</p>
      </div>
    </div>
  )
}