export interface SubService {
  id: string;
  name: string;
  description: string;
  duration: string;
  price: string;
  benefits?: string[];
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  image?: string;
  subServices: SubService[];
}

export const newcharmServices: ServiceCategory[] = [
  {
    id: 'general-dentistry',
    name: 'General Dentistry',
    icon: 'Shield',
    description: 'Comprehensive dental care for your entire family',
    color: 'from-blue-400 to-cyan-400',
    image: '/images/newcharm/general-dentistry.jpg',
    subServices: [
      {
        id: 'routine-checkup',
        name: 'Routine Dental Checkup',
        description: 'Comprehensive oral examination, cleaning, and preventive care',
        duration: '60 minutes',
        price: 'N$450',
        benefits: [
          'Complete oral health assessment',
          'Professional teeth cleaning',
          'Early detection of dental issues',
          'Personalized oral hygiene advice'
        ]
      },
      {
        id: 'dental-cleaning',
        name: 'Professional Teeth Cleaning',
        description: 'Deep cleaning to remove plaque, tartar, and stains',
        duration: '45 minutes',
        price: 'N$350',
        benefits: [
          'Plaque and tartar removal',
          'Stain removal',
          'Gum disease prevention',
          'Fresh breath'
        ]
      },
      {
        id: 'dental-fillings',
        name: 'Dental Fillings',
        description: 'Tooth-colored composite fillings for cavities',
        duration: '90 minutes',
        price: 'From N$650',
        benefits: [
          'Natural-looking results',
          'Durability and strength',
          'Minimal tooth removal',
          'Same-day completion'
        ]
      },
      {
        id: 'root-canal',
        name: 'Root Canal Treatment',
        description: 'Advanced endodontic therapy to save infected teeth',
        duration: '120 minutes',
        price: 'From N$2,800',
        benefits: [
          'Saves natural tooth',
          'Eliminates infection',
          'Pain relief',
          'Preserves jaw alignment'
        ]
      }
    ]
  },
  {
    id: 'cosmetic-dentistry',
    name: 'Cosmetic Dentistry',
    icon: 'Sparkles',
    description: 'Enhance your smile with our advanced cosmetic procedures',
    color: 'from-pink-400 to-rose-400',
    image: '/images/newcharm/cosmetic-dentistry.jpg',
    subServices: [
      {
        id: 'teeth-whitening',
        name: 'Professional Teeth Whitening',
        description: 'In-office whitening for dramatically whiter teeth',
        duration: '90 minutes',
        price: 'N$2,800',
        benefits: [
          'Up to 8 shades whiter',
          'Immediate results',
          'Safe and supervised',
          'Long-lasting effects'
        ]
      },
      {
        id: 'porcelain-veneers',
        name: 'Porcelain Veneers',
        description: 'Custom-crafted veneers for a perfect smile',
        duration: '2-3 visits',
        price: 'From N$4,500 per tooth',
        benefits: [
          'Natural appearance',
          'Stain resistant',
          'Durable and long-lasting',
          'Minimal tooth preparation'
        ]
      },
      {
        id: 'smile-makeover',
        name: 'Complete Smile Makeover',
        description: 'Comprehensive treatment plan for total smile transformation',
        duration: 'Multiple visits',
        price: 'Custom quote',
        benefits: [
          'Personalized treatment plan',
          'Multiple procedures combined',
          'Dramatic results',
          'Boost in confidence'
        ]
      },
      {
        id: 'dental-bonding',
        name: 'Dental Bonding',
        description: 'Tooth-colored resin to repair chips, gaps, and imperfections',
        duration: '60 minutes',
        price: 'From N$850',
        benefits: [
          'Quick and painless',
          'Natural appearance',
          'Cost-effective',
          'Immediate results'
        ]
      }
    ]
  },
  {
    id: 'orthodontics',
    name: 'Orthodontics',
    icon: 'Smile',
    description: 'Straighten your teeth with modern orthodontic solutions',
    color: 'from-green-400 to-emerald-400',
    image: '/images/newcharm/orthodontics.jpg',
    subServices: [
      {
        id: 'traditional-braces',
        name: 'Traditional Metal Braces',
        description: 'Reliable and effective teeth straightening solution',
        duration: '18-24 months',
        price: 'From N$18,000',
        benefits: [
          'Most effective for complex cases',
          'Durable and reliable',
          'Cost-effective option',
          'Proven results'
        ]
      },
      {
        id: 'clear-aligners',
        name: 'Clear Aligner Therapy',
        description: 'Nearly invisible aligners for discreet teeth straightening',
        duration: '12-18 months',
        price: 'From N$35,000',
        benefits: [
          'Nearly invisible',
          'Removable for eating',
          'Comfortable to wear',
          'Shorter treatment time'
        ]
      },
      {
        id: 'ceramic-braces',
        name: 'Ceramic Braces',
        description: 'Tooth-colored braces for a more aesthetic option',
        duration: '18-24 months',
        price: 'From N$25,000',
        benefits: [
          'Less visible than metal',
          'Effective treatment',
          'Comfortable fit',
          'Aesthetic appeal'
        ]
      },
      {
        id: 'retainers',
        name: 'Retainers',
        description: 'Custom retainers to maintain your straight smile',
        duration: 'Ongoing',
        price: 'From N$1,200',
        benefits: [
          'Maintains results',
          'Custom fit',
          'Clear or fixed options',
          'Long-term solution'
        ]
      }
    ]
  },
  {
    id: 'oral-surgery',
    name: 'Oral Surgery',
    icon: 'Activity',
    description: 'Specialized surgical procedures for complex dental needs',
    color: 'from-red-400 to-orange-400',
    image: '/images/newcharm/oral-surgery.jpg',
    subServices: [
      {
        id: 'tooth-extraction',
        name: 'Tooth Extraction',
        description: 'Safe and comfortable tooth removal procedures',
        duration: '45-90 minutes',
        price: 'From N$650',
        benefits: [
          'Pain relief',
          'Prevent infection spread',
          'Comfortable procedure',
          'Quick recovery'
        ]
      },
      {
        id: 'wisdom-teeth',
        name: 'Wisdom Tooth Removal',
        description: 'Specialized removal of problematic wisdom teeth',
        duration: '90-120 minutes',
        price: 'From N$1,800',
        benefits: [
          'Prevent crowding',
          'Reduce pain and discomfort',
          'Prevent cysts and infections',
          'Improve oral hygiene'
        ]
      },
      {
        id: 'dental-implants',
        name: 'Dental Implants',
        description: 'Permanent replacement for missing teeth',
        duration: '3-6 months process',
        price: 'From N$12,000',
        benefits: [
          'Natural feel and function',
          'Permanent solution',
          'Preserve jawbone',
          'No impact on other teeth'
        ]
      },
      {
        id: 'bone-grafting',
        name: 'Bone Grafting',
        description: 'Bone regeneration procedures for implant preparation',
        duration: '2-4 hours',
        price: 'From N$8,500',
        benefits: [
          'Enables implant placement',
          'Restores bone structure',
          'Long-term stability',
          'Advanced techniques'
        ]
      }
    ]
  },
  {
    id: 'emergency-care',
    name: 'Emergency Dental Care',
    icon: 'AlertTriangle',
    description: 'Immediate dental care when you need it most',
    color: 'from-yellow-400 to-amber-400',
    image: '/images/newcharm/emergency-care.jpg',
    subServices: [
      {
        id: 'emergency-consultation',
        name: 'Emergency Consultation',
        description: 'Immediate assessment and pain relief for dental emergencies',
        duration: '30-45 minutes',
        price: 'N$550',
        benefits: [
          'Same-day appointments',
          'Immediate pain relief',
          'Expert assessment',
          'Treatment planning'
        ]
      },
      {
        id: 'trauma-repair',
        name: 'Dental Trauma Repair',
        description: 'Immediate treatment for chipped, cracked, or knocked-out teeth',
        duration: '90-120 minutes',
        price: 'From N$1,200',
        benefits: [
          'Save damaged teeth',
          'Immediate treatment',
          'Pain management',
          'Restore function'
        ]
      },
      {
        id: 'abscess-treatment',
        name: 'Dental Abscess Treatment',
        description: 'Urgent treatment for infected teeth and gums',
        duration: '60-90 minutes',
        price: 'From N$950',
        benefits: [
          'Eliminate infection',
          'Immediate pain relief',
          'Prevent complications',
          'Antibiotic therapy'
        ]
      },
      {
        id: 'lost-filling',
        name: 'Lost Filling/Crown Repair',
        description: 'Emergency repair for lost fillings or crowns',
        duration: '45-60 minutes',
        price: 'From N$450',
        benefits: [
          'Immediate protection',
          'Pain relief',
          'Prevent further damage',
          'Temporary or permanent solution'
        ]
      }
    ]
  },
  {
    id: 'preventive-care',
    name: 'Preventive Care',
    icon: 'Heart',
    description: 'Proactive care to maintain optimal oral health',
    color: 'from-indigo-400 to-purple-400',
    image: '/images/newcharm/preventive-care.jpg',
    subServices: [
      {
        id: 'fluoride-treatment',
        name: 'Fluoride Treatment',
        description: 'Professional fluoride application for cavity prevention',
        duration: '15-30 minutes',
        price: 'N$180',
        benefits: [
          'Strengthen tooth enamel',
          'Prevent cavities',
          'Reduce sensitivity',
          'Safe for all ages'
        ]
      },
      {
        id: 'dental-sealants',
        name: 'Dental Sealants',
        description: 'Protective coating for cavity-prone teeth',
        duration: '30-45 minutes',
        price: 'N$250 per tooth',
        benefits: [
          'Prevent cavities',
          'Long-lasting protection',
          'Painless application',
          'Ideal for children'
        ]
      },
      {
        id: 'gum-disease-prevention',
        name: 'Gum Disease Prevention',
        description: 'Specialized cleaning and treatment to prevent gum disease',
        duration: '60 minutes',
        price: 'From N$650',
        benefits: [
          'Prevent gum disease',
          'Deep cleaning',
          'Reduce inflammation',
          'Maintain healthy gums'
        ]
      },
      {
        id: 'oral-cancer-screening',
        name: 'Oral Cancer Screening',
        description: 'Early detection screening for oral cancer',
        duration: '15-20 minutes',
        price: 'N$350',
        benefits: [
          'Early detection',
          'Peace of mind',
          'Non-invasive screening',
          'Expert evaluation'
        ]
      }
    ]
  }
];

export default newcharmServices;