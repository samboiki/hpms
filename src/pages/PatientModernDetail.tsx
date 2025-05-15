import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Star,
  Video,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';

interface Doctor {
  id: string;
  name: string;
  role: string;
  specialty: string;
  avatar?: string;
  bio: string;
  rating: number;
  reviews: number;
  availability: {
    date: string;
    slots: string[];
  }[];
}

interface TimeSlot {
  time: string;
  available: boolean;
}

const PatientModernDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Mock data for doctors
  const doctors: Doctor[] = [
    {
      id: 'd1',
      name: 'Dr. Norma Murphy',
      role: 'Clinical Psychologist',
      specialty: 'Anxiety & Depression',
      avatar: 'https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&cs=tinysrgb&w=300',
      bio: 'Dr. Murphy specializes in helping people overcome a range of anxiety issues, particularly when they relate to self-esteem. She draws upon several different types of therapy to tailor the most effective approach for...',
      rating: 4.9,
      reviews: 128,
      availability: [
        {
          date: '2024-03-20',
          slots: ['09:00', '10:00', '14:00', '15:00']
        }
      ]
    },
    {
      id: 'd2',
      name: 'Dr. Oliver Bailey',
      role: 'Psychotherapist',
      specialty: 'Trauma & PTSD',
      avatar: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=300',
      bio: 'Having completed extensive training in psychodynamic approaches, Oliver offers...',
      rating: 4.8,
      reviews: 96,
      availability: [
        {
          date: '2024-03-20',
          slots: ['11:00', '13:00', '16:00']
        }
      ]
    }
  ];

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        
        // Set initial doctor
        setSelectedDoctor(doctors[0]);
        
      } catch (error) {
        console.error('Error fetching patient:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatientData();
  }, [id]);

  const timeSlots: TimeSlot[] = [
    { time: '09:00', available: true },
    { time: '10:00', available: true },
    { time: '11:00', available: false },
    { time: '14:00', available: true },
    { time: '15:00', available: true },
    { time: '16:00', available: true }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.3,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-gray-50"
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <h1 className="text-[30px] font-bold text-[#494c61]">Book Appointment</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline">
                Need more help?
              </Button>
              <Button>
                Guided Matching
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Left Sidebar - Filters */}
          <div className="col-span-3">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Your Preferences</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">I want some help with...</span>
                        <ChevronRight size={16} className="text-gray-400" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Anxiety</span>
                        <ChevronRight size={16} className="text-gray-400" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Location</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">City location</span>
                        <ChevronRight size={16} className="text-gray-400" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">How</h3>
                    <div className="space-y-2">
                      <button className="flex items-center space-x-3 w-full p-2 rounded-lg hover:bg-gray-100">
                        <Video size={16} className="text-blue-500" />
                        <span className="text-sm">Video Call</span>
                      </button>
                      <button className="flex items-center space-x-3 w-full p-2 rounded-lg hover:bg-gray-100">
                        <MessageSquare size={16} className="text-gray-400" />
                        <span className="text-sm">Live Chat</span>
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Doctor List */}
          <div className="col-span-9 space-y-6">
            {doctors.map((doctor) => (
              <motion.div
                key={doctor.id}
                variants={itemVariants}
                className={`bg-white rounded-xl p-6 border ${
                  selectedDoctor?.id === doctor.id ? 'border-blue-500' : 'border-gray-200'
                }`}
                onClick={() => setSelectedDoctor(doctor)}
              >
                <div className="flex items-start space-x-6">
                  <img
                    src={doctor.avatar}
                    alt={doctor.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{doctor.name}</h3>
                        <p className="text-sm text-gray-500">{doctor.role} • {doctor.specialty}</p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Star size={16} className="text-yellow-400 fill-current" />
                        <span className="text-sm font-medium">{doctor.rating}</span>
                        <span className="text-sm text-gray-500">({doctor.reviews})</span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">{doctor.bio}</p>
                    
                    {selectedDoctor?.id === doctor.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t border-gray-100"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-4">
                            <Badge variant="success" size="sm">Available Tomorrow</Badge>
                            <Badge variant="glass" size="sm">$150 / session</Badge>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button className="p-2 hover:bg-gray-100 rounded-lg">
                              <ChevronLeft size={16} />
                            </button>
                            <span className="text-sm font-medium">Tomorrow</span>
                            <button className="p-2 hover:bg-gray-100 rounded-lg">
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-3">
                          {timeSlots.map((slot, index) => (
                            <button
                              key={index}
                              disabled={!slot.available}
                              className={`
                                py-2 px-4 rounded-lg text-sm font-medium
                                ${slot.available
                                  ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                  : 'bg-gray-50 text-gray-400 cursor-not-allowed'}
                              `}
                            >
                              {slot.time}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PatientModernDetail;