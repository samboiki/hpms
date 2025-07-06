import React from 'react';
import { Icon } from '@iconify/react';

const NewCharmAbout: React.FC = () => {
  const stats = [
    { number: '15+', label: 'Years of Excellence' },
    { number: '10k+', label: 'Happy Patients' },
    { number: '25+', label: 'Expert Dentists' },
    { number: '99%', label: 'Patient Satisfaction' }
  ];

  const values = [
    {
      icon: 'solar:hand-heart-bold',
      title: 'Patient-Centered Care',
      description: 'Your comfort and wellbeing are our top priorities.'
    },
    {
      icon: 'solar:diploma-bold',
      title: 'Clinical Excellence',
      description: 'Continuous education and state-of-the-art techniques.'
    },
    {
      icon: 'solar:shield-check-bold',
      title: 'Trust & Transparency',
      description: 'Honest communication and clear treatment plans.'
    },
    {
      icon: 'solar:star-shine-bold',
      title: 'Innovation',
      description: 'Embracing the latest dental technologies.'
    }
  ];

  return (
    <section id="about" className="py-24 bg-gray-50">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <div>
            <div className="inline-flex items-center space-x-2 bg-white px-4 py-2 rounded-full mb-6 shadow-sm">
              <Icon icon="solar:info-circle-bold" className="w-4 h-4 text-[#7C3AED]" />
              <span className="text-sm text-[#7C3AED] font-medium">About NewCharm</span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-light text-gray-900 mb-6 leading-tight">
              Where expertise meets
              <span className="block text-[#7C3AED] font-normal mt-2">compassionate care</span>
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
                <div key={index} className="text-center">
                  <div className="text-3xl font-light text-[#7C3AED] mb-1">{stat.number}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              ))}
            </div>

            <button className="px-8 py-4 bg-[#7C3AED] text-white rounded-full hover:bg-[#6B21A8] transition-all duration-300 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center space-x-2">
              <span>Meet Our Team</span>
              <Icon icon="solar:arrow-right-linear" className="w-5 h-5" />
            </button>
          </div>

          {/* Right Content - Values */}
          <div className="lg:pl-12">
            <div className="bg-white rounded-3xl p-10 shadow-sm">
              <h3 className="text-2xl font-medium text-gray-900 mb-8">Our Core Values</h3>
              
              <div className="space-y-6">
                {values.map((value, index) => (
                  <div key={index} className="flex space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-[#7C3AED]/10 rounded-xl flex items-center justify-center">
                        <Icon icon={value.icon} className="w-6 h-6 text-[#7C3AED]" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-1">{value.title}</h4>
                      <p className="text-gray-600 leading-relaxed">{value.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Accreditation */}
              <div className="mt-10 pt-8 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-4">Accredited by</p>
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <Icon icon="solar:verified-check-bold" className="w-5 h-5 text-[#7C3AED]" />
                    <span className="text-sm text-gray-700">ADA Member</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Icon icon="solar:shield-check-bold" className="w-5 h-5 text-[#7C3AED]" />
                    <span className="text-sm text-gray-700">ISO Certified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Technology Section */}
        <div className="mt-20 bg-white rounded-3xl p-12">
          <div className="max-w-3xl mx-auto text-center">
            <Icon icon="solar:cpu-bolt-bold" className="w-12 h-12 text-[#7C3AED] mx-auto mb-6" />
            <h3 className="text-3xl font-light text-gray-900 mb-4">
              Advanced Technology for Better Care
            </h3>
            <p className="text-gray-600 leading-relaxed mb-8">
              We invest in the latest dental technology to ensure precise diagnoses, 
              comfortable treatments, and exceptional results. From digital X-rays to 
              3D imaging and laser dentistry, we're equipped to provide the best care possible.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {['Digital X-Rays', '3D Imaging', 'Laser Dentistry', 'Intraoral Cameras'].map((tech, index) => (
                <div key={index} className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700">
                  {tech}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewCharmAbout;