import React from 'react';
import { motion } from 'framer-motion';

const NewCharmPromoBanner: React.FC = () => {
  const offers = [
    {
      id: 'teeth-whitening',
      discount: '50',
      tagline: 'Advanced Teeth Whitening - Premium Brands',
      title: 'Brighter Smile Special',
      image: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=600&h=300&fit=crop',
      link: '#contact',
      buttonText: 'Book Now'
    },
    {
      id: 'dental-implants',
      discount: '30',
      tagline: 'Dental Implants - Top Quality Materials',
      title: 'Complete Smile Package',
      image: 'https://images.unsplash.com/photo-1609207825181-52d3214556dd?w=600&h=300&fit=crop',
      link: '#contact',
      buttonText: 'Learn More'
    }
  ];

  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-4">
          {offers.map((offer, index) => (
            <motion.div
              key={offer.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative overflow-hidden rounded-xl group"
              style={{
                backgroundImage: `url(${offer.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                height: '240px'
              }}
            >
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
              
              {/* Content */}
              <div className="relative z-10 p-6 h-full flex flex-col justify-between">
                {/* Top section with discount */}
                <div className="flex justify-end">
                  <div className="flex items-baseline text-white">
                    <span className="text-5xl font-bold leading-none">{offer.discount}</span>
                    <div className="ml-[-0.21em]">
                      <div className="text-xl font-bold">%</div>
                      <p className="text-xs font-bold uppercase leading-[1.1em] tracking-[-0.05em]">Off</p>
                    </div>
                  </div>
                </div>

                {/* Bottom section with content */}
                <div>
                  <h2 className="text-[0.9375rem] text-white/70 leading-[1.4em] font-medium tracking-[-0.025em] mb-1">
                    {offer.tagline}
                  </h2>
                  <h2 className="text-[2.375rem] leading-[1em] font-bold tracking-[-0.025em] text-white mb-4">
                    {offer.title}
                  </h2>
                  <a
                    href={offer.link}
                    className="inline-flex items-center px-[2.82em] py-[0.82em] bg-gray-900 text-white rounded-full text-[0.875rem] font-semibold tracking-[-0.015em] hover:bg-gray-800 transition-all duration-300 group"
                  >
                    <span className="relative overflow-hidden h-[1.2em]">
                      <span className="block transition-transform duration-300 group-hover:-translate-y-full">
                        {offer.buttonText}
                      </span>
                      <span className="block absolute top-full transition-transform duration-300 group-hover:-translate-y-full">
                        {offer.buttonText}
                      </span>
                    </span>
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NewCharmPromoBanner;