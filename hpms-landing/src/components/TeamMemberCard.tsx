import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { PROFESSIONAL_HEADSHOTS } from '@/utils/imageHelpers';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  title: string;
  bio?: string;
  imageUrl?: string;
  credentials?: string;
}

interface TeamMemberCardProps {
  member: TeamMember;
}

const TeamMemberCard: React.FC<TeamMemberCardProps> = ({ member }) => {
  const [imageError, setImageError] = useState(false);
  
  // Get the image URL with fallback
  const imageUrl = imageError 
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=00BCD4&color=fff&size=400`
    : member.imageUrl || PROFESSIONAL_HEADSHOTS.female1; // Use a default professional headshot
  
  return (
    <div className="group relative bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
      {/* Image Container */}
      <div className="relative h-64 overflow-hidden bg-gray-100">
        <img 
          src={imageUrl}
          alt={member.name}
          className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
          onError={() => setImageError(true)}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Quick Actions (shown on hover) */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button className="p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors">
            <Icon icon="solar:phone-bold-duotone" className="w-5 h-5 text-[#00BCD4]" />
          </button>
          <button className="p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors">
            <Icon icon="solar:letter-bold-duotone" className="w-5 h-5 text-[#00BCD4]" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-1">{member.name}</h3>
        <p className="text-[#00BCD4] font-medium mb-2">{member.title}</p>
        {member.bio && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{member.bio}</p>
        )}
        {member.credentials && (
          <p className="text-gray-500 text-xs">{member.credentials}</p>
        )}
      </div>
      
      {/* Accent Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00BCD4] to-[#0097A7] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
    </div>
  );
};

export default TeamMemberCard;

// Example usage with proper Unsplash images
export const TeamMemberExample: React.FC = () => {
  const teamMembers: TeamMember[] = [
    {
      id: '1',
      name: 'Dr. Sarah Mitchell',
      role: 'dentist',
      title: 'Lead Dentist',
      bio: 'Specializing in cosmetic and restorative dentistry with over 15 years of experience.',
      imageUrl: PROFESSIONAL_HEADSHOTS.female1,
      credentials: 'DDS, FAGD'
    },
    {
      id: '2',
      name: 'Dr. James Chen',
      role: 'dentist',
      title: 'Orthodontist',
      bio: 'Expert in Invisalign and traditional orthodontic treatments.',
      imageUrl: PROFESSIONAL_HEADSHOTS.male1,
      credentials: 'DDS, MS Orthodontics'
    },
    {
      id: '3',
      name: 'Dr. Emily Rodriguez',
      role: 'dentist',
      title: 'Pediatric Dentist',
      bio: 'Creating positive dental experiences for children of all ages.',
      imageUrl: PROFESSIONAL_HEADSHOTS.female2,
      credentials: 'DDS, Pediatric Specialty'
    },
    {
      id: '4',
      name: 'Lisa Thompson',
      role: 'hygienist',
      title: 'Senior Dental Hygienist',
      bio: 'Passionate about preventive care and patient education.',
      imageUrl: PROFESSIONAL_HEADSHOTS.female3,
      credentials: 'RDH'
    }
  ];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {teamMembers.map((member) => (
        <TeamMemberCard key={member.id} member={member} />
      ))}
    </div>
  );
};