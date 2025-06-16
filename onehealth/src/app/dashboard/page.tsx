'use client'

import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Users,
  Calendar,
  CreditCard,
  TrendingUp,
  Building2,
  Receipt,
  Clock,
  AlertCircle,
  Activity,
  DollarSign,
} from 'lucide-react'
import Link from 'next/link'
import { SMSBalanceWidget } from '@/components/admin/SMSBalanceWidget'
import { Toaster } from 'react-hot-toast'

export default function DashboardPage() {
  const { profile, currentPractice } = useAuth()

  // Mock data - replace with real data from API
  const stats = {
    totalPatients: 1247,
    todayAppointments: 24,
    monthlyRevenue: 45000,
    pendingBills: 12,
    practiceCount: 3,
    activeTariffs: 156,
  }

  const recentActivity = [
    {
      id: 1,
      type: 'appointment',
      description: 'New appointment scheduled with John Smith',
      time: '2 minutes ago',
      icon: Calendar,
    },
    {
      id: 2,
      type: 'payment',
      description: 'Payment received from Maria Johnson - N$450',
      time: '15 minutes ago',
      icon: DollarSign,
    },
    {
      id: 3,
      type: 'patient',
      description: 'New patient registered: David Brown',
      time: '1 hour ago',
      icon: Users,
    },
    {
      id: 4,
      type: 'billing',
      description: 'Invoice INV-2024-001 sent to Sarah Wilson',
      time: '2 hours ago',
      icon: CreditCard,
    },
  ]

  const upcomingAppointments = [
    {
      id: 1,
      patient: 'John Smith',
      time: '09:00',
      type: 'Consultation',
      doctor: 'Dr. Johnson',
    },
    {
      id: 2,
      patient: 'Maria Garcia',
      time: '09:30',
      type: 'Follow-up',
      doctor: 'Dr. Smith',
    },
    {
      id: 3,
      patient: 'David Brown',
      time: '10:00',
      type: 'Check-up',
      doctor: 'Dr. Johnson',
    },
  ]

  const StatCard = ({ title, value, description, icon: Icon, href, change }: any) => (
    <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {change && (
          <div className="flex items-center text-xs text-green-600 mt-1">
            <TrendingUp className="h-3 w-3 mr-1" />
            {change}
          </div>
        )}
        {href && (
          <Link href={href}>
            <Button variant="ghost" size="sm" className="mt-2 h-8 px-2">
              View details
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {profile?.first_name}!
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening at {currentPractice?.name || 'your practice'} today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Patients"
          value={stats.totalPatients.toLocaleString()}
          description="Active patients in system"
          icon={Users}
          href="/dashboard/patients"
          change="+12% from last month"
        />
        <StatCard
          title="Today's Appointments"
          value={stats.todayAppointments}
          description="Scheduled for today"
          icon={Calendar}
          href="/dashboard/appointments"
          change="+3 from yesterday"
        />
        <StatCard
          title="Monthly Revenue"
          value={`N$${stats.monthlyRevenue.toLocaleString()}`}
          description="This month's earnings"
          icon={DollarSign}
          href="/dashboard/billing"
          change="+8% from last month"
        />
        {profile?.role === 'admin' && (
          <StatCard
            title="Practices"
            value={stats.practiceCount}
            description="Active practice locations"
            icon={Building2}
            href="/dashboard/practices"
          />
        )}
        <StatCard
          title="Pending Bills"
          value={stats.pendingBills}
          description="Awaiting payment"
          icon={AlertCircle}
          href="/dashboard/billing?status=pending"
        />
        <StatCard
          title="Active Tariffs"
          value={stats.activeTariffs}
          description="Current pricing items"
          icon={Receipt}
          href="/dashboard/tariffs"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest updates from your practice
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-onehealth-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <activity.icon className="h-4 w-4 text-onehealth-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link href="/dashboard/activity">
                <Button variant="ghost" size="sm" className="w-full">
                  View all activity
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* SMS Balance Widget - Only show for admins */}
        {profile?.role === 'admin' && (
          <SMSBalanceWidget />
        )}

        {/* Upcoming Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Today's Appointments
            </CardTitle>
            <CardDescription>
              Next appointments scheduled
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingAppointments.map((appointment) => (
                <div key={appointment.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-8 bg-onehealth-600 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium">{appointment.patient}</p>
                      <p className="text-xs text-gray-500">
                        {appointment.type} • {appointment.doctor}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-onehealth-600">
                    {appointment.time}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link href="/dashboard/appointments">
                <Button variant="ghost" size="sm" className="w-full">
                  View all appointments
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks to get you started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/dashboard/patients/new">
              <Button variant="outline" className="w-full h-16 flex flex-col space-y-2">
                <Users className="h-5 w-5" />
                <span className="text-sm">Add Patient</span>
              </Button>
            </Link>
            <Link href="/dashboard/appointments/new">
              <Button variant="outline" className="w-full h-16 flex flex-col space-y-2">
                <Calendar className="h-5 w-5" />
                <span className="text-sm">Schedule Appointment</span>
              </Button>
            </Link>
            <Link href="/dashboard/billing/new">
              <Button variant="outline" className="w-full h-16 flex flex-col space-y-2">
                <CreditCard className="h-5 w-5" />
                <span className="text-sm">Create Invoice</span>
              </Button>
            </Link>
            <Link href="/dashboard/tariffs/new">
              <Button variant="outline" className="w-full h-16 flex flex-col space-y-2">
                <Receipt className="h-5 w-5" />
                <span className="text-sm">Add Tariff</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      
      <Toaster position="top-right" />
    </div>
  )
}