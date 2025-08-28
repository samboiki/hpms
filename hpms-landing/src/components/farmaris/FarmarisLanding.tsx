'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Users, Phone, Mail, Calendar, ChevronDown, Star, Camera, MessageCircle, Share2, Plus, Minus, ExternalLink } from 'lucide-react';
import FarmLocation from './FarmLocation';

interface RegistrationData {
  fullName: string;
  email: string;
  phone: string;
  attendees: number;
  attendingDays: string[];
  accessibility: string;
  mealPreference: string;
  drinkPreferences: string[];
}

function FarmarisLanding() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    fullName: '',
    email: '',
    phone: '',
    attendees: 1,
    attendingDays: [],
    accessibility: '',
    mealPreference: '',
    drinkPreferences: []
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Event date: October 10, 2025, 10:00 AM (First day - Welcome & Bonfire)
  const eventDate = new Date('2025-10-10T10:00:00');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = eventDate.getTime() - now;

      if (distance > 0) {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save registration data to localStorage (in real app, this would go to a database)
    const registrations = JSON.parse(localStorage.getItem('registrations') || '[]');
    const newRegistration = {
      ...registrationData,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      confirmationId: `AF2025-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    };
    registrations.push(newRegistration);
    localStorage.setItem('registrations', JSON.stringify(registrations));
    
    setIsSubmitted(true);
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDaySelection = (day: string) => {
    const updatedDays = registrationData.attendingDays.includes(day)
      ? registrationData.attendingDays.filter(d => d !== day)
      : [...registrationData.attendingDays, day];
    setRegistrationData({...registrationData, attendingDays: updatedDays});
  };

  const handleDrinkSelection = (drink: string) => {
    const updatedDrinks = registrationData.drinkPreferences.includes(drink)
      ? registrationData.drinkPreferences.filter(d => d !== drink)
      : [...registrationData.drinkPreferences, drink];
    setRegistrationData({...registrationData, drinkPreferences: updatedDrinks});
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm shadow-sm z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <img 
              src="/images/farmaris/logo.jpg" 
              alt="Farm Aris Logo" 
              className="h-10 w-auto object-contain"
            />
            <div className="font-bold text-xl text-green-800">Farm Aris</div>
          </div>
          <div className="flex space-x-6">
            <a href="#event" className="text-green-700 hover:text-green-900">Event Details</a>
            <a href="#location" className="text-green-700 hover:text-green-900">Location</a>
            <a href="#registration" className="text-green-700 hover:text-green-900">RSVP</a>
            <a href="/?practice=farmaris&page=admin" className="text-gray-500 hover:text-gray-700 text-sm">Admin</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen bg-gradient-to-br from-amber-800 via-yellow-700 to-orange-600 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-90"
          style={{
            backgroundImage: `url('https://images.pexels.com/photos/974314/pexels-photo-974314.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop')`
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        
        <div className="relative z-10 flex items-center justify-center h-full px-4 pt-16">
          <div className="text-center text-white max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in">
              Grand Opening of
              <span className="block text-yellow-400 mt-2">Farm Aris</span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 opacity-95">
              A Weekend of Joy, Laughter & Unforgettable Farm Adventures
            </p>
            
            {/* ✨ WORLD-CLASS PREMIUM COUNTDOWN EXPERIENCE ✨ */}
            <div className="relative mb-12 perspective-1000">
              {/* Animated particles background */}
              <div className="absolute inset-0 overflow-hidden rounded-3xl">
                <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-yellow-400 rounded-full animate-ping" style={{ animationDelay: '0s', animationDuration: '3s' }} />
                <div className="absolute top-3/4 right-1/3 w-2 h-2 bg-orange-400 rounded-full animate-ping" style={{ animationDelay: '1s', animationDuration: '3s' }} />
                <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-amber-400 rounded-full animate-ping" style={{ animationDelay: '2s', animationDuration: '3s' }} />
              </div>

              {/* Ultra-premium glassmorphic container with 3D effect */}
              <div className="relative transform transition-all duration-700 hover:scale-[1.02] hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 via-yellow-500/20 to-orange-600/20 rounded-3xl blur-2xl animate-pulse" style={{ animationDuration: '4s' }} />
                
                <div className="relative bg-gradient-to-br from-white/10 via-white/5 to-white/10 backdrop-blur-3xl border border-white/20 rounded-3xl p-10 shadow-[0_20px_70px_-15px_rgba(255,255,255,0.3)] overflow-hidden">
                  {/* Premium light effects */}
                  <div className="absolute inset-0">
                    {/* Animated gradient sweep */}
                    <div className="absolute inset-0 opacity-30">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
                    </div>
                    
                    {/* Corner glows */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-yellow-400/20 to-transparent rounded-full blur-3xl animate-pulse" />
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-tr from-orange-400/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                    
                    {/* Premium sparkle effects */}
                    <div className="absolute top-10 left-10 w-1 h-1 bg-white rounded-full animate-pulse" style={{ boxShadow: '0 0 10px rgba(255,255,255,0.8)' }} />
                    <div className="absolute bottom-10 right-10 w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.5s', boxShadow: '0 0 10px rgba(255,255,255,0.8)' }} />
                  </div>
                  
                  <div className="relative z-10">
                    {/* Stunning header with animation */}
                    <div className="text-center mb-10">
                      <div className="inline-block relative">
                        <h3 className="text-lg font-bold bg-gradient-to-r from-yellow-200 via-yellow-300 to-orange-300 bg-clip-text text-transparent uppercase tracking-[0.4em] animate-[fadeInUp_1s_ease-out]">
                          Grand Opening In
                        </h3>
                        <div className="absolute -bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent animate-[expandWidth_2s_ease-out]" />
                      </div>
                    </div>
                    
                    {/* Spectacular countdown display */}
                    <div className="grid grid-cols-4 gap-4 md:gap-8 max-w-3xl mx-auto">
                      {[
                        { label: 'Days', value: timeLeft.days, delay: '0ms', color: 'from-amber-400/30 to-amber-600/30' },
                        { label: 'Hours', value: timeLeft.hours, delay: '100ms', color: 'from-yellow-400/30 to-yellow-600/30' },
                        { label: 'Minutes', value: timeLeft.minutes, delay: '200ms', color: 'from-orange-400/30 to-orange-600/30' },
                        { label: 'Seconds', value: timeLeft.seconds, delay: '300ms', color: 'from-red-400/30 to-orange-600/30' }
                      ].map((item, index) => (
                        <div 
                          key={index} 
                          className="text-center transform transition-all duration-500 hover:scale-110 animate-[fadeInUp_1s_ease-out]"
                          style={{ animationDelay: item.delay }}
                        >
                          <div className="relative group cursor-pointer">
                            {/* Glow background */}
                            <div className={`absolute inset-0 bg-gradient-to-b ${item.color} rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500 scale-110`} />
                            
                            {/* Premium number container with 3D effect */}
                            <div className="relative bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-2xl border border-white/20 rounded-2xl overflow-hidden transition-all duration-500 group-hover:border-yellow-400/40 group-hover:shadow-[0_10px_40px_rgba(251,191,36,0.3)]">
                              {/* Inner glow */}
                              <div className="absolute inset-0 bg-gradient-to-t from-yellow-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                              
                              {/* Number display with flip animation potential */}
                              <div className="relative px-6 py-8 md:px-8 md:py-10">
                                <div className="relative">
                                  {/* Large dramatic numbers */}
                                  <div className="text-5xl md:text-6xl lg:text-7xl font-bold text-transparent bg-gradient-to-b from-white via-white to-white/70 bg-clip-text leading-none font-mono tabular-nums">
                                    {item.value.toString().padStart(2, '0')}
                                  </div>
                                  
                                  {/* Reflection effect */}
                                  <div className="absolute inset-0 top-1/2 text-5xl md:text-6xl lg:text-7xl font-bold text-white/10 leading-none font-mono transform scale-y-[-1] translate-y-full opacity-30 blur-[2px]">
                                    {item.value.toString().padStart(2, '0')}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Premium label */}
                              <div className="bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-xl border-t border-white/10 px-4 py-3">
                                <span className="text-xs font-bold text-white/90 uppercase tracking-[0.2em]">
                                  {item.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Spectacular date display with call-to-action */}
                    <div className="mt-12 text-center space-y-4">
                      {/* Date with premium styling */}
                      <div className="flex items-center justify-center space-x-6">
                        <div className="h-px w-20 bg-gradient-to-r from-transparent via-yellow-400/40 to-yellow-400/60" />
                        <div className="relative">
                          <span className="text-base font-light text-white/90 tracking-[0.3em] uppercase">
                            October 10-11, 2025
                          </span>
                          <div className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                        </div>
                        <div className="h-px w-20 bg-gradient-to-l from-transparent via-yellow-400/40 to-yellow-400/60" />
                      </div>
                      
                      {/* Animated CTA */}
                      <div className="pt-2">
                        <span className="inline-block text-sm font-medium text-yellow-300 animate-pulse">
                          Join us for an unforgettable celebration!
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Add custom animations */}
            <style jsx>{`
              @keyframes shimmer {
                to {
                  transform: translateX(200%);
                }
              }
              @keyframes fadeInUp {
                from {
                  opacity: 0;
                  transform: translateY(20px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              @keyframes expandWidth {
                from {
                  width: 0;
                  opacity: 0;
                }
                to {
                  width: 100%;
                  opacity: 1;
                }
              }
            `}</style>

            <div className="grid md:grid-cols-3 gap-6 mb-12 text-center">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                <p className="font-semibold">Oct 10-11, 2025</p>
                <p className="text-sm">Weekend Celebration</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                <MapPin className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                <p className="font-semibold">Farm Aris</p>
                <p className="text-sm">Grootfontein, Namibia</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                <Users className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                <p className="font-semibold">Safari Theme</p>
                <p className="text-sm">Khaki, Boots & Animal Prints</p>
              </div>
            </div>

            <button 
              onClick={() => scrollToSection('registration')}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 px-8 rounded-full text-xl transition-all duration-300 hover:scale-105 shadow-2xl"
            >
              RSVP Now
            </button>
          </div>
        </div>
        
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-8 h-8 text-white" />
        </div>
      </section>

      {/* Event Information */}
      <section id="event" className="py-16 bg-gradient-to-b from-green-50 to-yellow-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-green-800 mb-4">Welcome to Our Family</h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Join us for a celebration of growth, community, and the rich agricultural heritage of Namibia. 
              The Aris family invites you to witness the culmination of years of dedication and hard work 
              as we officially open our farm to the community.
            </p>
          </div>


          {/* Event Timeline */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h3 className="text-2xl font-bold text-center text-green-800 mb-8">Weekend Event Schedule</h3>
            
            {/* Friday Schedule */}
            <div className="mb-8">
              <h4 className="text-xl font-bold text-yellow-600 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Friday, 10 October 2025 - Welcome, Bonfire & Mrs Hanhabo's Birthday
              </h4>
              <div className="space-y-4">
                {[
                  { time: '4:00 PM', activity: 'Welcome & Registration', description: 'Arrival and check-in with traditional refreshments' },
                  { time: '5:00 PM', activity: 'Farm Tours & Meet the Animals', description: 'Explore the farm and meet our livestock' },
                  { time: '6:00 PM', activity: 'Mrs Hanhabo\'s Birthday Celebration', description: 'Special birthday festivities and cake' },
                  { time: '7:00 PM', activity: 'Traditional Braai Dinner', description: 'Authentic Namibian BBQ under the stars' },
                  { time: '8:30 PM', activity: 'Bonfire & Storytelling', description: 'Gather around the fire with music and stories' },
                  { time: '10:00 PM', activity: 'Camping Setup', description: 'Set up tents for overnight camping' }
                ].map((item, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="bg-yellow-500 text-black px-3 py-1 rounded-full font-semibold text-sm">
                      {item.time}
                    </div>
                    <div className="flex-1">
                      <h5 className="font-semibold text-green-800">{item.activity}</h5>
                      <p className="text-gray-600 text-sm">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Saturday Schedule */}
            <div>
              <h4 className="text-xl font-bold text-yellow-600 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Saturday, 11 October 2025 - Main Celebration
              </h4>
              <div className="space-y-4">
                {[
                  { time: '7:00 AM', activity: 'Sunrise & Traditional Coffee', description: 'Start the day with Namibian coffee and rusks' },
                  { time: '9:00 AM', activity: 'Official Opening Ceremony', description: 'Ribbon cutting and blessing of the farm' },
                  { time: '10:00 AM', activity: 'Guided Farm Tours', description: 'Comprehensive tours of our farming operations' },
                  { time: '12:00 PM', activity: 'Traditional Lunch', description: 'Local cuisine and specialties' },
                  { time: '2:00 PM', activity: 'Cultural Performances', description: 'Traditional music, dance and entertainment' },
                  { time: '3:30 PM', activity: 'Children\'s Activities', description: 'Farm games and animal interactions' },
                  { time: '5:00 PM', activity: 'Community Celebration', description: 'Music, dancing, and community fellowship' },
                  { time: '7:00 PM', activity: 'Farewell Gathering', description: 'Closing ceremony and group photos' }
                ].map((item, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="bg-green-600 text-white px-3 py-1 rounded-full font-semibold text-sm">
                      {item.time}
                    </div>
                    <div className="flex-1">
                      <h5 className="font-semibold text-green-800">{item.activity}</h5>
                      <p className="text-gray-600 text-sm">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Event Highlights */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center text-green-800 mb-12">Event Highlights</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Camera className="w-12 h-12 text-yellow-600" />,
                title: 'Farm Tours',
                description: 'Guided walks through our sustainable farming operations'
              },
              {
                icon: <Star className="w-12 h-12 text-yellow-600" />,
                title: 'Cultural Show',
                description: 'Traditional Namibian music and dance performances'
              },
              {
                icon: <Users className="w-12 h-12 text-yellow-600" />,
                title: 'Traditional Braai',
                description: 'Authentic Namibian BBQ with local specialties'
              },
              {
                icon: <Plus className="w-12 h-12 text-yellow-600" />,
                title: 'Family Fun',
                description: 'Activities for children and interactive experiences'
              }
            ].map((highlight, index) => (
              <div key={index} className="text-center bg-green-50 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-4">{highlight.icon}</div>
                <h3 className="font-bold text-green-800 mb-2">{highlight.title}</h3>
                <p className="text-gray-600 text-sm">{highlight.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Location Section */}
      <FarmLocation />

      {/* Registration Form */}
      <section id="registration" className="py-16 bg-gradient-to-b from-green-50 to-yellow-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {!isSubmitted ? (
              <>
                <h2 className="text-3xl font-bold text-center text-green-800 mb-8">Reserve Your Spot</h2>
                <form onSubmit={handleRegistration} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={registrationData.fullName}
                        onChange={(e) => setRegistrationData({...registrationData, fullName: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={registrationData.email}
                        onChange={(e) => setRegistrationData({...registrationData, email: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Phone/WhatsApp *</label>
                      <input
                        type="tel"
                        required
                        value={registrationData.phone}
                        onChange={(e) => setRegistrationData({...registrationData, phone: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Attendees</label>
                      <div className="flex items-center space-x-3">
                        <button
                          type="button"
                          onClick={() => setRegistrationData({...registrationData, attendees: Math.max(1, registrationData.attendees - 1)})}
                          className="p-2 bg-green-100 rounded-lg hover:bg-green-200"
                        >
                          <Minus className="w-4 h-4 text-green-800" />
                        </button>
                        <span className="px-4 py-2 bg-gray-100 rounded-lg font-semibold">{registrationData.attendees}</span>
                        <button
                          type="button"
                          onClick={() => setRegistrationData({...registrationData, attendees: registrationData.attendees + 1})}
                          className="p-2 bg-green-100 rounded-lg hover:bg-green-200"
                        >
                          <Plus className="w-4 h-4 text-green-800" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Which Days Will You Attend?</label>
                    <div className="space-y-2">
                      {['Friday (Welcome & Bonfire)', 'Saturday (Main Celebration)', 'Both Days'].map((day) => (
                        <label key={day} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={registrationData.attendingDays.includes(day)}
                            onChange={() => handleDaySelection(day)}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-gray-700">{day}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Meal Preferences</label>
                    <select
                      value={registrationData.mealPreference}
                      onChange={(e) => setRegistrationData({...registrationData, mealPreference: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Select preference</option>
                      <option value="braai">Traditional Braai/Meat</option>
                      <option value="vegetarian">Vegetarian</option>
                      <option value="vegan">Vegan</option>
                      <option value="namibian">Traditional Namibian (Kapana, Mahangu)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Drink Preferences (Select all that apply)</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        'Beer', 'Wine', 'Ciders', 'Whiskey', 'Brandy', 'Gin',
                        'Soft Drinks', 'Traditional Brews', 'Coffee', 'Tea', 'Fruit Juices', 'Water'
                      ].map((drink) => (
                        <label key={drink} className="flex items-center space-x-2 cursor-pointer p-2 rounded border hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={registrationData.drinkPreferences.includes(drink)}
                            onChange={() => handleDrinkSelection(drink)}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-gray-700 text-sm">{drink}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Special Requirements</label>
                    <textarea
                      value={registrationData.accessibility}
                      onChange={(e) => setRegistrationData({...registrationData, accessibility: e.target.value})}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Any accessibility needs, dietary restrictions, or special requests..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all duration-300 hover:scale-105"
                  >
                    Confirm Registration
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Star className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-3xl font-bold text-green-800 mb-4">Registration Confirmed!</h2>
                <p className="text-lg text-gray-700 mb-6">
                  Thank you for registering! We've sent a confirmation with your QR code ticket to your email and WhatsApp.
                </p>
                <div className="bg-green-50 rounded-lg p-4 mb-6">
                  <p className="font-semibold text-green-800">Confirmation ID: AF2025-{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                  <p className="text-sm text-gray-600 mt-2">Save this ID for event check-in</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-amber-900 to-orange-800 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">Farm Aris</h3>
              <p className="text-green-200">Growing together in Namibia's heart</p>
              <p className="text-green-200 text-sm mt-2">Grootfontein, Namibia</p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Contact Information</h4>
              <div className="space-y-2 text-green-200">
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4" />
                  <span>Onesmus: +264 81 129 9623</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4" />
                  <span>Maano: +264 81 294 5818</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp Available</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4">Quick Links</h4>
              <div className="space-y-2 text-green-200">
                <div><a href="#registration" className="hover:text-white">RSVP</a></div>
                <div><a href="#event" className="hover:text-white">Event Details</a></div>
              </div>
            </div>
          </div>
          <div className="border-t border-green-700 mt-8 pt-8 text-center text-green-200">
            <p>&copy; 2025 Aris Farm. All rights reserved. | Growing sustainable communities in Namibia</p>
          </div>
        </div>
      </footer>

      {/* WhatsApp Chat Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <a
          href="https://wa.me/2648112996223?text=Hi, I'm interested in the Farm Aris Grand Opening event!"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110"
          title="WhatsApp Onesmus"
        >
          <MessageCircle className="w-6 h-6" />
        </a>
      </div>
    </div>
  );
}

export default FarmarisLanding;