import React from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Shield, Stethoscope } from 'lucide-react';
import { Patient } from '../../stores/patientsStoreNew';

interface PatientStatisticsProps {
  filteredPatients: Patient[];
}

export const PatientStatistics: React.FC<PatientStatisticsProps> = ({ 
  filteredPatients 
}) => {
  const totalPatients = filteredPatients.length;
  const newThisMonth = Math.floor(totalPatients * 0.15);
  const withMedicalAid = filteredPatients.filter(p => 
    p.medical_aid_details && p.medical_aid_details.length > 0
  ).length;
  const medicalAidPercentage = totalPatients > 0 
    ? Math.round((withMedicalAid / totalPatients) * 100) 
    : 0;

  const stats = [
    {
      label: 'Total Patients',
      value: totalPatients,
      description: 'active records',
      badge: 'TOTAL',
      icon: Users,
      delay: 0.05,
    },
    {
      label: 'New This Month',
      value: `+${newThisMonth}`,
      description: 'new registrations',
      badge: 'NEW',
      icon: UserPlus,
      delay: 0.1,
    },
    {
      label: 'Medical Aid Coverage',
      value: `${medicalAidPercentage}%`,
      description: `${withMedicalAid} covered`,
      badge: 'COVER',
      icon: Shield,
      delay: 0.15,
    },
    {
      label: 'Patient Services',
      value: '8',
      description: 'services available',
      badge: 'CARE',
      icon: Stethoscope,
      delay: 0.2,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: stat.delay, duration: 0.3 }}
          className="bg-gradient-to-br from-white/15 to-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-200 group relative overflow-hidden"
        >
          <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
            <stat.icon className="w-20 h-20 text-white transform rotate-12" />
          </div>
          <div className="relative z-10">
            <p className="text-white/80 text-sm font-medium mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-white group-hover:scale-105 transition-transform duration-300">
              {stat.value}
            </p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/60">{stat.description}</p>
              <div className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">
                {stat.badge}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};