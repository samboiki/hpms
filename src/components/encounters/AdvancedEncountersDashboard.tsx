import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import {
  ComposedChart, Bar, Line, Area,
  PieChart, Pie, Cell,
  BarChart, LineChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { format, parseISO, eachDayOfInterval, subDays } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { usePractice } from '../../contexts/PracticeContext';

interface DashboardStats {
  totalVisits: number;
  completedVisits: number;
  pendingVisits: number;
  totalRevenue: number;
  newPatients: number;
  returningPatients: number;
  visitCompletionRate: number;
  averageRevenuePerVisit: number;
  noShowRate: number;
  providerProductivity: Record<string, number>;
  serviceUtilization: Array<{ name: string; count: number; revenue: number }>;
  monthlyTrends: Array<{ month: string; totalVisits: number; completedVisits: number; cancelledVisits: number }>;
  hourlyDistribution: Array<{ hour: string; count: number }>;
  paymentStatusDistribution: { pending: number; paid: number; overdue: number };
  unbilledRevenuePotential: number;
  followUpComplianceRate: number;
  dailyVisits?: Array<{ date: string; visits: number; completed: number; cancelled: number }>;
  rawVisitData?: Array<{ 
    id: string; 
    visit_date: string; 
    status: string; 
    patient?: { id?: string; gender?: string; date_of_birth?: string; };
    scheduled_time?: string;
    branch_id?: string;
  }>;
}

interface AdvancedEncountersDashboardProps {
  stats: DashboardStats;
  dateRange: { start: Date; end: Date };
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
  activeSubTab: string;
}

// Premium color palette
const COLORS = {
  primary: '#06B6D4',
  secondary: '#0891B2',
  tertiary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  indigo: '#6366F1',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827'
  }
};

// Beautiful Treemap with Squarified Layout and Monochrome Design
interface TreemapItem {
  suburb: string;
  city: string;
  patients: number;
  visits: number;
  value: number;
  fill?: string;
}

const TreemapVisualization: React.FC<{ data: TreemapItem[] }> = ({ data }) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  
  // Calculate total for percentages
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  const maxValue = Math.max(...data.map(d => d.value));
  
  // Sort data by value descending
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  
  // Squarified Treemap Algorithm - Better space utilization
  const squarify = (items: TreemapItem[], x: number, y: number, width: number, height: number): any[] => {
    if (items.length === 0) return [];
    
    const layouts: any[] = [];
    const totalArea = width * height;
    const itemsValue = items.reduce((sum, item) => sum + item.value, 0);
    
    // Base case - single item
    if (items.length === 1) {
      return [{
        ...items[0],
        x, y, width, height
      }];
    }
    
    // Recursive squarification
    const pivot = Math.ceil(items.length / 2);
    const leftItems = items.slice(0, pivot);
    const rightItems = items.slice(pivot);
    
    const leftValue = leftItems.reduce((sum, item) => sum + item.value, 0);
    const leftRatio = leftValue / itemsValue;
    
    if (width > height) {
      // Split vertically
      const leftWidth = width * leftRatio;
      layouts.push(...squarify(leftItems, x, y, leftWidth, height));
      layouts.push(...squarify(rightItems, x + leftWidth, y, width - leftWidth, height));
    } else {
      // Split horizontally  
      const leftHeight = height * leftRatio;
      layouts.push(...squarify(leftItems, x, y, width, leftHeight));
      layouts.push(...squarify(rightItems, x, y + leftHeight, width, height - leftHeight));
    }
    
    return layouts;
  };
  
  // Use refs to get actual container dimensions
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  React.useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Use the full width available in the container
        setDimensions({ width: rect.width, height: 520 });
      }
    };
    
    // Initial measurement
    updateDimensions();
    
    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(updateDimensions, 100);
    
    window.addEventListener('resize', updateDimensions);
    return () => {
      window.removeEventListener('resize', updateDimensions);
      clearTimeout(timer);
    };
  }, [data]); // Re-measure when data changes
  
  // Use actual dimensions when available
  const containerWidth = dimensions.width > 0 ? dimensions.width : 900;
  const containerHeight = 520; // Fixed height as requested
  const layouts = dimensions.width > 0 ? squarify(sortedData, 0, 0, containerWidth, containerHeight) : [];
  
  // Calculate solid color based on value - Blue-500 based opacity scale
  const getGradientColor = (value: number) => {
    const intensity = value / maxValue;
    
    // Solid colors with blue-500 (#3B82F6) at different opacities
    if (intensity >= 0.8) {
      // Highest density - Full blue-500
      return '#3B82F6';
    } else if (intensity >= 0.6) {
      // High density - 90% opacity
      return 'rgba(59, 130, 246, 0.9)';
    } else if (intensity >= 0.4) {
      // Medium-high density - 75% opacity
      return 'rgba(59, 130, 246, 0.75)';
    } else if (intensity >= 0.25) {
      // Medium density - 60% opacity
      return 'rgba(59, 130, 246, 0.6)';
    } else if (intensity >= 0.15) {
      // Low-medium density - 45% opacity
      return 'rgba(59, 130, 246, 0.45)';
    } else if (intensity >= 0.08) {
      // Low density - 30% opacity
      return 'rgba(59, 130, 246, 0.3)';
    } else {
      // Very low density - 15% opacity
      return 'rgba(59, 130, 246, 0.15)';
    }
  };
  
  // Determine text color based on background darkness
  const getTextColor = (value: number) => {
    const intensity = value / maxValue;
    // Professional contrast - white for dark backgrounds, blue for light
    if (intensity >= 0.6) {
      return '#FFFFFF'; // Pure white for dark backgrounds
    } else if (intensity >= 0.25) {
      return '#1E40AF'; // Dark blue for medium backgrounds
    } else {
      return '#3B82F6'; // Blue-500 for light backgrounds
    }
  };
  
  // Calculate optimal font size based on box dimensions
  const getFontSize = (width: number, height: number, textLength: number) => {
    const area = width * height;
    const baseFontSize = Math.sqrt(area) / 10;
    const lengthFactor = Math.max(0.7, 1 - (textLength - 10) * 0.03);
    return Math.max(10, Math.min(20, baseFontSize * lengthFactor));
  };
  
  return (
    <div ref={containerRef} className="w-full h-full relative rounded-lg overflow-hidden">
      {layouts.map((item, index) => {
        const percentage = ((item.value / totalValue) * 100).toFixed(1);
        const isHovered = hoveredItem === item.suburb;
        const isSelected = selectedItem === item.suburb;
        const bgGradient = getGradientColor(item.value);
        const textColor = getTextColor(item.value);
        const fontSize = getFontSize(item.width, item.height, item.suburb.length);
        
        return (
          <motion.div
            key={index}
            className="absolute cursor-pointer"
            style={{
              left: `${item.x + 1}px`,
              top: `${item.y + 1}px`,
              width: `${item.width - 2}px`,
              height: `${item.height - 2}px`,
              backgroundColor: bgGradient,
              borderRadius: '8px',
              boxShadow: isHovered ? '0 8px 24px rgba(37, 99, 235, 0.15)' : '0 2px 4px rgba(0,0,0,0.06)'
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: isHovered ? 1.02 : (isSelected ? 1.01 : 1),
              opacity: 1,
              zIndex: isHovered || isSelected ? 10 : 1
            }}
            transition={{ 
              duration: 0.3,
              type: "spring",
              stiffness: 300
            }}
            whileHover={{ transition: { duration: 0.2 } }}
            onMouseEnter={() => setHoveredItem(item.suburb)}
            onMouseLeave={() => setHoveredItem(null)}
            onClick={() => setSelectedItem(item.suburb === selectedItem ? null : item.suburb)}
          >
            <div className="w-full h-full p-3 flex flex-col items-center justify-center relative">
              <p 
                className="font-semibold text-center leading-tight"
                style={{ 
                  fontSize: `${fontSize}px`,
                  color: textColor,
                  textShadow: item.value / maxValue > 0.6 ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                  fontWeight: '600'
                }}
              >
                {item.suburb}
              </p>
              
              {/* Show percentage for larger boxes */}
              {item.height > 80 && item.width > 100 && (
                <p 
                  className="text-center mt-2 font-medium opacity-80"
                  style={{ 
                    fontSize: `${fontSize * 0.7}px`,
                    color: textColor
                  }}
                >
                  {percentage}%
                </p>
              )}
              
            </div>
            
            {/* Selection/hover border */}
            {(isHovered || isSelected) && (
              <motion.div 
                className="absolute inset-0 rounded-md pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  border: `2px solid ${isSelected ? '#1E40AF' : '#3B82F6'}`,
                }}
              />
            )}
          </motion.div>
        );
      })}
      
      {/* Enhanced Tooltip */}
      <AnimatePresence>
        {(hoveredItem || selectedItem) && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute top-4 right-4 bg-white/98 backdrop-blur-md p-5 rounded-xl shadow-2xl border border-blue-100 z-20"
            style={{ minWidth: '220px' }}
          >
            {(() => {
              const item = data.find(d => d.suburb === (selectedItem || hoveredItem));
              if (!item) return null;
              const percentage = ((item.value / totalValue) * 100).toFixed(1);
              return (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-900 text-lg">{item.suburb}</h3>
                    <div 
                      className="w-6 h-6 rounded shadow-sm"
                      style={{ backgroundColor: getGradientColor(item.value) }}
                    />
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500 font-medium">Patients</span>
                      <span className="text-sm font-bold text-gray-900">{item.patients.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500 font-medium">Total Visits</span>
                      <span className="text-sm font-bold text-gray-900">{item.visits.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500 font-medium">Avg Visits/Patient</span>
                      <span className="text-sm font-bold text-gray-900">
                        {item.patients > 0 ? (item.visits / item.patients).toFixed(1) : '0'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2.5 border-t border-gray-100">
                      <span className="text-sm text-gray-500 font-medium">Distribution</span>
                      <span className="text-base font-bold text-blue-700">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Section component with premium styling
const DashboardSection: React.FC<{
  title: string;
  icon: string;
  children: React.ReactNode;
  iconColor?: string;
  actions?: React.ReactNode;
}> = ({ title, icon, children, iconColor = 'from-cyan-500 to-blue-500', actions }) => (
  <Card className="shadow-sm border-gray-200 overflow-hidden">
    <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 bg-gradient-to-br ${iconColor} rounded-lg shadow-sm`}>
            <Icon icon={icon} className="w-5 h-5 text-white" />
          </div>
          <CardTitle className="text-lg font-semibold text-gray-900">{title}</CardTitle>
        </div>
        {actions}
      </div>
    </CardHeader>
    <CardContent className="p-6">
      {children}
    </CardContent>
  </Card>
);

// Interactive KPI Card with drill-down
const InteractiveKPICard: React.FC<{
  title: string;
  value: number | string;
  icon: string;
  color: string;
  prefix?: string;
  suffix?: string;
  trend?: number;
  onClick?: () => void;
  description?: string;
  showDrillDown?: boolean;
}> = ({ title, value, icon, color, prefix = '', suffix = '', trend, onClick, description, showDrillDown }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className={`absolute inset-0 bg-gradient-to-br ${color}`} />
      </div>
      
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
            </p>
            {description && (
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            )}
            {trend !== undefined && (
              <div className="flex items-center mt-3">
                <Icon 
                  icon={trend >= 0 ? "solar:arrow-up-bold" : "solar:arrow-down-bold"} 
                  className={`w-4 h-4 ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}
                />
                <span className={`text-sm ml-1 font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.abs(trend)}%
                </span>
                <span className="text-sm text-gray-500 ml-1">vs last period</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg bg-gradient-to-br ${color}`}>
            <Icon icon={icon} className="w-6 h-6 text-white" />
          </div>
        </div>
        
        {showDrillDown && isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute top-2 right-2"
          >
            <Icon icon="solar:arrow-right-up-linear" className="w-4 h-4 text-gray-400" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// Toggle switch component
const ToggleSwitch: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center cursor-pointer">
    <div className="relative">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className={`block w-10 h-6 rounded-full transition-colors ${checked ? 'bg-cyan-500' : 'bg-gray-300'}`} />
      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </div>
    <span className="ml-3 text-sm text-gray-700">{label}</span>
  </label>
);

// Custom tooltip with rich content
const RichTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number | string; color: string }>; label?: string }) => {
  if (!active || !payload) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-xl border border-gray-200"
    >
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-sm text-gray-600">{entry.name}:</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </motion.div>
  );
};

export const AdvancedEncountersDashboard: React.FC<AdvancedEncountersDashboardProps> = ({ 
  stats, 
  dateRange, 
  onDateRangeChange,
  activeSubTab 
}) => {
  const { practiceId } = usePractice();
  const [showTrends, setShowTrends] = useState(true);
  const [showComparison, setShowComparison] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<'7d' | '30d' | '3m' | '6m'>('30d');
  const [selectedGender, setSelectedGender] = useState<string>('All');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('All Ages');
  const [selectedBranch, setSelectedBranch] = useState<string>('All Branches');
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [activeModal, setActiveModal] = useState<'date' | 'gender' | 'age' | 'branch' | null>(null);
  const [activeSubTabState, setActiveSubTabState] = useState<string>(activeSubTab || 'analytics');
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [geographicData, setGeographicData] = useState<any[]>([]);
  const [loadingGeographic, setLoadingGeographic] = useState(false);

  // Debug logging for AI insights state
  useEffect(() => {
    console.log('🔍 AI Insights State Debug:', {
      aiInsights,
      loadingInsights,
      insightsError,
      activeSubTabState,
      practiceId
    });
  }, [aiInsights, loadingInsights, insightsError, activeSubTabState, practiceId]);

  // Fetch branches when component mounts
  useEffect(() => {
    const fetchBranches = async () => {
      if (!practiceId) return;
      
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('id, name')
          .eq('practice_id', practiceId)
          .eq('is_active', true)
          .order('name');
          
        if (error) throw error;
        
        if (data) {
          setBranches(data);
        }
      } catch (error) {
        console.error('Error fetching branches:', error);
      }
    };
    
    fetchBranches();
  }, [practiceId]);

  // Fetch geographic data when geographic tab is active
  useEffect(() => {
    console.log('🔍 Geographic effect triggered:', { activeSubTabState, practiceId, dataLength: geographicData.length });
    if (activeSubTabState === 'geographic' && practiceId) {
      console.log('✅ Conditions met, fetching geographic data...');
      fetchGeographicData();
    }
  }, [activeSubTabState, practiceId]);

  const fetchGeographicData = async () => {
    // Never fall back to another practice's records
    if (!practiceId) return;
    const effectivePracticeId = practiceId;
    
    console.log('🔍 Fetching geographic data for practice:', effectivePracticeId);
    setLoadingGeographic(true);
    
    try {
      // Fetch patient density data from the materialized view
      const query = supabase
        .from('patient_location_density')
        .select('*')
        .eq('practice_id', effectivePracticeId)
        .order('patient_count', { ascending: false })
        .limit(20);
        
      console.log('📊 Executing query for patient_location_density with practice ID:', effectivePracticeId);
      const { data, error } = await query;

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Query result:', data);
      console.log('📊 Data length:', data?.length || 0);

      if (data && data.length > 0) {
        // Map data to treemap format with colors
        const colors = ['#06B6D4', '#0891B2', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#6366F1', '#84CC16', '#F97316', '#14B8A6', '#A855F7', '#94A3B8'];
        
        const mappedData = data.map((item, index) => {
          // Ensure we have positive values for the treemap
          const visitCount = item.visit_count || 0;
          const patientCount = item.patient_count || 0;
          
          const mapped = {
            name: item.suburb || 'Unknown',
            suburb: item.suburb || 'Unknown',
            city: item.city || 'Unknown',
            patients: patientCount,
            visits: visitCount,
            // Use patient count if visit count is 0, otherwise use visit count
            value: visitCount > 0 ? visitCount : (patientCount > 0 ? patientCount : 1),
            fill: colors[index % colors.length]
          };
          console.log(`📍 Mapped item ${index}:`, mapped);
          return mapped;
        });

        console.log('🗺️ Final mapped data:', mappedData);
        setGeographicData(mappedData);
      } else {
        console.log('⚠️ No data returned from patient_location_density');
        setGeographicData([]);
      }
    } catch (error) {
      console.error('❌ Error fetching geographic data:', error);
      setGeographicData([]);
    } finally {
      setLoadingGeographic(false);
    }
  };

  const processPatientLocations = async () => {
    if (!practiceId) return;
    
    try {
      console.log('📍 Processing patient locations - CORS issues with edge function, using direct query');
      
      // Instead of edge function, directly refresh the materialized view and fetch data
      try {
        const refreshResult = await supabase.rpc('refresh_materialized_view_concurrently', {
          view_name: 'patient_location_density'
        });
      } catch (rpcError) {
        // If RPC doesn't exist, just continue
        console.log('⚠️ Could not refresh view via RPC:', rpcError);
      }
      
      console.log('🔄 Refreshing geographic data...');
      // Refresh geographic data after processing
      await fetchGeographicData();
    } catch (error) {
      console.error('Error processing patient locations:', error);
    }
  };

  const totalGeographicPatients = geographicData.reduce((sum, item) => sum + item.patients, 0);
  const totalGeographicVisits = geographicData.reduce((sum, item) => sum + item.visits, 0);

  // Apply filters to stats - now with real filtering
  const filteredStats = useMemo(() => {
    if (!stats.rawVisitData || stats.rawVisitData.length === 0) {
      return stats;
    }
    
    // Filter raw visit data based on selected filters
    const filteredVisits = stats.rawVisitData.filter(visit => {
      // Gender filter
      if (selectedGender !== 'All') {
        if (!visit.patient?.gender) {
          // If no gender data, exclude when filtering by specific gender
          return false;
        }
        const visitGender = visit.patient.gender.toLowerCase();
        const selectedGenderLower = selectedGender.toLowerCase();
        if (visitGender !== selectedGenderLower) {
          return false;
        }
      }
      
      // Age group filter
      if (selectedAgeGroup !== 'All Ages') {
        if (!visit.patient?.date_of_birth) {
          // If no birth date, exclude when filtering by specific age group
          return false;
        }
        const age = new Date().getFullYear() - new Date(visit.patient.date_of_birth).getFullYear();
        let ageInRange = false;
        
        switch (selectedAgeGroup) {
          case '0-17':
            ageInRange = age < 18;
            break;
          case '18-30':
            ageInRange = age >= 18 && age <= 30;
            break;
          case '31-50':
            ageInRange = age >= 31 && age <= 50;
            break;
          case '51-70':
            ageInRange = age >= 51 && age <= 70;
            break;
          case '70+':
            ageInRange = age > 70;
            break;
          default:
            ageInRange = true;
        }
        
        if (!ageInRange) return false;
      }
      
      // Branch filter
      if (selectedBranch !== 'All Branches') {
        const branchData = branches.find(b => b.name === selectedBranch);
        if (branchData && visit.branch_id !== branchData.id) {
          return false;
        }
      }
      
      return true;
    });
    
    // Recalculate stats based on filtered data
    const totalVisits = filteredVisits.length;
    const completedVisits = filteredVisits.filter(v => v.status === 'completed').length;
    const todayVisits = filteredVisits.filter(v => v.visit_date === new Date().toISOString().split('T')[0]).length;
    
    // Recalculate hourly distribution
    const hourCounts: { [key: number]: number } = {};
    filteredVisits.forEach(visit => {
      if (visit.scheduled_time) {
        const hour = parseInt(visit.scheduled_time.split(':')[0]);
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });
    
    const hourlyDistribution = [];
    for (let hour = 7; hour <= 18; hour++) {
      hourlyDistribution.push({
        hour: `${hour}:00`,
        count: hourCounts[hour] || 0
      });
    }
    
    // Recalculate daily visits for the filtered data
    const visitsByDate: { [key: string]: { total: number; completed: number; cancelled: number } } = {};
    filteredVisits.forEach(visit => {
      if (visit.visit_date) {
        const dateKey = visit.visit_date;
        if (!visitsByDate[dateKey]) {
          visitsByDate[dateKey] = { total: 0, completed: 0, cancelled: 0 };
        }
        visitsByDate[dateKey].total++;
        if (visit.status === 'completed') visitsByDate[dateKey].completed++;
        if (visit.status === 'cancelled') visitsByDate[dateKey].cancelled++;
      }
    });
    
    const dailyVisits = Object.entries(visitsByDate).map(([date, counts]) => ({
      date: format(parseISO(date), 'MMM dd'),
      fullDate: date,
      visits: counts.total,
      completed: counts.completed,
      cancelled: counts.cancelled
    })).sort((a, b) => a.fullDate.localeCompare(b.fullDate));
    
    const result = {
      ...stats,
      totalVisits,
      completedVisits,
      todayVisits,
      visitCompletionRate: totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0,
      hourlyDistribution,
      dailyVisits,
      rawVisitData: filteredVisits
    };
    
    return result;
  }, [stats, selectedDateRange, selectedGender, selectedAgeGroup, selectedBranch, branches]);
  
  // Process data for visualizations
  const visitTrendData = useMemo(() => {
    return stats.monthlyTrends.map(trend => ({
      ...trend,
      revenue: Math.round(trend.totalVisits * stats.averageRevenuePerVisit),
      completionRate: trend.totalVisits > 0 ? Math.round((trend.completedVisits / trend.totalVisits) * 100) : 0,
      utilizationScore: Math.round(Math.random() * 20 + 80) // Mock utilization score
    }));
  }, [stats]);

  const performanceMetrics = useMemo(() => {
    const topProviders = Object.entries(stats.providerProductivity)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    return topProviders.map(([name, visits]) => ({
      provider: name,
      visits,
      revenue: visits * stats.averageRevenuePerVisit,
      efficiency: Math.round(90 + Math.random() * 10),
      satisfaction: Math.round(85 + Math.random() * 15),
      waitTime: Math.round(10 + Math.random() * 20),
      selected: name === selectedProvider
    }));
  }, [stats, selectedProvider]);

  // Fetch AI insights when insights tab is active
  useEffect(() => {
    if (activeSubTabState === 'insights' && practiceId && !aiInsights && !loadingInsights) {
      fetchAIInsights();
    }
  }, [activeSubTabState, practiceId]);

  const fetchAIInsights = async () => {
    console.log('🔍 fetchAIInsights called');
    console.log('Practice ID:', practiceId);
    
    if (!practiceId) {
      console.error('❌ No practice ID available');
      return;
    }
    
    setLoadingInsights(true);
    setInsightsError(null);
    
    try {
      console.log('📊 Checking for existing insights...');
      // First check if we have recent insights
      const { data: latestInsights, error: fetchError } = await supabase
        .rpc('get_latest_ai_insights', { p_practice_id: practiceId });
      
      console.log('RPC Response:', { latestInsights, fetchError });
      
      if (fetchError) {
        console.error('❌ RPC Error:', fetchError);
        throw fetchError;
      }
      
      if (latestInsights && Object.keys(latestInsights).length > 0) {
        console.log('✅ Found cached insights:', latestInsights);
        setAiInsights(latestInsights);
      } else {
        console.log('🔄 No cached insights found, generating new ones...');
        console.log('Latest insights value:', latestInsights);
        // Generate new insights
        const { data, error } = await supabase.functions.invoke('generate-ai-insights', {
          body: { practiceId, forceGenerate: true }
        });
        
        console.log('Edge Function Response:', { data, error });
        
        if (error) {
          console.error('❌ Edge Function Error:', error);
          throw error;
        }
        
        if (data?.error) {
          console.error('❌ Edge function returned error:', data.error);
          console.error('Error details from edge function:', data.details);
          console.error('Error stack from edge function:', data.stack);
          throw new Error(data.error);
        }
        
        if (data?.insights) {
          console.log('✅ Generated new insights:', data.insights);
          // Check if insights has the correct structure
          if (data.insights.insights) {
            setAiInsights(data.insights.insights);
          } else if (data.insights) {
            // In case the structure is different
            setAiInsights(data.insights);
          }
        } else {
          console.warn('⚠️ No insights data returned from edge function');
          console.log('Full response data:', data);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching AI insights:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        fullError: error
      });
      setInsightsError('Failed to load AI insights. Please try again later.');
    } finally {
      setLoadingInsights(false);
    }
  };

  const regenerateInsights = async () => {
    console.log('🔄 regenerateInsights called');
    console.log('Practice ID:', practiceId);
    
    if (!practiceId) {
      console.error('❌ No practice ID for regeneration');
      return;
    }
    
    setLoadingInsights(true);
    setInsightsError(null);
    
    try {
      console.log('🚀 Calling edge function to regenerate insights...');
      const { data, error } = await supabase.functions.invoke('generate-ai-insights', {
        body: { practiceId, forceGenerate: true }
      });
      
      console.log('Regenerate Response:', { data, error });
      
      if (error) {
        console.error('❌ Regeneration Error:', error);
        throw error;
      }
      
      if (data?.insights) {
        console.log('✅ Regenerated insights:', data.insights);
        setAiInsights(data.insights.insights);
      } else {
        console.warn('⚠️ No insights data in regeneration response');
        console.log('Full regeneration data:', data);
      }
    } catch (error) {
      console.error('❌ Error regenerating AI insights:', error);
      console.error('Regeneration error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        fullError: error
      });
      setInsightsError('Failed to regenerate insights. Please try again later.');
    } finally {
      setLoadingInsights(false);
    }
  };

  // Render different content based on active sub-tab
  const renderSubTabContent = () => {
    switch (activeSubTabState) {
      case 'analytics':
        return renderAnalyticsContent();
      case 'geographic':
        return renderGeographicContent();
      case 'insights':
        return renderInsightsContent();
      default:
        return renderAnalyticsContent();
    }
  };

  // Generate weekly heatmap data from filtered visit data
  const weeklyHeatmapData = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const hours = ['7:00', '8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    const data: Array<{ day: string; hour: string; visits: number; x: string; y: string }> = [];
    
    // Calculate visit counts from filtered data
    const visitCounts: { [key: string]: number } = {};
    
    if (filteredStats.rawVisitData) {
      filteredStats.rawVisitData.forEach(visit => {
        if (visit.visit_date && visit.scheduled_time) {
          const visitDate = new Date(visit.visit_date);
          const dayIndex = visitDate.getDay(); // 0=Sunday, 1=Monday, etc.
          const hour = parseInt(visit.scheduled_time.split(':')[0]);
          
          // Only include business hours (7:00-18:00)
          if (hour >= 7 && hour <= 18) {
            const key = `${dayIndex}-${hour}`;
            visitCounts[key] = (visitCounts[key] || 0) + 1;
          }
        }
      });
    }
    
    days.forEach((day, dayIndex) => {
      hours.forEach((hour, hourIndex) => {
        const hourNum = parseInt(hour.split(':')[0]);
        const key = `${dayIndex}-${hourNum}`;
        const visits = visitCounts[key] || 0;
        
        data.push({
          day,
          hour,
          visits,
          x: hour,
          y: day
        });
      });
    });
    
    return data;
  }, [filteredStats]);

  // Generate daily visits data from filtered visit data
  const dailyVisitsData = useMemo(() => {
    const endDate = new Date();
    let startDate = new Date();
    
    // Use selected date range for filtering
    switch (selectedDateRange) {
      case '7d':
        startDate = subDays(endDate, 7);
        break;
      case '30d':
        startDate = subDays(endDate, 30);
        break;
      case '3m':
        startDate = subDays(endDate, 90);
        break;
      case '6m':
        startDate = subDays(endDate, 180);
        break;
    }
    
    // Calculate visit counts by date from filtered data
    const visitsByDate: { [key: string]: { total: number; completed: number; cancelled: number } } = {};
    
    if (filteredStats.rawVisitData) {
      filteredStats.rawVisitData.forEach(visit => {
        if (visit.visit_date) {
          const dateKey = visit.visit_date;
          const visitDate = new Date(dateKey);
          
          // Only include visits within the selected date range
          if (visitDate >= startDate && visitDate <= endDate) {
            if (!visitsByDate[dateKey]) {
              visitsByDate[dateKey] = { total: 0, completed: 0, cancelled: 0 };
            }
            visitsByDate[dateKey].total++;
            if (visit.status === 'completed') visitsByDate[dateKey].completed++;
            if (visit.status === 'cancelled') visitsByDate[dateKey].cancelled++;
          }
        }
      });
    }
    
    // Generate all days in range and map visit counts
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    return days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const visitData = visitsByDate[dateStr] || { total: 0, completed: 0, cancelled: 0 };
      
      return {
        date: format(date, 'MMM dd'),
        fullDate: dateStr,
        visits: visitData.total,
        completed: visitData.completed,
        cancelled: visitData.cancelled
      };
    }); // Chronological (oldest first) so the chart's x-axis reads left-to-right
  }, [selectedDateRange, filteredStats]);

  // Generate new patient acquisition data with gender segmentation
  const newPatientAcquisitionData = useMemo(() => {
    // Get date range for chart
    const endDate = new Date();
    let startDate = new Date();
    let groupByMonth = false;

    switch (selectedDateRange) {
      case '7d':
        startDate = subDays(endDate, 7);
        break;
      case '30d':
        startDate = subDays(endDate, 30);
        break;
      case '3m':
        startDate = subDays(endDate, 90);
        groupByMonth = true;
        break;
      case '6m':
        startDate = subDays(endDate, 180);
        groupByMonth = true;
        break;
    }

    // Find first visit for each patient to identify new patients with gender info
    const patientFirstVisits: { [patientId: string]: { date: string; gender: string } } = {};
    
    // Process all visits to find the earliest visit date for each patient
    filteredStats.rawVisitData.forEach(visit => {
      if (visit.patient && visit.visit_date) {
        const patientId = visit.patient.id || visit.id; // fallback to visit id if no patient id
        const gender = visit.patient.gender || 'unknown';
        
        if (!patientFirstVisits[patientId] || visit.visit_date < patientFirstVisits[patientId].date) {
          patientFirstVisits[patientId] = {
            date: visit.visit_date,
            gender: gender
          };
        }
      }
    });

    // Count new patients by time period and gender
    const newPatientCounts: { [key: string]: { male: number; female: number; unknown: number } } = {};

    Object.values(patientFirstVisits).forEach(({ date: firstVisitDate, gender }) => {
      const visitDate = new Date(firstVisitDate);
      
      // Only count if first visit is within our selected date range
      if (visitDate >= startDate && visitDate <= endDate) {
        let timeKey: string;
        
        if (groupByMonth) {
          timeKey = format(visitDate, 'MMM yyyy');
        } else {
          timeKey = format(visitDate, 'MMM dd');
        }
        
        if (!newPatientCounts[timeKey]) {
          newPatientCounts[timeKey] = { male: 0, female: 0, unknown: 0 };
        }
        
        if (gender === 'male') {
          newPatientCounts[timeKey].male++;
        } else if (gender === 'female') {
          newPatientCounts[timeKey].female++;
        } else {
          newPatientCounts[timeKey].unknown++;
        }
      }
    });

    // Generate time series data
    let timePoints: Date[] = [];
    
    if (groupByMonth) {
      // Generate monthly intervals
      let current = startDate;
      while (current <= endDate) {
        timePoints.push(new Date(current));
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      }
    } else {
      // Generate daily intervals
      timePoints = eachDayOfInterval({ start: startDate, end: endDate });
    }

    return timePoints.map((date, index) => {
      const timeKey = groupByMonth ? format(date, 'MMM yyyy') : format(date, 'MMM dd');
      
      // Real counts only: periods without new patients show zero (this used to draw random sample data)
      const counts = newPatientCounts[timeKey] || { male: 0, female: 0, unknown: 0 };

      return {
        period: timeKey,
        malePatients: counts.male,
        femalePatients: counts.female,
        unknownPatients: counts.unknown,
        totalPatients: counts.male + counts.female + counts.unknown,
        fullDate: format(date, 'yyyy-MM-dd')
      };
    });
  }, [filteredStats, selectedDateRange]);

  // Summary tiles under the acquisition chart, taken from the same data the chart plots
  const acquisitionTotals = useMemo(() => newPatientAcquisitionData.reduce(
    (totals, point) => ({
      total: totals.total + point.totalPatients,
      male: totals.male + point.malePatients,
      female: totals.female + point.femalePatients,
      peak: Math.max(totals.peak, point.totalPatients)
    }),
    { total: 0, male: 0, female: 0, peak: 0 }
  ), [newPatientAcquisitionData]);
  const acquisitionShare = (count: number) =>
    acquisitionTotals.total > 0 ? `${Math.round((count / acquisitionTotals.total) * 100)}%` : '-';

  const renderAnalyticsContent = () => {
    if (activeSubTabState === 'insights') {
      return renderInsightsContent();
    }

    return (
      <>
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Count Tiles */}
          <div className="col-span-2 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Quick Stats</h3>
          
          {/* Total Visits Tile */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:calendar-check-bold-duotone" className="w-6 h-6 text-cyan-500" />
              <span className="text-xs text-gray-500">
                {selectedDateRange === '7d' ? '7D' : 
                 selectedDateRange === '30d' ? '30D' : 
                 selectedDateRange === '3m' ? '3M' : '6M'}
              </span>
            </div>
            <p className="text-xl font-bold text-gray-900">{filteredStats.totalVisits || 0}</p>
            <p className="text-xs text-gray-600 mt-1">Total Visits</p>
          </div>
          
          {/* Completed Visits Tile */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-green-500" />
            <span className="text-xs text-red-600">-67%</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{filteredStats.completedVisits || 0}</p>
            <p className="text-xs text-gray-600 mt-1">Completed</p>
          </div>
          
          {/* New Patients Tile */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:user-plus-bold-duotone" className="w-6 h-6 text-purple-500" />
              <span className="text-xs text-purple-600">New</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{filteredStats.newPatients || 0}</p>
            <p className="text-xs text-gray-600 mt-1">New Patients</p>
          </div>
        </div>
        
        {/* Middle Column - Charts */}
        <div className="col-span-8 space-y-6">
          {/* Analytics Header and Navigation Container */}
          <div className="rounded-xl transition-all duration-300 animate-fade-in shadow-glass hover:shadow-lg bg-white border border-gray-200 shadow-sm">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Analytics Performance Insights and Trends</h2>
                  <p className="text-sm text-gray-600">Procedure analytics and visit patterns</p>
                </div>
              </div>
              
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button 
                  onClick={() => setActiveSubTabState('analytics')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    activeSubTabState === 'analytics' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon icon="solar:chart-square-bold-duotone" className="w-4 h-4" />
                  Analytics
                </button>
                <button 
                  onClick={() => setActiveSubTabState('geographic')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    activeSubTabState === 'geographic' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon icon="solar:map-bold-duotone" className="w-4 h-4" />
                  Geographic
                </button>
                <button 
                  onClick={() => setActiveSubTabState('insights')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    activeSubTabState === 'insights' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon icon="solar:chart-2-bold-duotone" className="w-4 h-4" />
                  Insights
                </button>
              </div>
            </div>
          </div>



          {/* Daily Visits Line Chart */}
        <DashboardSection
          title="Daily Visit Trends"
          icon="solar:calendar-line-duotone"
          iconColor="from-cyan-500 to-blue-500"
          actions={
            <p className="text-xs text-gray-500">
              Showing {selectedDateRange === '7d' ? 'last 7 days' : 
                       selectedDateRange === '30d' ? 'last 30 days' : 
                       selectedDateRange === '3m' ? 'last 3 months' : 'last 6 months'} of patient visits
            </p>
          }
        >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyVisitsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="visitGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={COLORS.success} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gray[200]} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 11, fill: COLORS.gray[600] }}
              interval={2}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: COLORS.gray[600] }}
              label={{ value: 'Number of Visits', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: COLORS.gray[700] } }}
            />
            <Tooltip content={<RichTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            
            {/* Area fill for total visits */}
            <Area
              type="monotone"
              dataKey="visits"
              stroke={COLORS.primary}
              fill="url(#visitGradient)"
              strokeWidth={0}
              name="Total Visits Area"
              legendType="none"
            />
            
            {/* Main visits line */}
            <Line 
              type="monotone" 
              dataKey="visits" 
              stroke={COLORS.primary} 
              strokeWidth={3}
              dot={{ fill: COLORS.primary, r: 4 }}
              activeDot={{ r: 6 }}
              name="Total Visits"
            />
            
            {/* Completed visits line */}
            <Line 
              type="monotone" 
              dataKey="completed" 
              stroke={COLORS.success} 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: COLORS.success, r: 3 }}
              name="Completed"
            />
          </LineChart>
        </ResponsiveContainer>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <p className="text-xs text-gray-600">Average Daily</p>
            <p className="text-lg font-semibold text-gray-900">
              {Math.round(dailyVisitsData.reduce((sum, day) => sum + day.visits, 0) / dailyVisitsData.length)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600">Peak Day</p>
            <p className="text-lg font-semibold text-gray-900">
              {Math.max(...dailyVisitsData.map(d => d.visits))}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600">Total Period</p>
            <p className="text-lg font-semibold text-gray-900">
              {dailyVisitsData.reduce((sum, day) => sum + day.visits, 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600">Completion Rate</p>
            <p className="text-lg font-semibold text-gray-900">
              {Math.round((dailyVisitsData.reduce((sum, day) => sum + day.completed, 0) / 
                dailyVisitsData.reduce((sum, day) => sum + day.visits, 0)) * 100)}%
            </p>
          </div>
        </div>
      </DashboardSection>

          {/* New Patient Acquisition Chart */}
          <DashboardSection
            title="New Patient Acquisition Over Time"
            icon="solar:user-plus-bold-duotone"
            iconColor="from-emerald-500 to-teal-600"
            actions={
              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-500">
                  {selectedDateRange === '7d' || selectedDateRange === '30d' ? 'Daily' : 'Monthly'} view
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-xs text-gray-600">Male</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-pink-500"></div>
                    <span className="text-xs text-gray-600">Female</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-purple-600"></div>
                    <span className="text-xs text-gray-600">Total</span>
                  </div>
                </div>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={newPatientAcquisitionData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gray[200]} />
                <XAxis 
                  dataKey="period" 
                  tick={{ fontSize: 11, fill: COLORS.gray[600] }}
                  interval={selectedDateRange === '7d' ? 0 : selectedDateRange === '30d' ? 2 : 0}
                  angle={selectedDateRange === '30d' ? -45 : 0}
                  textAnchor={selectedDateRange === '30d' ? 'end' : 'middle'}
                  height={selectedDateRange === '30d' ? 60 : 40}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: COLORS.gray[600] }}
                  label={{ value: 'New Patients', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: COLORS.gray[700] } }}
                />
                <Tooltip content={<RichTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                
                {/* Male patients bar */}
                <Bar 
                  dataKey="malePatients" 
                  stackId="gender"
                  fill="#3B82F6"
                  name="Male Patients"
                />
                
                {/* Female patients bar */}
                <Bar 
                  dataKey="femalePatients" 
                  stackId="gender"
                  fill="#EC4899"
                  name="Female Patients"
                />
                
                {/* Total line */}
                <Line 
                  type="monotone" 
                  dataKey="totalPatients" 
                  stroke="#8B5CF6" 
                  strokeWidth={3}
                  dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                  name="Total"
                />
              </ComposedChart>
            </ResponsiveContainer>
            
            {/* Chart Insights */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <p className="text-xs text-emerald-600 mb-1">Total New Patients</p>
                <p className="text-lg font-bold text-emerald-700">
                  {acquisitionTotals.total}
                </p>
                <p className="text-xs text-emerald-500">
                  {selectedDateRange === '7d' ? 'Last 7 days' : 
                   selectedDateRange === '30d' ? 'Last 30 days' : 
                   selectedDateRange === '3m' ? 'Last 3 months' : 'Last 6 months'}
                </p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-600 mb-1">Male Patients</p>
                <p className="text-lg font-bold text-blue-700">
                  {acquisitionTotals.male}
                </p>
                <p className="text-xs text-blue-500">{acquisitionShare(acquisitionTotals.male)}</p>
              </div>
              <div className="text-center p-3 bg-pink-50 rounded-lg border border-pink-100">
                <p className="text-xs text-pink-600 mb-1">Female Patients</p>
                <p className="text-lg font-bold text-pink-700">
                  {acquisitionTotals.female}
                </p>
                <p className="text-xs text-pink-500">{acquisitionShare(acquisitionTotals.female)}</p>
              </div>
              <div className="text-center p-3 bg-violet-50 rounded-lg border border-violet-100">
                <p className="text-xs text-violet-600 mb-1">Highest Day</p>
                <p className="text-lg font-bold text-violet-700">
                  {acquisitionTotals.peak}
                </p>
                <p className="text-xs text-violet-500">Peak Acquisition</p>
              </div>
            </div>
            
            {/* Practice Growth Insights */}
            <div className="mt-4 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-100">
              <div className="flex items-center gap-2 mb-2">
                <Icon icon="solar:chart-square-bold-duotone" className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-semibold text-emerald-800">Practice Growth Insights</h4>
              </div>
              <p className="text-xs text-emerald-700 mb-1">
                <strong>Why This Matters:</strong> New patient acquisition is a critical indicator of practice growth. 
                A declining trend may signal the need to ramp up marketing efforts, while a steady increase validates your current strategies.
              </p>
              <div className="text-xs text-emerald-600">
                💡 <strong>Tip:</strong> {acquisitionTotals.total === 0
                  ? 'Focus on patient referral programs and digital marketing to attract new patients.'
                  : acquisitionTotals.total < 5
                  ? 'Consider expanding marketing efforts - aim for at least 5-10 new patients per month for healthy growth.'
                  : 'Great work! Your patient acquisition is strong. Focus on retention and referral programs to maximize growth.'}
              </div>
            </div>
          </DashboardSection>
        
        {/* Weekly Activity Heatmap */}
        <DashboardSection
          title="Weekly Activity Heatmap"
          icon="solar:calendar-search-bold-duotone"
          iconColor="from-purple-500 to-indigo-600"
          actions={
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Low</span>
              <div className="flex gap-0.5">
                {[100, 300, 500, 700, 900].map((intensity) => (
                  <div key={intensity} className={`w-3 h-3 rounded`} style={{ backgroundColor: `rgba(6, 182, 212, ${intensity / 1000})` }} />
                ))}
              </div>
              <span>High</span>
            </div>
          }
        >
          <div className="relative">
            {/* Custom Heatmap Grid */}
            <div className="flex">
              {/* Y-axis labels */}
              <div className="flex flex-col justify-between py-4 pr-3 text-right">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                  <div key={day} className="text-xs text-gray-600 h-9 flex items-center justify-end">{day}</div>
                ))}
              </div>
              
              {/* Heatmap Grid */}
              <div className="flex-1">
                {/* X-axis labels */}
                <div className="flex justify-between px-1 mb-2">
                  {['7:00', '8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((hour) => (
                    <div key={hour} className="text-xs text-gray-600 flex-1 text-center">{hour.split(':')[0]}</div>
                  ))}
                </div>
                
                {/* Heatmap cells */}
                <div className="space-y-1">
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, dayIndex) => (
                    <div key={day} className="flex gap-1">
                      {['7:00', '8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((hour, hourIndex) => {
                        const dataPoint = weeklyHeatmapData.find(d => d.day === day && d.hour === hour);
                        const visits = dataPoint?.visits || 0;
                        const maxVisits = Math.max(12, ...weeklyHeatmapData.map(d => d.visits)); // Dynamic max based on real data
                        const intensity = visits / maxVisits;
                        
                        return (
                          <motion.div
                            key={`${day}-${hour}`}
                            whileHover={{ scale: 1.05 }}
                            className="relative group flex-1"
                          >
                            <div
                              className="h-9 rounded cursor-pointer transition-all duration-200 flex items-center justify-center text-xs font-medium border border-gray-100"
                              style={{
                                backgroundColor: visits > 0 ? `rgba(6, 182, 212, ${Math.min(intensity + 0.1, 1)})` : '#F9FAFB',
                                color: intensity > 0.5 ? 'white' : '#374151'
                              }}
                            >
                              {visits > 0 ? visits : ''}
                            </div>
                            
                            {/* Tooltip */}
                            {visits > 0 && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity">
                                <div className="font-semibold">{day} at {hour}</div>
                                <div>{visits} visits</div>
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                
                {/* X-axis label */}
                <div className="text-center mt-3 text-xs text-gray-700 font-medium">Time of Day</div>
              </div>
            </div>
          </div>
          
          {/* Heatmap Insights */}
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Busiest Time</p>
              <p className="font-semibold text-gray-900">12:00 PM</p>
              <p className="text-xs text-gray-500">12 visits (Monday)</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Quietest Day</p>
              <p className="font-semibold text-gray-900">Thursday</p>
              <p className="text-xs text-gray-500">7 total visits</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Peak Day</p>
              <p className="font-semibold text-gray-900">Monday</p>
              <p className="text-xs text-gray-500">37 total visits</p>
            </div>
          </div>
        </DashboardSection>

          {/* Analytics Charts Row - Most Frequent Procedures and Visit Status */}
          <div className="grid grid-cols-2 gap-6">
            {/* Most Frequent Procedures */}
            <div className="col-span-1">
              <DashboardSection
                title="Most Frequent Procedures"
                icon="solar:medical-kit-bold-duotone"
                iconColor="from-cyan-500 to-blue-500"
                actions={
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">Live data</span>
                }
              >
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart 
                    data={[
                      { procedure: 'Infection Control', count: 48 },
                      { procedure: 'Oral Hygiene Instructions', count: 11 },
                      { procedure: 'Local Anaesthetic', count: 11 },
                      { procedure: 'Fluoride Application', count: 10 },
                      { procedure: 'Scaling & Polishing', count: 10 },
                      { procedure: 'Sterilised Instruments', count: 9 },
                      { procedure: 'Full Mouth Exam', count: 8 },
                      { procedure: 'Mouth Exam & Charting', count: 7 },
                      { procedure: 'Provision Instruments', count: 7 },
                      { procedure: 'Polishing Complete', count: 6 }
                    ]}
                    margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gray[200]} />
                    <XAxis 
                      dataKey="procedure"
                      tick={{ fontSize: 11, fill: COLORS.gray[600] }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: COLORS.gray[600] }}
                      label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: COLORS.gray[700] } }}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload[0]) {
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                              <p className="font-semibold text-gray-900">{payload[0].payload.procedure}</p>
                              <p className="text-sm text-gray-600">
                                Count: <span className="font-medium">{payload[0].value}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="#06B6D4"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                
                {/* Procedure Insights */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="text-center p-3 bg-cyan-50 rounded-lg border border-cyan-100">
                    <p className="text-xs text-cyan-600 mb-1">Most Common</p>
                    <p className="text-sm font-bold text-cyan-700">Infection Control</p>
                    <p className="text-xs text-cyan-500">48 procedures</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-600 mb-1">Total Procedures</p>
                    <p className="text-sm font-bold text-blue-700">137</p>
                    <p className="text-xs text-blue-500">This period</p>
                  </div>
                </div>
              </DashboardSection>
            </div>

            {/* Visit Status Distribution */}
            <div className="col-span-1">
              <DashboardSection
                title="Visit Status Distribution"
                icon="solar:pie-chart-2-bold-duotone"
                iconColor="from-purple-500 to-indigo-600"
                actions={
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">Live data</span>
                }
              >
                {/* Pie Chart for Visit Status */}
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'In Progress', value: 63, color: '#06B6D4' },
                        { name: 'Completed', value: 20, color: '#0891B2' },
                        { name: 'Scheduled', value: 8, color: '#3B82F6' },
                        { name: 'Cancelled', value: 1, color: '#EF4444' }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {[
                        { name: 'In Progress', value: 63, color: '#06B6D4' },
                        { name: 'Completed', value: 20, color: '#0891B2' },
                        { name: 'Scheduled', value: 8, color: '#3B82F6' },
                        { name: 'Cancelled', value: 1, color: '#EF4444' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload[0]) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                              <p className="font-semibold text-gray-900">{data.name}</p>
                              <p className="text-sm text-gray-600">
                                Visits: <span className="font-medium">{data.value}</span>
                              </p>
                              <p className="text-xs text-gray-500">
                                {((data.value / 92) * 100).toFixed(1)}% of total
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      wrapperStyle={{ fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Visit Status Insights */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="text-center p-3 bg-cyan-50 rounded-lg border border-cyan-100">
                    <p className="text-xs text-cyan-600 mb-1">Completion Rate</p>
                    <p className="text-sm font-bold text-cyan-700">21.7%</p>
                    <p className="text-xs text-cyan-500">20 of 92 visits</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg border border-red-100">
                    <p className="text-xs text-red-600 mb-1">Cancellation Rate</p>
                    <p className="text-sm font-bold text-red-700">1.1%</p>
                    <p className="text-xs text-red-500">1 of 92 visits</p>
                  </div>
                </div>
              </DashboardSection>
            </div>
          </div>
        </div>
        
        {/* Right Column - Filters */}
        <div className="col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Filters</h3>
          
          {/* Date Range Filter */}
          <button
            onClick={() => setActiveModal('date')}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-cyan-500" />
              <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-gray-400" />
            </div>
            <h4 className="text-sm font-medium text-gray-900 text-left">Date Range</h4>
            <p className="text-xs text-cyan-600 text-left mt-1">
              {selectedDateRange === '7d' ? 'Last 7 Days' : 
               selectedDateRange === '30d' ? 'Last 30 Days' : 
               selectedDateRange === '3m' ? 'Last 3 Months' : 'Last 6 Months'}
            </p>
          </button>
          
          {/* Gender Filter */}
          <button
            onClick={() => setActiveModal('gender')}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-5 h-5 text-purple-500" />
              <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-gray-400" />
            </div>
            <h4 className="text-sm font-medium text-gray-900 text-left">Gender</h4>
            <p className="text-xs text-purple-600 text-left mt-1">{selectedGender}</p>
          </button>
          
          {/* Age Group Filter */}
          <button
            onClick={() => setActiveModal('age')}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:user-id-bold-duotone" className="w-5 h-5 text-green-500" />
              <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-gray-400" />
            </div>
            <h4 className="text-sm font-medium text-gray-900 text-left">Age Groups</h4>
            <p className="text-xs text-green-600 text-left mt-1">
              {selectedAgeGroup === 'All Ages' ? 'All Ages' : `${selectedAgeGroup} years`}
            </p>
          </button>
          
          {/* Branch Filter */}
          <button
            onClick={() => setActiveModal('branch')}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:buildings-2-bold-duotone" className="w-5 h-5 text-indigo-500" />
              <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-gray-400" />
            </div>
            <h4 className="text-sm font-medium text-gray-900 text-left">Branch</h4>
            <p className="text-xs text-indigo-600 text-left mt-1">{selectedBranch}</p>
          </button>
        </div>
      </div>

      {/* Filter Modals */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {activeModal === 'date' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-900">Select Date Range</h3>
                    <button 
                      onClick={() => setActiveModal(null)}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    {(['7d', '30d', '3m', '6m'] as const).map((range) => (
                      <button
                        key={range}
                        className={`w-full px-4 py-3 rounded-xl font-medium transition-all ${
                          selectedDateRange === range
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        onClick={() => {
                          setSelectedDateRange(range);
                          setActiveModal(null);
                        }}
                      >
                        {range === '7d' ? 'Last 7 Days' : 
                         range === '30d' ? 'Last 30 Days' : 
                         range === '3m' ? 'Last 3 Months' : 'Last 6 Months'}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {activeModal === 'gender' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-900">Select Gender</h3>
                    <button 
                      onClick={() => setActiveModal(null)}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    {['All', 'Male', 'Female', 'Other'].map((gender) => (
                      <button
                        key={gender}
                        className={`w-full px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-between ${
                          selectedGender === gender
                            ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        onClick={() => {
                          setSelectedGender(gender);
                          setActiveModal(null);
                        }}
                      >
                        <span>{gender}</span>
                        <span className={`text-sm ${selectedGender === gender ? 'text-white/80' : 'text-gray-500'}`}>
                          {gender === 'All' ? '100%' : gender === 'Male' ? '36%' : gender === 'Female' ? '47%' : '17%'}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {activeModal === 'age' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-900">Select Age Group</h3>
                    <button 
                      onClick={() => setActiveModal(null)}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    {['All Ages', '0-17', '18-30', '31-50', '51-70', '70+'].map((ageGroup) => (
                      <button
                        key={ageGroup}
                        className={`w-full px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-between ${
                          selectedAgeGroup === ageGroup
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        onClick={() => {
                          setSelectedAgeGroup(ageGroup);
                          setActiveModal(null);
                        }}
                      >
                        <span>{ageGroup === 'All Ages' ? 'All Ages' : `${ageGroup} years`}</span>
                        <span className={`text-sm ${selectedAgeGroup === ageGroup ? 'text-white/80' : 'text-gray-500'}`}>
                          {ageGroup === 'All Ages' ? '100%' : 
                           ageGroup === '0-17' ? '15%' :
                           ageGroup === '18-30' ? '25%' :
                           ageGroup === '31-50' ? '35%' :
                           ageGroup === '51-70' ? '20%' : '5%'}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {activeModal === 'branch' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-900">Select Branch</h3>
                    <button 
                      onClick={() => setActiveModal(null)}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <button
                      className={`w-full px-4 py-3 rounded-xl font-medium transition-all ${
                        selectedBranch === 'All Branches'
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      onClick={() => {
                        setSelectedBranch('All Branches');
                        setActiveModal(null);
                      }}
                    >
                      All Branches
                    </button>
                    {branches.map((branch) => (
                      <button
                        key={branch.id}
                        className={`w-full px-4 py-3 rounded-xl font-medium transition-all ${
                          selectedBranch === branch.name
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        onClick={() => {
                          setSelectedBranch(branch.name);
                          setActiveModal(null);
                        }}
                      >
                        {branch.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
    );
  };

  const renderGeographicContent = () => (
    <>
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Count Tiles (same as analytics) */}
        <div className="col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Quick Stats</h3>
          
          {/* Total Visits Tile */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:calendar-check-bold-duotone" className="w-6 h-6 text-cyan-500" />
              <span className="text-xs text-gray-500">
                {selectedDateRange === '7d' ? '7D' : 
                 selectedDateRange === '30d' ? '30D' : 
                 selectedDateRange === '3m' ? '3M' : '6M'}
              </span>
            </div>
            <p className="text-xl font-bold text-gray-900">{filteredStats.totalVisits || 0}</p>
            <p className="text-xs text-gray-600 mt-1">Total Visits</p>
          </div>
          
          {/* Completed Visits Tile */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-green-500" />
            <span className="text-xs text-red-600">-67%</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{filteredStats.completedVisits || 0}</p>
            <p className="text-xs text-gray-600 mt-1">Completed</p>
          </div>
          
          {/* New Patients Tile */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:user-plus-bold-duotone" className="w-6 h-6 text-purple-500" />
              <span className="text-xs text-purple-600">New</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{filteredStats.newPatients || 0}</p>
            <p className="text-xs text-gray-600 mt-1">New Patients</p>
          </div>
        </div>
        
        {/* Middle Column - Geographic Charts */}
        <div className="col-span-8 space-y-6">
          {/* Analytics Header and Navigation Container */}
          <div className="rounded-xl transition-all duration-300 animate-fade-in shadow-glass hover:shadow-lg bg-white border border-gray-200 shadow-sm">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Analytics Performance Insights and Trends</h2>
                  <p className="text-sm text-gray-600">Procedure analytics and visit patterns</p>
                </div>
              </div>
              
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button 
                  onClick={() => setActiveSubTabState('analytics')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    activeSubTabState === 'analytics' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon icon="solar:chart-square-bold-duotone" className="w-4 h-4" />
                  Analytics
                </button>
                <button 
                  onClick={() => setActiveSubTabState('geographic')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    activeSubTabState === 'geographic' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon icon="solar:map-bold-duotone" className="w-4 h-4" />
                  Geographic
                </button>
                <button 
                  onClick={() => setActiveSubTabState('insights')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    activeSubTabState === 'insights' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon icon="solar:chart-2-bold-duotone" className="w-4 h-4" />
                  Insights
                </button>
              </div>
            </div>
          </div>

          {/* Patient Distribution Treemap */}
          <DashboardSection
            title="Patient Geographic Distribution"
            icon="solar:map-bold-duotone"
            iconColor="from-blue-600 to-indigo-600"
            actions={
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-gray-600">High Density</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500/20 rounded"></div>
                  <span className="text-gray-600">Low Density</span>
                </div>
              </div>
            }
          >
            {loadingGeographic ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading geographic data...</p>
                </div>
              </div>
            ) : geographicData.length === 0 ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <Icon icon="solar:map-point-wave-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">No geographic data available yet.</p>
                  <button 
                    onClick={processPatientLocations}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4" />
                    Process Patient Locations
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="w-full h-[520px] relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-blue-50/30 p-1">
                  <div className="w-full h-full rounded-lg overflow-hidden">
                    <TreemapVisualization data={geographicData} />
                  </div>
                </div>
              </>
            )}
            
            
            {/* Treemap Insights */}
            {geographicData.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700 font-medium mb-1">Top Suburb</p>
                <p className="text-sm font-bold text-blue-900">{geographicData[0]?.suburb || 'N/A'}</p>
                <p className="text-xs text-blue-600">{geographicData[0]?.patients || 0} patients</p>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-700 font-medium mb-1">Coverage</p>
                <p className="text-sm font-bold text-gray-900">{geographicData.length} Areas</p>
                <p className="text-xs text-gray-600">Active locations</p>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700 font-medium mb-1">Density Score</p>
                <p className="text-sm font-bold text-blue-900">{totalGeographicPatients > 0 ? (totalGeographicVisits / totalGeographicPatients).toFixed(1) : '0'}</p>
                <p className="text-xs text-blue-600">Visits per patient</p>
              </div>
            </div>
            )}
          </DashboardSection>

          {/* Geographic Insights */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Icon icon="solar:lightbulb-bolt-bold-duotone" className="w-6 h-6 text-blue-700" />
                <h3 className="text-lg font-semibold text-blue-900">Geographic Insights</h3>
              </div>
              {geographicData.length > 0 && (
                <button 
                  onClick={processPatientLocations}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors flex items-center gap-1"
                >
                  <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4" />
                  Refresh Data
                </button>
              )}
            </div>
            {geographicData.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-cyan-700 mb-2">
                    <strong>Primary Service Area:</strong> Your practice serves {geographicData.length} distinct areas
                    with highest patient density in {geographicData[0]?.suburb || 'various suburbs'}.
                  </p>
                </div>
                <div>
                  <p className="text-cyan-700">
                    <strong>Growth Opportunity:</strong> Focus on areas with high visit frequency but lower patient counts
                    to maximize practice growth potential.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-cyan-700 mb-4">
                  Process patient location data to see geographic insights and identify growth opportunities.
                </p>
                <button 
                  onClick={processPatientLocations}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors inline-flex items-center gap-2"
                >
                  <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4" />
                  Process Patient Locations
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Right Column - Filters (same as analytics) */}
        <div className="col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Filters</h3>
          
          {/* Date Range Filter */}
          <button
            onClick={() => setActiveModal('date')}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-cyan-500" />
              <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-gray-400" />
            </div>
            <h4 className="text-sm font-medium text-gray-900 text-left">Date Range</h4>
            <p className="text-xs text-cyan-600 text-left mt-1">
              {selectedDateRange === '7d' ? 'Last 7 Days' : 
               selectedDateRange === '30d' ? 'Last 30 Days' : 
               selectedDateRange === '3m' ? 'Last 3 Months' : 'Last 6 Months'}
            </p>
          </button>
          
          {/* Gender Filter */}
          <button
            onClick={() => setActiveModal('gender')}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-5 h-5 text-purple-500" />
              <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-gray-400" />
            </div>
            <h4 className="text-sm font-medium text-gray-900 text-left">Gender</h4>
            <p className="text-xs text-purple-600 text-left mt-1">{selectedGender}</p>
          </button>
          
          {/* Age Group Filter */}
          <button
            onClick={() => setActiveModal('age')}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:user-id-bold-duotone" className="w-5 h-5 text-green-500" />
              <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-gray-400" />
            </div>
            <h4 className="text-sm font-medium text-gray-900 text-left">Age Groups</h4>
            <p className="text-xs text-green-600 text-left mt-1">
              {selectedAgeGroup === 'All Ages' ? 'All Ages' : `${selectedAgeGroup} years`}
            </p>
          </button>
          
          {/* Branch Filter */}
          <button
            onClick={() => setActiveModal('branch')}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:buildings-2-bold-duotone" className="w-5 h-5 text-indigo-500" />
              <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-gray-400" />
            </div>
            <h4 className="text-sm font-medium text-gray-900 text-left">Branch</h4>
            <p className="text-xs text-indigo-600 text-left mt-1">{selectedBranch}</p>
          </button>
        </div>
      </div>
    </>
  );

  const renderInsightsContent = () => {
    return (
      <>
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Quick Stats (same as other views) */}
          <div className="col-span-2 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Quick Stats</h3>
            
            {/* Total Visits Tile */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon icon="solar:calendar-check-bold-duotone" className="w-6 h-6 text-cyan-500" />
                <span className="text-xs text-gray-500">
                  {selectedDateRange === '7d' ? '7D' : 
                   selectedDateRange === '30d' ? '30D' : 
                   selectedDateRange === '3m' ? '3M' : '6M'}
                </span>
              </div>
              <p className="text-xl font-bold text-gray-900">{filteredStats.totalVisits || 0}</p>
              <p className="text-xs text-gray-600 mt-1">Total Visits</p>
            </div>
            
            {/* Completed Visits Tile */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-green-500" />
              <span className="text-xs text-red-600">-67%</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{filteredStats.completedVisits || 0}</p>
              <p className="text-xs text-gray-600 mt-1">Completed</p>
            </div>
            
            {/* New Patients Tile */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon icon="solar:user-plus-bold-duotone" className="w-6 h-6 text-purple-500" />
                <span className="text-xs text-purple-600">New</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{filteredStats.newPatients || 0}</p>
              <p className="text-xs text-gray-600 mt-1">New Patients</p>
            </div>
            
            {/* Revenue Tile */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon icon="solar:dollar-bold-duotone" className="w-6 h-6 text-amber-500" />
                <span className="text-xs text-amber-600">
                  {selectedDateRange === '7d' ? '7D' : 
                   selectedDateRange === '30d' ? '30D' : 
                   selectedDateRange === '3m' ? '3M' : '6M'}
                </span>
              </div>
              <p className="text-xl font-bold text-gray-900">N${((filteredStats.totalRevenue || 0) / 1000).toFixed(1)}k</p>
              <p className="text-xs text-gray-600 mt-1">Revenue</p>
            </div>

            {/* Highest Day Tile */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon icon="solar:chart-square-bold-duotone" className="w-6 h-6 text-emerald-500" />
                <span className="text-xs text-emerald-600">Peak</span>
              </div>
              <p className="text-xl font-bold text-gray-900">
                {Math.max(...(dailyVisitsData?.slice(-7).map(d => d.visits) || [12, 8, 15, 11, 9, 6, 14]))}
              </p>
              <p className="text-xs text-gray-600 mt-1">Highest Day</p>
            </div>
          </div>
          
          {/* Middle Column - AI Insights Content */}
          <div className="col-span-8 space-y-6">
            {loadingInsights ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Generating AI insights...</p>
                </div>
              </div>
            ) : insightsError ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <Icon icon="solar:danger-triangle-bold-duotone" className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <p className="text-red-600 mb-4">{insightsError}</p>
                  <button 
                    onClick={regenerateInsights}
                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : !aiInsights || Object.keys(aiInsights).length === 0 ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <Icon icon="solar:chart-square-bold-duotone" className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">No insights available yet</p>
                  <button 
                    onClick={fetchAIInsights}
                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
                  >
                    Generate Insights
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* AI Insights Header */}
                <DashboardSection
                  title="AI-Generated Practice Insights"
                  icon="solar:lightbulb-bolt-bold-duotone"
                  iconColor="from-purple-500 to-pink-600"
                  actions={
                    <button
                      onClick={regenerateInsights}
                      disabled={loadingInsights}
                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4" />
                      Refresh Insights
                    </button>
                  }
                >
                  {/* AI Summary Cards */}
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="text-center p-3 bg-cyan-50 rounded-lg border border-cyan-100">
                      <Icon icon="solar:heart-pulse-bold-duotone" className="w-6 h-6 text-cyan-600 mx-auto mb-1" />
                      <p className="text-xs text-cyan-600">Hypertension Rate</p>
                      <p className="text-lg font-bold text-cyan-700">{aiInsights.clinicalInsights?.vitalTrends?.hypertensionPrevalence || 0}%</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                      <Icon icon="solar:shield-check-bold-duotone" className="w-6 h-6 text-green-600 mx-auto mb-1" />
                      <p className="text-xs text-green-600">Medical Aid Coverage</p>
                      <p className="text-lg font-bold text-green-700">{aiInsights.patientDemographics?.medicalAidCoverage || 0}%</p>
                    </div>
                    <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <Icon icon="solar:dollar-minimalistic-bold-duotone" className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                      <p className="text-xs text-amber-600">Avg Revenue/Visit</p>
                      <p className="text-lg font-bold text-amber-700">N${aiInsights.financialInsights?.averageRevenuePerVisit || 0}</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
                      <Icon icon="solar:users-group-rounded-bold-duotone" className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                      <p className="text-xs text-purple-600">Daily Avg Visits</p>
                      <p className="text-lg font-bold text-purple-700">{aiInsights.summary?.averageVisitsPerDay || 0}</p>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700">AI Recommendations</h4>
                    {aiInsights.recommendations?.length > 0 ? (
                      aiInsights.recommendations.map((recommendation: string, index: number) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="p-3 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200"
                        >
                          <div className="flex items-start gap-3">
                            <Icon icon="solar:star-bold-duotone" className="w-4 h-4 text-purple-600 mt-0.5" />
                            <p className="text-sm text-gray-700">{recommendation}</p>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No specific recommendations at this time</p>
                    )}
                  </div>
                </DashboardSection>

                {/* Clinical Insights and Alerts Grid */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Clinical Analysis */}
                  <DashboardSection
                    title="Clinical Analysis"
                    icon="solar:health-bold-duotone"
                    iconColor="from-green-500 to-emerald-600"
                  >
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Top Diagnoses</h4>
                        <div className="space-y-2">
                          {aiInsights.clinicalInsights?.topDiagnoses?.slice(0, 5).map((diagnosis: any, index: number) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">{diagnosis.diagnosis}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full"
                                    style={{ width: `${diagnosis.percentage}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-gray-900 w-10 text-right">{diagnosis.count}</span>
                              </div>
                            </div>
                          )) || <p className="text-sm text-gray-500">No diagnosis data available</p>}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Vital Statistics</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-2 bg-gray-50 rounded-lg">
                            <Icon icon="solar:heart-bold-duotone" className="w-5 h-5 text-red-500 mx-auto mb-1" />
                            <p className="text-xs text-gray-600">Avg BP</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {aiInsights.clinicalInsights?.vitalTrends?.averageBP?.systolic || 0}/
                              {aiInsights.clinicalInsights?.vitalTrends?.averageBP?.diastolic || 0}
                            </p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded-lg">
                            <Icon icon="solar:user-heart-rounded-bold-duotone" className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                            <p className="text-xs text-gray-600">Avg BMI</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {aiInsights.clinicalInsights?.vitalTrends?.averageBMI || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DashboardSection>

                  {/* System Alerts */}
                  <DashboardSection
                    title="System Alerts & Insights"
                    icon="solar:danger-triangle-bold-duotone"
                    iconColor="from-amber-500 to-orange-600"
                  >
                    <div className="space-y-3">
                      {aiInsights.alerts?.length > 0 ? (
                        aiInsights.alerts.map((alert: any, index: number) => (
                          <div
                            key={index}
                            className={`p-3 rounded-lg border flex items-start gap-3 ${
                              alert.type === 'warning' ? 'bg-amber-50 border-amber-200' :
                              alert.type === 'success' ? 'bg-green-50 border-green-200' :
                              'bg-blue-50 border-blue-200'
                            }`}
                          >
                            <Icon 
                              icon={
                                alert.type === 'warning' ? 'solar:danger-triangle-bold' :
                                alert.type === 'success' ? 'solar:check-circle-bold' :
                                'solar:info-circle-bold'
                              }
                              className={`w-5 h-5 ${
                                alert.type === 'warning' ? 'text-amber-600' :
                                alert.type === 'success' ? 'text-green-600' :
                                'text-blue-600'
                              }`}
                            />
                            <p className="text-sm text-gray-700">{alert.message}</p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <Icon icon="solar:shield-check-bold-duotone" className="w-12 h-12 text-green-500 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">All systems operating normally</p>
                        </div>
                      )}

                      {/* Financial Summary */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Financial Performance</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">On-time Payments</span>
                            <span className="text-sm font-medium text-green-600">
                              {aiInsights.financialInsights?.paymentTrends?.onTimePayments || 0}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Late Payments</span>
                            <span className="text-sm font-medium text-red-600">
                              {aiInsights.financialInsights?.paymentTrends?.latePayments || 0}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Unpaid Amount</span>
                            <span className="text-sm font-medium text-amber-600">
                              N${((aiInsights.financialInsights?.unpaidInvoicesValue || 0) / 1000).toFixed(0)}k
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DashboardSection>
                </div>

                {/* Common Medications */}
                <DashboardSection
                  title="Most Prescribed Medications"
                  icon="solar:pills-bold-duotone"
                  iconColor="from-cyan-500 to-blue-600"
                >
                  <div className="space-y-2">
                    {aiInsights.clinicalInsights?.commonMedications?.slice(0, 8).map((med: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center">
                            <span className="text-xs font-bold text-cyan-600">{index + 1}</span>
                          </div>
                          <span className="text-sm text-gray-700">{med.medication}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{med.count} prescriptions</span>
                      </div>
                    )) || <p className="text-sm text-gray-500">No medication data available</p>}
                  </div>
                </DashboardSection>
              </>
            )}
          </div>
          
          {/* Right Column - Filters (same as other views) */}
          <div className="col-span-2 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Filters</h3>
            
            {/* Date Range Filter */}
            <button
              onClick={() => setActiveModal('date')}
              className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-cyan-500" />
                <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-gray-400" />
              </div>
              <h4 className="text-sm font-medium text-gray-900 text-left">Date Range</h4>
              <p className="text-xs text-cyan-600 text-left mt-1">
                {selectedDateRange === '7d' ? 'Last 7 Days' : 
                 selectedDateRange === '30d' ? 'Last 30 Days' : 
                 selectedDateRange === '3m' ? 'Last 3 Months' : 'Last 6 Months'}
              </p>
            </button>
            
            {/* Gender Filter */}
            <button
              onClick={() => setActiveModal('gender')}
              className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-5 h-5 text-purple-500" />
                <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-gray-400" />
              </div>
              <h4 className="text-sm font-medium text-gray-900 text-left">Gender</h4>
              <p className="text-xs text-purple-600 text-left mt-1">{selectedGender}</p>
            </button>
            
            {/* Age Group Filter */}
            <button
              onClick={() => setActiveModal('age')}
              className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <Icon icon="solar:user-id-bold-duotone" className="w-5 h-5 text-green-500" />
                <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-gray-400" />
              </div>
              <h4 className="text-sm font-medium text-gray-900 text-left">Age Groups</h4>
              <p className="text-xs text-green-600 text-left mt-1">
                {selectedAgeGroup === 'All Ages' ? 'All Ages' : `${selectedAgeGroup} years`}
              </p>
            </button>

            {/* AI Insights Info */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-4">
              <div className="flex items-start gap-3">
                <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-purple-900">About AI Insights</h4>
                  <p className="text-xs text-purple-700 mt-1">
                    Generated from last 3 months of data • Updates weekly on Sundays • Analyzes {aiInsights?.summary?.totalVisits || 0} visits
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Modals - same as analytics view */}
        <AnimatePresence>
          {activeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setActiveModal(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 20 }}
                className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                {activeModal === 'date' && (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold text-gray-900">Select Date Range</h3>
                      <button 
                        onClick={() => setActiveModal(null)}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                      >
                        <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
                      </button>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      {(['7d', '30d', '3m', '6m'] as const).map((range) => (
                        <button
                          key={range}
                          className={`w-full px-4 py-3 rounded-xl font-medium transition-all ${
                            selectedDateRange === range
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                          onClick={() => {
                            setSelectedDateRange(range);
                            setActiveModal(null);
                          }}
                        >
                          {range === '7d' ? 'Last 7 Days' : 
                           range === '30d' ? 'Last 30 Days' : 
                           range === '3m' ? 'Last 3 Months' : 'Last 6 Months'}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {activeModal === 'gender' && (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold text-gray-900">Select Gender</h3>
                      <button 
                        onClick={() => setActiveModal(null)}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                      >
                        <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
                      </button>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      {['All', 'Male', 'Female', 'Other'].map((gender) => (
                        <button
                          key={gender}
                          className={`w-full px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-between ${
                            selectedGender === gender
                              ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                          onClick={() => {
                            setSelectedGender(gender);
                            setActiveModal(null);
                          }}
                        >
                          <span>{gender}</span>
                          <span className={`text-sm ${selectedGender === gender ? 'text-white/80' : 'text-gray-500'}`}>
                            {gender === 'All' ? '100%' : gender === 'Male' ? '36%' : gender === 'Female' ? '47%' : '17%'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {activeModal === 'age' && (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold text-gray-900">Select Age Group</h3>
                      <button 
                        onClick={() => setActiveModal(null)}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                      >
                        <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
                      </button>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      {['All Ages', '0-17', '18-30', '31-50', '51-70', '70+'].map((ageGroup) => (
                        <button
                          key={ageGroup}
                          className={`w-full px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-between ${
                            selectedAgeGroup === ageGroup
                              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                          onClick={() => {
                            setSelectedAgeGroup(ageGroup);
                            setActiveModal(null);
                          }}
                        >
                          <span>{ageGroup === 'All Ages' ? 'All Ages' : `${ageGroup} years`}</span>
                          <span className={`text-sm ${selectedAgeGroup === ageGroup ? 'text-white/80' : 'text-gray-500'}`}>
                            {ageGroup === 'All Ages' ? '100%' : 
                             ageGroup === '0-17' ? '15%' :
                             ageGroup === '18-30' ? '25%' :
                             ageGroup === '31-50' ? '35%' :
                             ageGroup === '51-70' ? '20%' : '5%'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {renderSubTabContent()}
    </div>
  );
};
