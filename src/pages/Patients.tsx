import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  PlusCircle, 
  User,
  ChevronRight,
  FileText,
  Loader2,
  Calendar,
  Phone,
  Mail,
  Clock,
  AlertCircle,
  LayoutGrid,
  List,
  ArrowUpDown,
  Calendar as CalendarIcon
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { useNavigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import AddPatientForm from '../components/forms/AddPatientForm';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  cell_number: string;
  date_of_birth: string;
  gender: string;
  medical_aid_details?: {
    provider: string;
    membership_number: string;
  };
}

const Patients: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('patients')
        .select(`
          *,
          medical_aid_details (
            provider,
            membership_number
          )
        `);

      if (error) throw error;
      setPatients(data || []);
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError('Failed to load patients');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPatients = patients.filter(patient => {
    const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return fullName.includes(searchLower) || 
      (patient.email && patient.email.toLowerCase().includes(searchLower)) ||
      (patient.cell_number && patient.cell_number.includes(searchTerm));
  }).sort((a, b) => {
    if (sortBy === 'name') {
      const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
      const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    } else {
      const dateA = new Date(a.date_of_birth).getTime();
      const dateB = new Date(b.date_of_birth).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    }
  });

  const handlePatientAdded = () => {
    setIsAddPatientModalOpen(false);
    fetchPatients();
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const toggleSort = (field: 'name' | 'date') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between mb-6">
        <div className="flex items-center">
          <div>
            <h1 className="text-[30px] font-bold font-heading text-[#494c61]">Patients</h1>
            <p className="text-gray-600">Manage your patient records and information</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0">
          <Button 
            size="sm"
            className="bg-gradient-to-r from-[#01b9d4] to-[#01b9d4]"
            onClick={() => setIsAddPatientModalOpen(true)}
          >
            <PlusCircle size={16} className="mr-2" />
            Add Patient
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search patients by name, email, or phone"
                className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:ring-brand-primary focus:border-brand-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
              >
                {view === 'grid' ? (
                  <List size={16} className="mr-2" />
                ) : (
                  <LayoutGrid size={16} className="mr-2" />
                )}
                {view === 'grid' ? 'List View' : 'Grid View'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="bg-white p-8 rounded-xl shadow-lg text-center">
            <Loader2 size={32} className="animate-spin text-[#01b9d4] mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Loading patients...</p>
          </div>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="bg-white p-8 rounded-xl shadow-lg">
            <AlertCircle size={40} className="mx-auto text-error-500 mb-4" />
            <p className="text-error-600 font-medium">{error}</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => fetchPatients()}
            >
              Try Again
            </Button>
          </div>
        </div>
      ) : (
        <>
          {view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredPatients.map((patient) => (
                <Card
                  key={patient.id}
                  className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer bg-gradient-to-b from-white to-gray-50"
                  onClick={() => navigate(`/patients/${patient.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-20 h-20 bg-gradient-to-br from-[#01b9d4] to-[#e6f9fc] rounded-full flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                        <User size={32} className="text-[#01b9d4]" />
                      </div>
                      <h3 className="text-lg font-heading font-bold text-gray-900">
                        {patient.first_name} {patient.last_name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {calculateAge(patient.date_of_birth)} years • {patient.gender}
                      </p>
                      
                      <div className="w-full mt-4 space-y-2">
                        <div className="flex items-center justify-center text-sm text-gray-600">
                          <Mail size={14} className="mr-2 text-[#01b9d4]" />
                          {patient.email || 'No email'}
                        </div>
                        <div className="flex items-center justify-center text-sm text-gray-600">
                          <Phone size={14} className="mr-2 text-[#01b9d4]" />
                          {patient.cell_number || 'No phone'}
                        </div>
                      </div>

                      {patient.medical_aid_details && (
                        <div className="mt-4 flex items-center space-x-2">
                          <Badge variant="azure" size="sm">
                            {patient.medical_aid_details.provider}
                          </Badge>
                          <Badge variant="glass" size="sm">
                            Active
                          </Badge>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-gray-100 w-full">
                        <div className="flex items-center justify-center text-sm text-gray-500">
                          <Clock size={14} className="mr-2 text-[#01b9d4]" />
                          Last visit: {format(new Date(), 'MMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-0 shadow-lg overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => toggleSort('name')}
                      >
                        <div className="flex items-center">
                          Patient
                          <ArrowUpDown size={14} className="ml-1" />
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contact</th>
                      <th 
                        className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => toggleSort('date')}
                      >
                        <div className="flex items-center">
                          Age
                          <ArrowUpDown size={14} className="ml-1" />
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Medical Aid</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Visit</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredPatients.map((patient) => (
                      <tr 
                        key={patient.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer group"
                        onClick={() => navigate(`/patients/${patient.id}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 bg-gradient-to-br from-[#01b9d4] to-[#e6f9fc] rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
                              <User size={20} className="text-[#01b9d4]" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-bold text-gray-900">
                                {patient.first_name} {patient.last_name}
                              </div>
                              <div className="text-sm text-gray-500 capitalize">
                                {patient.gender}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{patient.email}</div>
                          <div className="text-sm text-gray-500">{patient.cell_number}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {calculateAge(patient.date_of_birth)} years
                          </div>
                          <div className="text-sm text-gray-500">
                            {format(new Date(patient.date_of_birth), 'MMM d, yyyy')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {patient.medical_aid_details ? (
                            <div>
                              <Badge variant="azure" size="sm">
                                {patient.medical_aid_details.provider}
                              </Badge>
                              <div className="text-xs text-gray-500 mt-1">
                                #{patient.medical_aid_details.membership_number}
                              </div>
                            </div>
                          ) : (
                            <Badge variant="glass" size="sm">No Insurance</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-500">
                            <Clock size={14} className="mr-2 text-[#01b9d4]" />
                            2 weeks ago
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronRight size={16} className="text-[#01b9d4]" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredPatients.length === 0 && (
                  <div className="text-center py-12">
                    <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">No patients found</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
            <div>
              Showing {filteredPatients.length} of {patients.length} patients
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" disabled>Previous</Button>
              <Button variant="outline" size="sm">Next</Button>
            </div>
          </div>
        </>
      )}

      <FormModal
        isOpen={isAddPatientModalOpen}
        onClose={() => setIsAddPatientModalOpen(false)}
        title="Add New Patient"
      >
        <AddPatientForm onSuccess={handlePatientAdded} />
      </FormModal>
    </div>
  );
};

export default Patients;
