'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Users,
  Plus,
  Settings,
  Eye,
  Edit,
  MoreHorizontal,
} from 'lucide-react'

export default function PracticesPage() {
  const { practices, currentPractice, profile } = useAuth()
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Mock data for practice stats - replace with real data
  const practiceStats = {
    totalPractices: practices.length,
    activeUsers: 24,
    totalPatients: 1247,
    monthlyRevenue: 45000,
  }

  const PracticeCard = ({ practice }: { practice: any }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-onehealth-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-onehealth-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{practice.name}</CardTitle>
              <CardDescription className="flex items-center">
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                  practice.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                }`}></span>
                {practice.status === 'active' ? 'Active' : 'Inactive'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Practice Info */}
        <div className="space-y-2">
          {practice.address_line_1 && (
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>{practice.address_line_1}, {practice.city}</span>
            </div>
          )}
          {practice.phone && (
            <div className="flex items-center text-sm text-gray-600">
              <Phone className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>{practice.phone}</span>
            </div>
          )}
          {practice.email && (
            <div className="flex items-center text-sm text-gray-600">
              <Mail className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>{practice.email}</span>
            </div>
          )}
        </div>

        {/* Specialties */}
        {practice.specialties && practice.specialties.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Specialties
            </div>
            <div className="flex flex-wrap gap-1">
              {practice.specialties.slice(0, 3).map((specialty: string, index: number) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-onehealth-100 text-onehealth-700"
                >
                  {specialty}
                </span>
              ))}
              {practice.specialties.length > 3 && (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                  +{practice.specialties.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-2 pt-2 border-t">
          <Button variant="outline" size="sm" className="flex-1">
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <Settings className="w-4 h-4 mr-1" />
            Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Practice Management</h1>
          <p className="text-muted-foreground">
            Manage your practice locations and settings
          </p>
        </div>
        {profile?.role === 'admin' && (
          <Button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Add Practice
          </Button>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Practices</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{practiceStats.totalPractices}</div>
            <p className="text-xs text-muted-foreground">
              Across all locations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{practiceStats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              Staff members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{practiceStats.totalPatients.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Registered patients
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">N${practiceStats.monthlyRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Combined revenue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Current Practice Highlight */}
      {currentPractice && (
        <Card className="border-onehealth-200 bg-onehealth-50">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="w-5 h-5 mr-2 text-onehealth-600" />
              Current Practice
            </CardTitle>
            <CardDescription>
              You are currently managing {currentPractice.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-sm font-medium text-gray-500">Location</div>
                <div className="text-sm">{currentPractice.city}, {currentPractice.country}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Contact</div>
                <div className="text-sm">{currentPractice.phone}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Status</div>
                <div className="text-sm capitalize">{currentPractice.status}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Practices Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">All Practices</h2>
        {practices.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {practices.map((practice) => (
              <PracticeCard key={practice.id} practice={practice} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No practices found</h3>
              <p className="text-gray-500 text-center mb-4">
                Get started by adding your first practice location.
              </p>
              {profile?.role === 'admin' && (
                <Button onClick={() => setShowCreateModal(true)} className="btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Practice
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}