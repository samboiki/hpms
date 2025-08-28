'use client';

import React, { useState, useEffect } from 'react';
import { Users, Calendar, TrendingUp, Download, LogOut, Filter, Search, Eye } from 'lucide-react';

interface RegistrationData {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  attendees: number;
  attendingDays: string[];
  mealPreference: string;
  drinkPreferences: string[];
  accessibility: string;
  timestamp: string;
  confirmationId: string;
}

interface AdminDashboardProps {
  onLogout: () => void;
}

function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [registrations, setRegistrations] = useState<RegistrationData[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<RegistrationData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dayFilter, setDayFilter] = useState('all');
  const [selectedRegistration, setSelectedRegistration] = useState<RegistrationData | null>(null);
  const [currentUser, setCurrentUser] = useState('');

  useEffect(() => {
    // Load registrations from localStorage
    const stored = localStorage.getItem('registrations');
    const adminUser = localStorage.getItem('farmaris_admin_user') || 'admin';
    setCurrentUser(adminUser);
    
    if (stored) {
      const data = JSON.parse(stored);
      setRegistrations(data);
      setFilteredRegistrations(data);
    }
  }, []);

  useEffect(() => {
    // Filter registrations based on search and day filter
    let filtered = registrations;

    if (searchTerm) {
      filtered = filtered.filter(reg =>
        reg.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reg.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reg.phone.includes(searchTerm)
      );
    }

    if (dayFilter !== 'all') {
      filtered = filtered.filter(reg =>
        reg.attendingDays.some(day => day.toLowerCase().includes(dayFilter))
      );
    }

    setFilteredRegistrations(filtered);
  }, [registrations, searchTerm, dayFilter]);

  const getTotalAttendees = () => {
    return registrations.reduce((total, reg) => total + reg.attendees, 0);
  };

  const getDayStatistics = () => {
    const stats = {
      friday: 0,
      saturday: 0,
      both: 0
    };

    registrations.forEach(reg => {
      reg.attendingDays.forEach(day => {
        if (day.includes('Friday')) stats.friday++;
        if (day.includes('Saturday')) stats.saturday++;
        if (day.includes('Both')) stats.both++;
      });
    });

    return stats;
  };

  const getDrinkStatistics = () => {
    const drinkCounts: { [key: string]: number } = {};
    
    registrations.forEach(reg => {
      reg.drinkPreferences.forEach(drink => {
        drinkCounts[drink] = (drinkCounts[drink] || 0) + 1;
      });
    });

    return Object.entries(drinkCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10 drinks
  };

  const exportToCSV = () => {
    const headers = [
      'Name', 'Email', 'Phone', 'Attendees', 'Days Attending', 'Meal Preference', 
      'Drink Preferences', 'Special Requirements', 'Registration Date', 'Confirmation ID'
    ];

    const csvData = [
      headers,
      ...filteredRegistrations.map(reg => [
        reg.fullName,
        reg.email,
        reg.phone,
        reg.attendees.toString(),
        reg.attendingDays.join('; '),
        reg.mealPreference,
        reg.drinkPreferences.join('; '),
        reg.accessibility,
        new Date(reg.timestamp).toLocaleString(),
        reg.confirmationId
      ])
    ];

    const csvContent = csvData.map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `farm-aris-registrations-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const dayStats = getDayStatistics();
  const drinkStats = getDrinkStatistics();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <img src="/images/farmaris/logo.jpg" alt="Farm Aris" className="h-8 w-auto" />
            <h1 className="text-2xl font-bold text-gray-800">Farm Aris Admin Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Welcome, {currentUser}</span>
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Total Registrations</h3>
                <p className="text-3xl font-bold text-blue-600">{registrations.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Total Attendees</h3>
                <p className="text-3xl font-bold text-green-600">{getTotalAttendees()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-yellow-600" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Friday Only</h3>
                <p className="text-3xl font-bold text-yellow-600">{dayStats.friday}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Both Days</h3>
                <p className="text-3xl font-bold text-purple-600">{dayStats.both}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search registrations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-lg w-64"
                />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={dayFilter}
                  onChange={(e) => setDayFilter(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-lg appearance-none bg-white"
                >
                  <option value="all">All Days</option>
                  <option value="friday">Friday Only</option>
                  <option value="saturday">Saturday Only</option>
                  <option value="both">Both Days</option>
                </select>
              </div>
            </div>

            <button
              onClick={exportToCSV}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Registrations Table */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">Registrations ({filteredRegistrations.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendees</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRegistrations.map((reg) => (
                    <tr key={reg.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{reg.fullName}</div>
                          <div className="text-sm text-gray-500">ID: {reg.confirmationId}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{reg.email}</div>
                        <div className="text-sm text-gray-500">{reg.phone}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{reg.attendees}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {reg.attendingDays.map((day, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {day.includes('Friday') ? 'Fri' : day.includes('Saturday') ? 'Sat' : 'Both'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedRegistration(reg)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Analytics Panel */}
          <div className="space-y-6">
            {/* Drink Preferences */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Drink Preferences</h3>
              <div className="space-y-3">
                {drinkStats.map(([drink, count]) => (
                  <div key={drink} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{drink}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
                          style={{ width: `${(count / registrations.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Day Breakdown */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Day Attendance</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Friday (Bonfire)</span>
                  <span className="text-lg font-semibold text-yellow-600">{dayStats.friday}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Saturday (Main)</span>
                  <span className="text-lg font-semibold text-green-600">{dayStats.saturday}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Both Days</span>
                  <span className="text-lg font-semibold text-purple-600">{dayStats.both}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Detail Modal */}
      {selectedRegistration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">Registration Details</h3>
                <button
                  onClick={() => setSelectedRegistration(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <strong>Name:</strong> {selectedRegistration.fullName}
                </div>
                <div>
                  <strong>Email:</strong> {selectedRegistration.email}
                </div>
                <div>
                  <strong>Phone:</strong> {selectedRegistration.phone}
                </div>
                <div>
                  <strong>Number of Attendees:</strong> {selectedRegistration.attendees}
                </div>
                <div>
                  <strong>Days Attending:</strong> {selectedRegistration.attendingDays.join(', ')}
                </div>
                <div>
                  <strong>Meal Preference:</strong> {selectedRegistration.mealPreference || 'Not specified'}
                </div>
                <div>
                  <strong>Drink Preferences:</strong> {selectedRegistration.drinkPreferences.join(', ') || 'Not specified'}
                </div>
                <div>
                  <strong>Special Requirements:</strong> {selectedRegistration.accessibility || 'None'}
                </div>
                <div>
                  <strong>Registration Date:</strong> {new Date(selectedRegistration.timestamp).toLocaleString()}
                </div>
                <div>
                  <strong>Confirmation ID:</strong> {selectedRegistration.confirmationId}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;