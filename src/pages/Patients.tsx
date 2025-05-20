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
  Calendar as CalendarIcon,
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Filter,
  Building2
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { useNavigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import FormModal from '../components/modals/FormModal';
import AddPatientForm from '../components/forms/AddPatientForm';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

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

const ITEMS_PER_PAGE = 10;

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
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
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

  // Pagination
  const totalPages = Math.ceil(filteredPatients.length / ITEMS_PER_PAGE);
  const paginatedPatients = filteredPatients.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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

  const handleRowClick = (patientId: string) => {
    navigate(`/patients/${patientId}`);
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
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm">
                <Filter size={16} className="mr-2" />
                Filter
              </Button>
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
              {paginatedPatients.map((patient, index) => (
                <motion.div
                  key={patient.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-xl shadow-float hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-[1.02]"
                  onClick={() => handleRowClick(patient.id)}
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="h-12 w-12 bg-[#01b9d4] rounded-full flex items-center justify-center text-white">
                        <User size={24} />
                      </div>
                      {patient.medical_aid_details && (
                        <Badge variant="azure" size="sm">
                          {patient.medical_aid_details.provider}
                        </Badge>
                      )}
                    </div>

                    <h5 className="text-sm text-gray-900">
                      {patient.first_name} {patient.last_name}
                    </h5>
                    
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar size={14} className="mr-2 text-[#01b9d4]" />
                        {calculateAge(patient.date_of_birth)} years • {patient.gender}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail size={14} className="mr-2 text-[#01b9d4]" />
                        {patient.email || 'No email'}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone size={14} className="mr-2 text-[#01b9d4]" />
                        {patient.cell_number || 'No phone'}
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                      <div className="flex items-center text-sm text-gray-500">
                        <Building2 size={14} className="mr-2" />
                        Active Patient
                      </div>
                      <Button variant="outline" size="sm">
                        <ChevronRight size={16} />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedPatients.map((patient, index) => (
                <motion.div
                  key={patient.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-xl shadow-float hover:shadow-lg transition-all duration-300 cursor-pointer"
                  onClick={() => handleRowClick(patient.id)}
                >
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 bg-[#01b9d4] rounded-full flex items-center justify-center text-white">
                        <User size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg text-gray-900">
                          {patient.first_name} {patient.last_name}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>{calculateAge(patient.date_of_birth)} years</span>
                          <span>•</span>
                          <span>{patient.gender}</span>
                          <span>•</span>
                          <span>{patient.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {patient.medical_aid_details && (
                        <Badge variant="azure" size="sm">
                          {patient.medical_aid_details.provider}
                        </Badge>
                      )}
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/patients/${patient.id}`);
                          }}
                        >
                          <ExternalLink size={14} className="mr-2" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle edit
                          }}
                        >
                          <Edit size={14} className="mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle delete
                          }}
                        >
                          <Trash2 size={14} className="mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredPatients.length)} of {filteredPatients.length} patients
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} className="mr-2" />
                  Previous
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={currentPage === page ? 'bg-[#01b9d4]' : ''}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          )}

          {filteredPatients.length === 0 && (
            <div className="text-center py-12">
              <FileText size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No patients found</p>
            </div>
          )}
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