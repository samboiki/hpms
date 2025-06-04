import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { 
  Building2, 
  Users, 
  Receipt, 
  BarChart3, 
  Shield, 
  Clock,
  CheckCircle,
  ArrowRight,
  Heart,
  Stethoscope,
  Calendar
} from 'lucide-react'

const features = [
  {
    icon: Building2,
    title: "Multi-Practice Management",
    description: "Manage multiple practice locations from a single platform with centralized oversight."
  },
  {
    icon: Users,
    title: "User & Role Management",
    description: "Comprehensive user management with role-based access control for all staff levels."
  },
  {
    icon: Receipt,
    title: "Tariff Management",
    description: "Import and manage dental/medical tariffs with custom pricing per practice."
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description: "Detailed analytics, financial summaries, and comprehensive reporting tools."
  },
  {
    icon: Shield,
    title: "Security & Compliance",
    description: "Enterprise-grade security with audit logs and compliance features."
  },
  {
    icon: Clock,
    title: "Real-time Updates",
    description: "Live updates across all modules with instant synchronization."
  }
]

const benefits = [
  "Streamlined practice operations",
  "Improved patient care coordination",
  "Enhanced financial management",
  "Compliance with healthcare regulations",
  "Scalable multi-location support",
  "Comprehensive audit trails"
]

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-onehealth-500 to-onehealth-600 rounded-lg flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold text-gradient">OneHealth</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/auth/login">
                <Button variant="ghost">Login</Button>
              </Link>
              <Link href="/auth/register">
                <Button className="btn-primary">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-onehealth-50 to-blue-50">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="container mx-auto px-4 py-24">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="flex items-center space-x-2 bg-onehealth-100 px-4 py-2 rounded-full">
                <Stethoscope className="w-5 h-5 text-onehealth-600" />
                <span className="text-onehealth-700 font-medium">Healthcare Management Platform</span>
              </div>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Transform Your
              <span className="text-gradient block">Practice Management</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Comprehensive practice management solution designed for modern healthcare providers. 
              Streamline operations, enhance patient care, and grow your practice with OneHealth.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/register">
                <Button size="lg" className="btn-primary text-lg px-8 py-3">
                  Start Free Trial
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="text-lg px-8 py-3">
                  View Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Run Your Practice
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From patient management to financial reporting, OneHealth provides all the tools 
              you need to operate efficiently and deliver exceptional care.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-all duration-200 group">
                <div className="w-12 h-12 bg-onehealth-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-onehealth-200 transition-colors">
                  <feature.icon className="w-6 h-6 text-onehealth-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Why Choose OneHealth?
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Built specifically for Namibian healthcare providers, OneHealth understands 
                your unique challenges and regulatory requirements.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-onehealth-600 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8">
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-8 h-8 text-onehealth-600" />
                      <div>
                        <div className="font-semibold">Today's Appointments</div>
                        <div className="text-sm text-gray-500">24 scheduled</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-onehealth-600">24</div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Users className="w-8 h-8 text-blue-600" />
                      <div>
                        <div className="font-semibold">Active Patients</div>
                        <div className="text-sm text-gray-500">This month</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">1,247</div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <BarChart3 className="w-8 h-8 text-green-600" />
                      <div>
                        <div className="font-semibold">Revenue</div>
                        <div className="text-sm text-gray-500">This month</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-green-600">N$45k</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 gradient-bg">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Practice?
          </h2>
          <p className="text-xl text-onehealth-100 mb-8 max-w-2xl mx-auto">
            Join hundreds of healthcare providers in Namibia who trust OneHealth 
            to manage their practices efficiently and effectively.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register">
              <Button size="lg" className="bg-white text-onehealth-600 hover:bg-gray-100 text-lg px-8 py-3">
                Start Your Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-onehealth-600 text-lg px-8 py-3">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-onehealth-500 to-onehealth-600 rounded-lg flex items-center justify-center">
                  <Heart className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">OneHealth</span>
              </div>
              <p className="text-gray-400">
                Transforming healthcare practice management in Namibia.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/demo" className="hover:text-white transition-colors">Demo</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 OneHealth. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}