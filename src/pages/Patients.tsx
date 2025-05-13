import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  PlusCircle, 
  Filter, 
  User,
  ChevronRight,
  FileText,
  Loader2,
  Calendar,
  Phone,
  Mail,
  Clock,
  AlertCircle
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useNavigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import AddPatientForm from '../components/forms/AddPatientForm';
import { supabase } from '../lib/supabase';

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
  const [filterStatus, setFilterStatus] = useState('all');
  
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

  // Filter patients based on search term
  const filteredPatients = patients.filter(patient => {
    const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return fullName.includes(searchLower) || 
      (patient.email && patient.email.toLowerCase().includes(searchLower)) ||
      (patient.cell_number && patient.cell_number.includes(searchTerm));
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

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="p-3 bg-primary-50 rounded-xl">
            <Users size={28} className="text-primary-600" />
          </div>
          <div className="ml-4">
            <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
            <p className="text-gray-600">Manage your patient records and information</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-3">
          <Button 
            variant="outline"
            onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
          >
            {view === 'grid' ? 'List View' : 'Grid View'}
          </Button>
          <Button 
            className="bg-gradient-to-r from-[#01b8d8] to-[#01b8d8] text-white shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => setIsAddPatientModalOpen(true)}
          >
            <PlusCircle size={16} className="mr-2" />
            Add Patient
          </Button>
        </div>
      </div>

      <Card className="mb-6 border-0 shadow-lg">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search patients by name, email, or phone..."
                className="pl-12 pr-4 py-3 w-full rounded-xl border border-gray-200 focus:ring-primary-500 focus:border-primary-500 bg-gray-50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <select
                className="px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:ring-primary-500 focus:border-primary-500"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Patients</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <Button variant="outline" className="px-6">
                <Filter size={16} className="mr-2" />
                More Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary-600 mr-2" />
          <span className="text-gray-600">Loading patients...</span>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertCircle size={40} className="mx-auto text-error-500 mb-2" />
          <p className="text-error-600 font-medium">{error}</p>
        </div>
      ) : (
        <>
          {view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredPatients.map((patient) => (
                <Card
                  key={patient.id}
                  className="hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={() => navigate(`/patients/${patient.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <User size={32} className="text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {patient.first_name} {patient.last_name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {calculateAge(patient.date_of_birth)} years • {patient.gender}
                      </p>
                      
                      <div className="w-full mt-4 space-y-2">
                        <div className="flex items-center justify-center text-sm text-gray-600">
                          <Mail size={14} className="mr-2" />
                          {patient.email || 'No email'}
                        </div>
                        <div className="flex items-center justify-center text-sm text-gray-600">
                          <Phone size={14} className="mr-2" />
                          {patient.cell_number || 'No phone'}
                        </div>
                      </div>

                      {patient.medical_aid_details && (
                        <Badge variant="azure" size="sm" className="mt-4">
                          {patient.medical_aid_details.provider}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-0 shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Patient</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Age</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Medical Aid</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Visit</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredPatients.map((patient) => (
                      <tr 
                        key={patient.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/patients/${patient.id}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                              <User size={20} className="text-gray-400" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
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
                            {patient.date_of_birth}
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
                            <Clock size={14} className="mr-2" />
                            2 weeks ago
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Button variant="ghost" size="sm">
                            <ChevronRight size={16} />
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