import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { Practice } from '@/lib/tenants';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

interface NewCharmAboutProps {
  practice: Practice;
}

interface PracticeUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  job_title: string;
  staff_title: string | null;
  hpcsa_number: string | null;
  avatar: string | null;
  practice_role: string;
}

const NewCharmAbout: React.FC<NewCharmAboutProps> = () => {
  const [teamMembers, setTeamMembers] = useState<PracticeUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          role,
          job_title,
          staff_title,
          hpcsa_number,
          avatar
        `)
        .eq('practice_id', 'ffed1160-00ec-4c4f-8810-913a24348d90')
        .eq('is_active', true)
        .order('created_at');

      if (error) throw error;

      // Transform and filter out security guard, limit to 4 members
      const transformedData = (data || [])
        .filter((user: any) => user.job_title?.toLowerCase() !== 'security guard')
        .map((user: any) => ({
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          job_title: user.job_title || (user.role === 'doctor' ? 'Dentist' : user.role === 'admin' ? 'Practice Administrator' : 'Team Member'),
          staff_title: user.staff_title || (user.role === 'doctor' ? 'General Dentistry' : ''),
          hpcsa_number: user.hpcsa_number,
          avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=00BCD4&color=fff`,
          practice_role: user.role
        }))
        .sort((a, b) => {
          // Sort: doctors first, then others
          if (a.role === 'doctor' && b.role !== 'doctor') return -1;
          if (a.role !== 'doctor' && b.role === 'doctor') return 1;
          return 0;
        })
        .slice(0, 4);

      setTeamMembers(transformedData);
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setLoading(false);
    }
  };
  const stats = [
    { number: '15+', label: 'Years of Excellence' },
    { number: '10k+', label: 'Happy Patients' },
    { number: '25+', label: 'Expert Dentists' },
    { number: '99%', label: 'Patient Satisfaction' }
  ];

  const values = [
    {
      icon: 'solar:hand-heart-bold-duotone',
      title: 'Patient-Centered Care',
      description: 'Your comfort and wellbeing are our top priorities.'
    },
    {
      icon: 'solar:diploma-bold-duotone',
      title: 'Clinical Excellence',
      description: 'Continuous education and state-of-the-art techniques.'
    },
    {
      icon: 'solar:shield-check-bold-duotone',
      title: 'Trust & Transparency',
      description: 'Honest communication and clear treatment plans.'
    },
    {
      icon: 'solar:star-shine-bold-duotone',
      title: 'Innovation',
      description: 'Embracing the latest dental technologies.'
    }
  ];


  return (
    <section id="about" className="py-20 md:py-24 bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center space-x-2 bg-white px-4 py-2 rounded-full mb-6 shadow-sm">
              <Icon icon="solar:info-circle-bold-duotone" className="w-4 h-4 text-[#00BCD4]" />
              <span className="text-sm text-[#00BCD4] font-medium">About NewCharm</span>
            </div>
            
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-light text-gray-900 mb-6 leading-tight font-[Lexend]">
              Where expertise meets
              <span className="block bg-gradient-to-r from-[#00BCD4] to-[#0097A7] bg-clip-text text-transparent font-normal mt-2">compassionate care</span>
            </h2>
            
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Since our founding, NewCharm Dental has been dedicated to providing 
              exceptional dental care in a warm, welcoming environment. Our team of 
              experienced professionals combines advanced training with genuine care 
              for each patient's unique needs.
            </p>

            <p className="text-gray-600 mb-8 leading-relaxed">
              We believe that everyone deserves a healthy, beautiful smile. That's why 
              we offer comprehensive services using the latest technology, ensuring 
              comfortable and effective treatment for patients of all ages.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              {stats.map((stat, index) => (
                <motion.div 
                  key={index} 
                  className="text-center"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <div className="text-3xl font-light bg-gradient-to-r from-[#00BCD4] to-[#0097A7] bg-clip-text text-transparent mb-1">{stat.number}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            <button 
              onClick={() => document.getElementById('team')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 bg-gradient-to-r from-[#00BCD4] to-[#0097A7] text-white rounded-full hover:shadow-xl transition-all duration-300 font-medium shadow-lg transform hover:-translate-y-0.5 flex items-center space-x-2"
            >
              <span>Meet Our Team</span>
              <Icon icon="solar:arrow-right-bold-duotone" className="w-5 h-5" />
            </button>
          </motion.div>

          {/* Right Content - Values */}
          <motion.div 
            className="lg:pl-12"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="bg-white rounded-3xl p-8 md:p-10 shadow-sm">
              <h3 className="text-2xl font-medium text-gray-900 mb-8">Our Core Values</h3>
              
              <div className="space-y-6">
                {values.map((value, index) => (
                  <motion.div 
                    key={index} 
                    className="flex space-x-4"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                  >
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#00BCD4]/20 to-[#0097A7]/20 rounded-xl flex items-center justify-center">
                        <Icon icon={value.icon} className="w-6 h-6 text-[#00BCD4]" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-1">{value.title}</h4>
                      <p className="text-gray-600 leading-relaxed">{value.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Accreditation */}
              <div className="mt-10 pt-8 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-4">Accredited by</p>
                <div className="flex flex-wrap items-center gap-4 md:gap-6">
                  <div className="flex items-center space-x-2">
                    <Icon icon="solar:verified-check-bold-duotone" className="w-5 h-5 text-[#00BCD4]" />
                    <span className="text-sm text-gray-700">ADA Member</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5 text-[#00BCD4]" />
                    <span className="text-sm text-gray-700">ISO Certified</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Team Section */}
        <div className="mt-20" id="team">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-light text-gray-900 mb-4 font-[Lexend]">
              Meet Our Expert Team
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our dentists bring years of experience and specialized training to provide 
              you with the best dental care possible.
            </p>
          </div>

          <div className={`grid gap-8 ${teamMembers.length === 1 ? 'grid-cols-1 max-w-sm mx-auto' : teamMembers.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto' : teamMembers.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
            {loading ? (
              // Loading skeleton - show only 1 skeleton
              <div className="animate-pulse mx-auto max-w-sm">
                <div className="bg-white rounded-2xl overflow-hidden shadow-lg">
                  <div className="h-64 bg-gray-200" />
                  <div className="p-6">
                    <div className="h-4 bg-gray-200 rounded mb-2 w-3/4" />
                    <div className="h-3 bg-gray-200 rounded mb-2 w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ) : teamMembers.length > 0 ? (
              teamMembers.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="group"
                >
                  <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
                    <div className="relative h-64 overflow-hidden bg-gray-100">
                      <img 
                        src={member.avatar || ''} 
                        alt={member.full_name}
                        className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.full_name)}&background=00BCD4&color=fff&size=400`;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <div className="p-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-1">{member.full_name}</h4>
                      <p className="text-[#00BCD4] text-sm font-medium mb-2">
                        {member.job_title}
                      </p>
                      {member.staff_title && (
                        <p className="text-gray-600 text-sm">{member.staff_title}</p>
                      )}
                      {member.role === 'doctor' && member.hpcsa_number && (
                        <p className="text-gray-500 text-xs mt-2">HPCSA: {member.hpcsa_number}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              // No team members message
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500">No team members to display at this time.</p>
              </div>
            )}
          </div>
        </div>

        {/* Technology Section */}
        <motion.div 
          className="mt-20 bg-white rounded-3xl p-8 md:p-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="max-w-3xl mx-auto text-center">
            <Icon icon="solar:cpu-bolt-bold-duotone" className="w-12 h-12 text-[#00BCD4] mx-auto mb-6" />
            <h3 className="text-3xl font-light text-gray-900 mb-4">
              Advanced Technology for Better Care
            </h3>
            <p className="text-gray-600 leading-relaxed mb-8">
              We invest in the latest dental technology to ensure precise diagnoses, 
              comfortable treatments, and exceptional results. From digital X-rays to 
              3D imaging and laser dentistry, we're equipped to provide the best care possible.
            </p>
            <div className="flex flex-wrap justify-center gap-3 md:gap-4">
              {['Digital X-Rays', '3D Imaging', 'Laser Dentistry', 'Intraoral Cameras'].map((tech, index) => (
                <motion.div 
                  key={index} 
                  className="px-4 py-2 bg-gradient-to-r from-[#00BCD4]/10 to-[#0097A7]/10 rounded-full text-sm text-gray-700"
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  {tech}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default NewCharmAbout;