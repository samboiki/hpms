'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Practice } from '@/lib/tenants'
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Clock,
  Star,
  ArrowRight,
  Heart,
  Stethoscope
} from 'lucide-react'

interface PracticeWithMetadata extends Practice {
  testimonials?: Array<{
    rating: number;
    text: string;
    author: string;
  }>;
  metadata?: {
    before_after_gallery?: Array<any>;
    gallery_images?: string[];
  };
}

export default function PracticeDirectory() {
  const [practices, setPractices] = useState<PracticeWithMetadata[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPractices() {
      try {
        console.log('🏥 Loading all practices...')
        const { data, error } = await supabase
          .from('practices')
          .select('*')
          .order('name')

        if (error) {
          console.error('Error loading practices:', error)
        } else {
          console.log('✅ Loaded practices:', data?.length)
          setPractices(data || [])
        }
      } catch (error) {
        console.error('Error in loadPractices:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPractices()
  }, [])

  const getBusinessHoursText = (businessHours: any) => {
    if (!businessHours) return 'Hours vary'
    
    const today = new Date().toLocaleLowerCase().substring(0, 3) + 
                  new Date().toLocaleLowerCase().substring(3)
    const todaysHours = businessHours[today]
    
    if (todaysHours?.closed) return 'Closed today'
    if (todaysHours?.open && todaysHours?.close) {
      return `Open today ${todaysHours.open} - ${todaysHours.close}`
    }
    return 'Hours vary'
  }

  const getAverageRating = (testimonials: any[]) => {
    if (!testimonials || testimonials.length === 0) return 0
    const sum = testimonials.reduce((acc, t) => acc + (t.rating || 0), 0)
    return (sum / testimonials.length).toFixed(1)
  }

  const getPracticeType = (practice: Practice) => {
    if (practice.slug.includes('dental') || practice.name.toLowerCase().includes('dental')) {
      return { type: '🦷 Dental Practice', color: 'bg-blue-100 text-blue-800' }
    }
    if (practice.slug.includes('aesthetic') || practice.name.toLowerCase().includes('aesthetic')) {
      return { type: '✨ Aesthetic Clinic', color: 'bg-purple-100 text-purple-800' }
    }
    return { type: '🏥 Medical Practice', color: 'bg-green-100 text-green-800' }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading healthcare practices...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <Stethoscope className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Healthcare Practice Directory</h1>
                <p className="text-gray-600">Discover quality healthcare providers in Namibia</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">{practices.length} Practices Available</p>
              <p className="text-xs text-gray-500">Professional Healthcare Network</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {practices.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No practices found</h3>
            <p className="text-gray-600">Please check back later or contact support.</p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center">
                  <Building2 className="w-8 h-8 text-blue-600" />
                  <div className="ml-3">
                    <p className="text-2xl font-bold text-gray-900">{practices.length}</p>
                    <p className="text-sm text-gray-600">Healthcare Practices</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center">
                  <MapPin className="w-8 h-8 text-green-600" />
                  <div className="ml-3">
                    <p className="text-2xl font-bold text-gray-900">
                      {[...new Set(practices.map(p => p.city))].length}
                    </p>
                    <p className="text-sm text-gray-600">Cities Covered</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center">
                  <Heart className="w-8 h-8 text-red-600" />
                  <div className="ml-3">
                    <p className="text-2xl font-bold text-gray-900">
                      {practices.filter(p => p.features?.online_booking).length}
                    </p>
                    <p className="text-sm text-gray-600">Online Booking</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center">
                  <Clock className="w-8 h-8 text-purple-600" />
                  <div className="ml-3">
                    <p className="text-2xl font-bold text-gray-900">24/7</p>
                    <p className="text-sm text-gray-600">Emergency Care</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Practice Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {practices.map((practice) => {
                const practiceType = getPracticeType(practice)
                const averageRating = getAverageRating(practice.testimonials)
                const hasImages = practice.metadata?.before_after_gallery?.length > 0

                return (
                  <Link 
                    key={practice.id} 
                    href={`/?practice=${practice.slug}`}
                    className="group block"
                  >
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-gray-200 hover:-translate-y-1">
                      {/* Practice Image */}
                      <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200">
                        {practice.hero_image_url ? (
                          <img 
                            src={practice.hero_image_url} 
                            alt={practice.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Building2 className="w-16 h-16 text-gray-400" />
                          </div>
                        )}
                        <div className="absolute top-4 left-4">
                          <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${practiceType.color}`}>
                            {practiceType.type}
                          </span>
                        </div>
                        {hasImages && (
                          <div className="absolute top-4 right-4">
                            <span className="inline-flex px-2 py-1 text-xs font-medium bg-white/90 text-gray-700 rounded-full">
                              Gallery
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Practice Info */}
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                            {practice.name}
                          </h3>
                          {averageRating > 0 && (
                            <div className="flex items-center text-yellow-500">
                              <Star className="w-4 h-4 fill-current" />
                              <span className="text-sm font-medium text-gray-700 ml-1">
                                {averageRating}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 mb-4">
                          {practice.city && (
                            <div className="flex items-center text-gray-600">
                              <MapPin className="w-4 h-4 mr-2" />
                              <span className="text-sm">{practice.city}</span>
                            </div>
                          )}
                          
                          {practice.contact_phone && (
                            <div className="flex items-center text-gray-600">
                              <Phone className="w-4 h-4 mr-2" />
                              <span className="text-sm">{practice.contact_phone}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center text-gray-600">
                            <Clock className="w-4 h-4 mr-2" />
                            <span className="text-sm">{getBusinessHoursText(practice.business_hours)}</span>
                          </div>
                        </div>

                        {practice.hero_subtitle && (
                          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                            {practice.hero_subtitle}
                          </p>
                        )}

                        {/* Features */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {practice.features?.online_booking && (
                            <span className="inline-flex px-2 py-1 text-xs bg-green-100 text-green-800 rounded-md">
                              Online Booking
                            </span>
                          )}
                          {practice.features?.telemedicine && (
                            <span className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-md">
                              Telemedicine
                            </span>
                          )}
                          {practice.features?.online_payments && (
                            <span className="inline-flex px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-md">
                              Online Payments
                            </span>
                          )}
                        </div>

                        {/* Visit Button */}
                        <div className="flex items-center text-blue-600 font-medium group-hover:text-blue-700">
                          <span className="text-sm">Visit Practice</span>
                          <ArrowRight className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-gray-600">
              Professional Healthcare Network • Powered by <a href="https://onehealthsystems.com" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">OneHealthSystems</a>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Connecting patients with quality healthcare providers across Namibia
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}