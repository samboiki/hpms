import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Clock, 
  Calendar, 
  Users,
  Edit3,
  Image,
  User
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

// Mock practice data
const practiceData = {
  name: 'HealthCare Medical Center',
  logo: 'https://images.pexels.com/photos/5412/water-blue-ocean.jpg?auto=compress&cs=tinysrgb&w=300',
  address: '123 Main Street, Suite 100, Anytown, CA 94321',
  phone: '(555) 123-4567',
  email: 'info@healthcaremedical.com',
  website: 'www.healthcaremedical.com',
  description: 'HealthCare Medical Center is dedicated to providing comprehensive healthcare services with a focus on patient comfort and cutting-edge medical technology. Our team of experienced healthcare professionals is committed to delivering personalized care to meet the unique needs of each patient.',
  specialties: ['Family Medicine', 'Internal Medicine', 'Pediatrics', 'Cardiology'],
  hours: [
    { day: 'Monday', hours: '8:00 AM - 6:00 PM' },
    { day: 'Tuesday', hours: '8:00 AM - 6:00 PM' },
    { day: 'Wednesday', hours: '8:00 AM - 6:00 PM' },
    { day: 'Thursday', hours: '8:00 AM - 6:00 PM' },
    { day: 'Friday', hours: '8:00 AM - 5:00 PM' },
    { day: 'Saturday', hours: '9:00 AM - 1:00 PM' },
    { day: 'Sunday', hours: 'Closed' },
  ],
  staff: [
    { 
      id: 'd1',
      name: 'Dr. Jane Smith', 
      role: 'Lead Physician', 
      specialty: 'Family Medicine',
      avatar: 'https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&cs=tinysrgb&w=200',
    },
    { 
      id: 'd2',
      name: 'Dr. Michael Chen', 
      role: 'Physician', 
      specialty: 'Internal Medicine',
      avatar: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=200',
    },
    { 
      id: 'd3',
      name: 'Dr. Sarah Johnson', 
      role: 'Physician', 
      specialty: 'Pediatrics',
      avatar: 'https://images.pexels.com/photos/5215024/pexels-photo-5215024.jpeg?auto=compress&cs=tinysrgb&w=200',
    },
    { 
      id: 's1',
      name: 'Emily Wilson', 
      role: 'Nurse Practitioner', 
      specialty: 'Family Medicine',
      avatar: 'https://images.pexels.com/photos/5214961/pexels-photo-5214961.jpeg?auto=compress&cs=tinysrgb&w=200',
    },
    { 
      id: 's2',
      name: 'Robert Brown', 
      role: 'Medical Assistant', 
      specialty: 'General',
      avatar: 'https://images.pexels.com/photos/5490276/pexels-photo-5490276.jpeg?auto=compress&cs=tinysrgb&w=200',
    },
  ],
  socialMedia: {
    facebook: 'facebook.com/healthcaremedical',
    twitter: 'twitter.com/healthcaremedical',
    instagram: 'instagram.com/healthcaremedical',
  },
};

const PracticeProfile: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'staff' | 'hours'>('profile');

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row items-center justify-between mb-6">
        <div className="flex items-center">
          <Building2 size={28} className="text-primary-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Practice Profile</h1>
            <p className="text-gray-600">Manage your practice information and branding</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0">
          <Button variant="outline">
            <Globe size={16} className="mr-2" />
            Preview Website
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 px-4 text-sm font-medium ${
            activeTab === 'profile'
              ? 'text-primary-600 border-b-2 border-primary-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Practice Info
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`pb-3 px-4 text-sm font-medium ${
            activeTab === 'staff'
              ? 'text-primary-600 border-b-2 border-primary-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Staff
        </button>
        <button
          onClick={() => setActiveTab('hours')}
          className={`pb-3 px-4 text-sm font-medium ${
            activeTab === 'hours'
              ? 'text-primary-600 border-b-2 border-primary-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Hours & Availability
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  {practiceData.logo ? (
                    <img 
                      src={practiceData.logo} 
                      alt={practiceData.name}
                      className="w-24 h-24 rounded-full object-cover mb-4"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                      <Building2 size={40} className="text-gray-400" />
                    </div>
                  )}
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    {practiceData.name}
                  </h2>
                  <div className="space-y-2 w-full mt-4">
                    <div className="flex items-center py-2">
                      <MapPin size={16} className="text-gray-400 mr-3" />
                      <span className="text-sm text-gray-700">{practiceData.address}</span>
                    </div>
                    <div className="flex items-center py-2">
                      <Phone size={16} className="text-gray-400 mr-3" />
                      <span className="text-sm text-gray-700">{practiceData.phone}</span>
                    </div>
                    <div className="flex items-center py-2">
                      <Mail size={16} className="text-gray-400 mr-3" />
                      <span className="text-sm text-gray-700">{practiceData.email}</span>
                    </div>
                    <div className="flex items-center py-2">
                      <Globe size={16} className="text-gray-400 mr-3" />
                      <span className="text-sm text-gray-700">{practiceData.website}</span>
                    </div>
                  </div>
                  <Button variant="outline" className="mt-4 w-full">
                    <Edit3 size={16} className="mr-2" />
                    Edit Practice Info
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Hours of Operation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {practiceData.hours.map((day, idx) => (
                    <div key={idx} className="flex justify-between py-2 text-sm">
                      <span className="font-medium text-gray-700">{day.day}</span>
                      <span className="text-gray-600">{day.hours}</span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-4 w-full">
                  <Clock size={14} className="mr-2" />
                  Manage Hours
                </Button>
              </CardContent>
            </Card>
          </div>
          
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Practice Description</CardTitle>
                  <Button variant="ghost" size="sm">
                    <Edit3 size={16} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{practiceData.description}</p>
              </CardContent>
            </Card>
            
            <Card className="mb-6">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Specialties & Services</CardTitle>
                  <Button variant="ghost" size="sm">
                    <Edit3 size={16} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {practiceData.specialties.map((specialty, idx) => (
                    <span 
                      key={idx}
                      className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-4">
                  Add Specialty
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Website Appearance</CardTitle>
                  <Button variant="ghost" size="sm">
                    <Edit3 size={16} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Logo & Branding</h4>
                    <div className="border border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center">
                      <Image size={40} className="text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">Upload your practice logo</p>
                      <Button size="sm" className="mt-3">
                        Upload
                      </Button>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Color Scheme</h4>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded bg-primary-500 mr-3"></div>
                        <span className="text-sm text-gray-700">Primary Color</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded bg-secondary-500 mr-3"></div>
                        <span className="text-sm text-gray-700">Secondary Color</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded bg-accent-500 mr-3"></div>
                        <span className="text-sm text-gray-700">Accent Color</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      
      {activeTab === 'staff' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-medium text-gray-900">Practice Staff</h2>
            <Button>
              <Users size={16} className="mr-2" />
              Add Staff Member
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {practiceData.staff.map((staff) => (
              <Card key={staff.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center">
                    {staff.avatar ? (
                      <img 
                        src={staff.avatar} 
                        alt={staff.name}
                        className="w-20 h-20 rounded-full object-cover mb-3"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                        <User size={32} className="text-gray-400" />
                      </div>
                    )}
                    <h3 className="text-lg font-bold text-gray-900">
                      {staff.name}
                    </h3>
                    <p className="text-primary-600 font-medium">
                      {staff.role}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {staff.specialty}
                    </p>
                    <div className="flex mt-4 space-x-2">
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm">
                        Remove
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Add New Staff Card */}
            <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center text-center h-full py-8">
                  <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                    <Users size={32} className="text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-700">
                    Add Team Member
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 mb-4">
                    Add a new doctor or staff member
                  </p>
                  <Button>
                    Add Staff
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      
      {activeTab === 'hours' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Hours of Operation</CardTitle>
                <Button variant="ghost" size="sm">
                  <Edit3 size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {practiceData.hours.map((day, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="font-medium text-gray-700">{day.day}</span>
                    <div className="flex items-center">
                      <span className="text-gray-600 mr-4">{day.hours}</span>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#01b9d5]" />
                Staff Availability
              </h3>
            </div>
            
            <div className="space-y-4">
              {practiceData.staff
                .filter(s => s.role.includes('Physician') || s.role.includes('Doctor'))
                .map((staff, index) => (
                  <motion.div 
                    key={staff.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center">
                      {staff.avatar ? (
                        <img 
                          src={staff.avatar} 
                          alt={staff.name}
                          className="w-12 h-12 rounded-full object-cover mr-3 border-2 border-[#01b9d5]/20"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-[#01b9d5] to-purple-600 rounded-full flex items-center justify-center mr-3">
                          <User size={20} className="text-white" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-medium text-gray-900">{staff.name}</h4>
                        <p className="text-sm text-gray-500">{staff.specialty}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-green-600">Available</span>
                        </div>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 px-3 py-2 border border-[#01b9d5] text-[#01b9d5] rounded-lg hover:bg-[#01b9d5]/5 transition-colors"
                    >
                      <Calendar className="w-4 h-4" />
                      Schedule
                    </motion.button>
                  </motion.div>
                ))
              }
            </div>
            
            <div className="text-center mt-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-3 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-300"
              >
                Manage All Schedules
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PracticeProfile;