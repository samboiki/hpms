import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  PlusCircle, 
  Filter, 
  User,
  ChevronRight,
  FileText,
  Loader2
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
    fetchPatients(); // Refresh the list
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row items-center justify-between mb-6">
        <div className="flex items-center">
          <Users size={28} className="text-primary-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
            <p className="text-gray-600">Manage your patient records and information</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0">
          <Button 
            size="sm"
            onClick={() => setIsAddPatientModalOpen(true)}
            className="bg-gradient-to-r from-[#01b8d8] to-[#01b8d8]"
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
                className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" className="md:w-auto">
              <Filter size={16} className="mr-2" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-6 py-4">
          <CardTitle>Patient Directory</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-primary-600" />
              <span className="ml-2 text-gray-600">Loading patients...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-error-600">
              {error}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3 text-left">Patient</th>
                    <th className="px-6 py-3 text-left">Contact</th>
                    <th className="px-6 py-3 text-left">Date of Birth</th>
                    <th className="px-6 py-3 text-left">Insurance</th>
                    <th className="px-6 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPatients.map((patient) => (
                    <tr 
                      key={patient.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/patients/${patient.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <User size={14} className="text-gray-500" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {patient.first_name} {patient.last_name}
                            </div>
                            <div className="text-xs text-gray-500 capitalize">
                              {patient.gender}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{patient.email}</div>
                        <div className="text-xs text-gray-500">{patient.cell_number}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {patient.date_of_birth}
                      </td>
                      <td className="px-6 py-4">
                        {patient.medical_aid_details ? (
                          <div>
                            <div className="text-sm text-gray-900">{patient.medical_aid_details.provider}</div>
                            <div className="text-xs text-gray-500">#{patient.medical_aid_details.membership_number}</div>
                          </div>
                        ) : (
                          <Badge variant="gray" size="sm">No Insurance</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm">
                          <ChevronRight size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredPatients.length === 0 && !isLoading && (
                <div className="text-center py-10">
                  <Users size={40} className="mx-auto text-gray-300" />
                  <p className="mt-2 text-gray-500">No patients found</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <FormModal
        isOpen={isAddPatientModalOpen}
        onClose={() => setIsAddPatientModalOpen(false)}
        title="Add New Patient"
      >
        <AddPatientForm
          onSuccess={handlePatientAdded}
        />
      </FormModal>
    </div>
  );
};

export default Patients;