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

export const medcenterServices: ServiceCategory[] = [
  {
    id: 'consultations',
    name: 'Consultations & Follow-ups',
    icon: 'MessageSquare',
    description: 'Professional skin consultations and treatment planning',
    color: 'from-purple-400 to-pink-400',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80',
    subServices: [
      {
        id: 'virtual-consultation',
        name: 'Virtual Consultations',
        description: 'Online skin assessment and treatment planning from the comfort of your home',
        duration: '1 hour',
        price: 'N$ 150',
        benefits: ['Convenient online access', 'Personalized skin analysis', 'Treatment recommendations']
      },
      {
        id: 'general-consultation',
        name: 'General Consultation',
        description: 'In-person comprehensive skin evaluation and customized treatment plan',
        duration: '1 hour',
        price: 'N$ 300',
        benefits: ['Face-to-face assessment', 'Detailed skin analysis', 'Personalized treatment plan']
      },
      {
        id: 'follow-up',
        name: 'Follow-up Assessment',
        description: 'Progress evaluation and treatment adjustment',
        duration: '1 hour',
        price: 'N$ 200',
        benefits: ['Progress tracking', 'Treatment optimization', 'Ongoing support']
      }
    ]
  },
  {
    id: 'advanced-treatments',
    name: 'Advanced Treatments',
    icon: 'Sparkles',
    description: 'Premium facial treatments for transformative results',
    color: 'from-pink-400 to-rose-500',
    image: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=800&q=80',
    subServices: [
      {
        id: 'back-facial',
        name: 'Back Facial',
        description: 'Deep cleansing and rejuvenation treatment for back acne and scarring',
        duration: '1 hour',
        price: 'N$ 460',
        benefits: ['Clears back acne', 'Reduces scarring', 'Smooths skin texture']
      },
      {
        id: 'firming-peptide',
        name: 'Firming Peptide Facial',
        description: 'Advanced anti-aging treatment with powerful peptides for skin tightening',
        duration: '1 hour',
        price: 'N$ 1,200',
        benefits: ['Firms sagging skin', 'Reduces fine lines', 'Boosts collagen production']
      },
      {
        id: 'acne-rescue',
        name: 'Acne Rescue',
        description: 'Intensive treatment for active acne breakouts',
        duration: '1 hour',
        price: 'N$ 690',
        benefits: ['Clears active acne', 'Prevents future breakouts', 'Calms inflammation']
      },
      {
        id: 'circadian-enzyme',
        name: 'Circadian Enzyme Facial',
        description: 'Revolutionary treatment that works with your skin\'s natural rhythms',
        duration: '1 hour',
        price: 'N$ 750',
        benefits: ['Optimizes skin function', 'Enhances natural repair', 'Improves radiance']
      },
      {
        id: 'anti-aging',
        name: 'Anti-Aging Facial',
        description: 'Comprehensive treatment targeting multiple signs of aging',
        duration: '1 hour',
        price: 'N$ 820',
        benefits: ['Reduces wrinkles', 'Improves elasticity', 'Restores youthful glow']
      },
      {
        id: 'swich-treatment',
        name: 'SWiCH Treatment',
        description: 'DNA repair treatment for cellular rejuvenation',
        duration: '1 hour',
        price: 'N$ 900',
        benefits: ['DNA repair', 'Cellular regeneration', 'Anti-aging benefits']
      },
      {
        id: 'dual-acne-hyperpigmentation',
        name: 'Dual Acne + Hyperpigmentation Facial',
        description: 'Targets both acne and dark spots simultaneously',
        duration: '1 hour',
        price: 'N$ 890',
        benefits: ['Clears acne', 'Fades dark spots', 'Evens skin tone']
      },
      {
        id: 'dermaplaning',
        name: 'Dermaplaning Facial',
        description: 'Exfoliation treatment removing dead skin and peach fuzz',
        duration: '1 hour',
        price: 'N$ 620',
        benefits: ['Instant smoothness', 'Enhanced product absorption', 'Radiant complexion']
      },
      {
        id: 'triple-brightening',
        name: 'Triple Brightening Facial',
        description: 'Intensive treatment for stubborn pigmentation and dark spots',
        duration: '1 hour',
        price: 'N$ 800',
        benefits: ['Brightens complexion', 'Fades dark spots', 'Evens skin tone']
      },
      {
        id: 'hyperpigmentation-polish',
        name: 'Hyperpigmentation Polish Off',
        description: 'Specialized treatment for melasma and sun damage',
        duration: '1 hour',
        price: 'N$ 790',
        benefits: ['Targets melasma', 'Reduces sun damage', 'Brightens skin']
      },
      {
        id: 'c2o2-treatment',
        name: 'C2O2 Treatment (Severe Acne)',
        description: 'Advanced oxygen therapy for severe acne cases',
        duration: '1 hour',
        price: 'N$ 860',
        benefits: ['Treats severe acne', 'Oxygenates skin', 'Accelerates healing']
      },
      {
        id: 'oxygen-cocoa',
        name: 'Oxygen Rx & Cocoa Facial',
        description: 'Antioxidant-rich treatment combining oxygen therapy with cocoa',
        duration: '1 hour',
        price: 'N$ 890',
        benefits: ['Antioxidant protection', 'Deep hydration', 'Anti-aging benefits']
      }
    ]
  },
  {
    id: 'customized-facials',
    name: 'Customized Facials',
    icon: 'Heart',
    description: 'Personalized treatments tailored to your unique skin needs',
    color: 'from-rose-400 to-pink-500',
    image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80',
    subServices: [
      {
        id: 'acne-relief',
        name: 'Acne Relief and Extractions',
        description: 'Deep cleansing with professional extractions for acne-prone skin',
        duration: '1 hour',
        price: 'N$ 700',
        benefits: ['Professional extractions', 'Deep pore cleansing', 'Prevents scarring']
      },
      {
        id: 'express-glow',
        name: 'Express Glow Facial',
        description: 'Quick treatment for instant radiance before special events',
        duration: '1 hour',
        price: 'N$ 700',
        benefits: ['Instant glow', 'Perfect for events', 'No downtime']
      },
      {
        id: 'gentlemen-glow',
        name: 'Gentlemen Glow Facial',
        description: 'Customized facial designed specifically for men\'s skin',
        duration: '1 hour',
        price: 'N$ 700',
        benefits: ['Male-specific treatment', 'Reduces razor burn', 'Deep cleansing']
      },
      {
        id: 'calming-facial',
        name: 'Calming Facial',
        description: 'Soothing treatment for sensitive and reactive skin',
        duration: '1 hour',
        price: 'N$ 700',
        benefits: ['Reduces redness', 'Calms irritation', 'Strengthens skin barrier']
      },
      {
        id: 'dream-facial',
        name: 'The Dream Facial',
        description: 'Ultimate relaxation facial with luxurious ingredients',
        duration: '1 hour',
        price: 'N$ 700',
        benefits: ['Deep relaxation', 'Luxury ingredients', 'Complete rejuvenation']
      }
    ]
  },
  {
    id: 'chemical-peels',
    name: 'Circadia Chemical Peels',
    icon: 'Droplets',
    description: 'Medical-grade peels for skin renewal and transformation',
    color: 'from-blue-400 to-purple-500',
    image: 'https://images.unsplash.com/photo-1611080541599-8c6dbde6ed28?w=800&q=80',
    subServices: [
      {
        id: 'lactic-30',
        name: 'Lactic Acid Peel 30%',
        description: 'Gentle exfoliation for sensitive skin types',
        duration: '1 hour',
        price: 'N$ 700',
        benefits: ['Gentle exfoliation', 'Hydrates skin', 'Suitable for sensitive skin']
      },
      {
        id: 'lactic-35',
        name: 'Lactic Acid Peel 35%',
        description: 'Moderate strength peel for enhanced results',
        duration: '1 hour',
        price: 'N$ 780',
        benefits: ['Deeper exfoliation', 'Improves texture', 'Brightens complexion']
      },
      {
        id: 'alpha-beta-30-10',
        name: 'Alpha/Beta 30/10',
        description: 'Combination peel for acne and texture improvement',
        duration: '1 hour',
        price: 'N$ 700',
        benefits: ['Treats acne', 'Improves texture', 'Unclogs pores']
      },
      {
        id: 'alpha-beta-40-15',
        name: 'Alpha/Beta 40/15',
        description: 'Stronger combination peel for stubborn concerns',
        duration: '1 hour',
        price: 'N$ 780',
        benefits: ['Deep exfoliation', 'Acne treatment', 'Texture refinement']
      },
      {
        id: 'dermafrost-12',
        name: 'DermaFrost (Salicylic Acid 12.5%)',
        description: 'Targeted treatment for acne and oily skin',
        duration: '1 hour',
        price: 'N$ 700',
        benefits: ['Oil control', 'Acne treatment', 'Pore refinement']
      },
      {
        id: 'dermafrost-25',
        name: 'DermaFrost (Salicylic Acid 25%)',
        description: 'Intensive treatment for severe acne',
        duration: '1 hour',
        price: 'N$ 780',
        benefits: ['Severe acne treatment', 'Deep cleansing', 'Prevents breakouts']
      },
      {
        id: 'mandeliclear',
        name: 'Mandeliclear + Vitamin A Accelerator Peel',
        description: 'Advanced peel for pigmentation and anti-aging',
        duration: '1 hour',
        price: 'N$ 890',
        benefits: ['Fades pigmentation', 'Anti-aging', 'Skin renewal']
      },
      {
        id: 'tca-peels',
        name: 'TCA Peels',
        description: 'Professional-grade peel for dramatic results',
        duration: '1 hour',
        price: 'N$ 890',
        benefits: ['Dramatic results', 'Treats sun damage', 'Reduces wrinkles']
      }
    ]
  },
  {
    id: 'iv-drips',
    name: 'Vitamin IV Drips',
    icon: 'Zap',
    description: 'Intravenous vitamin therapy for health and beauty from within',
    color: 'from-green-400 to-blue-500',
    image: 'https://images.unsplash.com/photo-1609611182248-2d9c77e5fe0f?w=800&q=80',
    subServices: [
      {
        id: 'hangover-detox',
        name: 'Hangover Recovery Detox IV',
        description: 'Quick recovery from hangovers with hydration and vitamins',
        duration: '1 hour',
        price: 'N$ 950',
        benefits: ['Rapid hydration', 'Nausea relief', 'Energy boost']
      },
      {
        id: 'immune-booster',
        name: 'Immune Booster IV',
        description: 'Strengthen your immune system with vital nutrients',
        duration: '1 hour',
        price: 'N$ 950',
        benefits: ['Boosts immunity', 'Prevents illness', 'Increases energy']
      },
      {
        id: 'glutathione',
        name: 'L-Glutathione (lightener) IV',
        description: 'Master antioxidant for skin brightening and detox',
        duration: '1 hour',
        price: 'N$ 950',
        benefits: ['Skin brightening', 'Detoxification', 'Anti-aging']
      },
      {
        id: 'myers-cocktail',
        name: 'Myer\'s Cocktail',
        description: 'Classic vitamin blend for overall wellness',
        duration: '1 hour',
        price: 'N$ 950',
        benefits: ['Overall wellness', 'Energy boost', 'Stress relief']
      },
      {
        id: 'skin-brightening',
        name: 'Skin Brightening IV',
        description: 'Targeted nutrients for radiant, glowing skin',
        duration: '1 hour',
        price: 'N$ 950',
        benefits: ['Glowing skin', 'Even complexion', 'Hydration boost']
      },
      {
        id: 'weight-loss',
        name: 'Weight Loss IV',
        description: 'Metabolism-boosting nutrients for weight management',
        duration: '1 hour',
        price: 'N$ 950',
        benefits: ['Boosts metabolism', 'Fat burning', 'Energy increase']
      }
    ]
  },
  {
    id: 'prp-treatments',
    name: 'PRP Treatments',
    icon: 'Activity',
    description: 'Platelet-rich plasma therapy for skin and hair rejuvenation',
    color: 'from-amber-400 to-orange-500',
    image: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&q=80',
    subServices: [
      {
        id: 'prp-dark-circles',
        name: 'PRP: Dark Circle (Eyes)',
        description: 'Targeted treatment for under-eye rejuvenation',
        duration: '1 hour',
        price: 'N$ 2,500',
        benefits: ['Reduces dark circles', 'Tightens skin', 'Natural results']
      },
      {
        id: 'prp-body',
        name: 'PRP Body (Per area)',
        description: 'Body rejuvenation for targeted areas',
        duration: '1 hour',
        price: 'N$ 900',
        benefits: ['Skin tightening', 'Improves texture', 'Reduces cellulite']
      },
      {
        id: 'prp-o-shot',
        name: 'PRP: O-SHOT',
        description: 'Intimate wellness treatment',
        duration: '1 hour',
        price: 'N$ 1,000',
        benefits: ['Enhanced sensitivity', 'Improved wellness', 'Natural treatment']
      },
      {
        id: 'prp-full-face',
        name: 'PRP: FULL FACE (Skin Rejuvenation)',
        description: 'Complete facial rejuvenation with your own plasma',
        duration: '1 hour',
        price: 'N$ 3,000',
        benefits: ['Total rejuvenation', 'Natural collagen boost', 'Long-lasting results']
      },
      {
        id: 'prp-acne-scars',
        name: 'PRP: Acne Scars',
        description: 'Targeted treatment for acne scar improvement',
        duration: '1 hour',
        price: 'N$ 1,250',
        benefits: ['Reduces scarring', 'Improves texture', 'Stimulates healing']
      },
      {
        id: 'prp-vampire',
        name: 'PRP: Vampire Facial',
        description: 'Famous treatment combining microneedling with PRP',
        duration: '1 hour',
        price: 'N$ 985',
        benefits: ['Celebrity treatment', 'Dramatic results', 'Natural glow']
      },
      {
        id: 'prp-full-scalp',
        name: 'PRP: Full Scalp',
        description: 'Complete scalp treatment for hair restoration',
        duration: '1 hour',
        price: 'N$ 1,000',
        benefits: ['Stimulates hair growth', 'Thicker hair', 'Prevents hair loss']
      },
      {
        id: 'prp-hairline',
        name: 'PRP: Hairline',
        description: 'Targeted treatment for receding hairline',
        duration: '1 hour',
        price: 'N$ 680',
        benefits: ['Restores hairline', 'Natural results', 'Non-surgical']
      },
      {
        id: 'prp-partial-scalp',
        name: 'PRP: Partial Scalp',
        description: 'Targeted treatment for specific areas of hair loss',
        duration: '1 hour',
        price: 'N$ 780',
        benefits: ['Targeted treatment', 'Cost-effective', 'Natural growth']
      }
    ]
  },
  {
    id: 'fat-reduction',
    name: 'Fat Reduction',
    icon: 'TrendingDown',
    description: 'Non-surgical lipolytic injections for targeted fat reduction',
    color: 'from-red-400 to-pink-500',
    image: 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=800&q=80',
    subServices: [
      {
        id: 'fat-arms',
        name: 'Arms',
        description: 'Reduce arm fat and achieve toned appearance',
        duration: '1 hour',
        price: 'N$ 350 per ML',
        benefits: ['Reduces arm fat', 'Improves definition', 'No surgery needed']
      },
      {
        id: 'fat-buffalo',
        name: 'Buffalo Lump',
        description: 'Treatment for upper back fat deposits',
        duration: '1 hour',
        price: 'N$ 350 per ML',
        benefits: ['Reduces back fat', 'Improves posture', 'Boosts confidence']
      },
      {
        id: 'fat-double-chin',
        name: 'Double Chin',
        description: 'Eliminate stubborn chin fat for a defined jawline',
        duration: '1 hour',
        price: 'N$ 350 per ML',
        benefits: ['Defines jawline', 'Eliminates double chin', 'Youthful appearance']
      },
      {
        id: 'fat-love-handles',
        name: 'Love Handles',
        description: 'Target stubborn waist fat deposits',
        duration: '1 hour',
        price: 'N$ 350 per ML',
        benefits: ['Slims waistline', 'Improves silhouette', 'Permanent results']
      },
      {
        id: 'fat-thighs',
        name: 'Thighs',
        description: 'Reduce thigh fat for slimmer legs',
        duration: '1 hour',
        price: 'N$ 350 per ML',
        benefits: ['Slimmer thighs', 'Reduces cellulite', 'Improved shape']
      },
      {
        id: 'fat-tummy-love',
        name: 'Tummy & Lovehandles',
        description: 'Comprehensive midsection contouring',
        duration: '1 hour',
        price: 'N$ 350 per ML',
        benefits: ['Complete contouring', 'Dramatic results', 'Confidence boost']
      },
      {
        id: 'fat-tummy',
        name: 'Tummy',
        description: 'Flatten stubborn belly fat',
        duration: '1 hour',
        price: 'N$ 350 per ML',
        benefits: ['Flatter stomach', 'Improved core', 'Clothes fit better']
      }
    ]
  },
  {
    id: 'microneedling',
    name: 'Microneedling',
    icon: 'Sparkles',
    description: 'Collagen induction therapy for skin rejuvenation',
    color: 'from-purple-400 to-indigo-500',
    image: 'https://images.unsplash.com/photo-1612627234464-9a7f0a90d08f?w=800&q=80',
    subServices: [
      {
        id: 'micro-peel-mask',
        name: 'Microneedling (Peel + Mask + LED)',
        description: 'Complete treatment combining microneedling with peel and LED therapy',
        duration: '1 hour',
        price: 'N$ 1,000',
        benefits: ['Maximum results', 'Multiple modalities', 'Complete rejuvenation']
      },
      {
        id: 'micro-dermaplaning',
        name: 'Microneedling (Dermaplaning + Mask + LED)',
        description: 'Combines microneedling with dermaplaning for smooth skin',
        duration: '1 hour',
        price: 'N$ 950',
        benefits: ['Ultra-smooth skin', 'Enhanced penetration', 'Glowing results']
      },
      {
        id: 'micro-enzyme',
        name: 'Microneedling (Enzyme + Mask + LED)',
        description: 'Gentle combination for sensitive skin types',
        duration: '1 hour',
        price: 'N$ 800',
        benefits: ['Gentle treatment', 'Suitable for sensitive skin', 'Natural glow']
      }
    ]
  },
  {
    id: 'hydra-facials',
    name: 'Hydra-Facials',
    icon: 'Droplet',
    description: 'Advanced hydradermabrasion for instant results',
    color: 'from-cyan-400 to-blue-500',
    image: 'https://images.unsplash.com/photo-1508280756091-9bdd7ef1f463?w=800&q=80',
    subServices: [
      {
        id: 'signature-hydra',
        name: 'Signature Hydra-Facial',
        description: 'Classic hydrafacial treatment for all skin types',
        duration: '1 hour',
        price: 'N$ 950',
        benefits: ['Deep cleansing', 'Instant hydration', 'Glowing skin']
      },
      {
        id: 'wet-diamond',
        name: 'Wet Diamond Hydra-Facial',
        description: 'Diamond-tip technology for enhanced exfoliation',
        duration: '1 hour',
        price: 'N$ 1,000',
        benefits: ['Diamond exfoliation', 'Superior results', 'Luxury experience']
      },
      {
        id: 'deluxe-hydra',
        name: 'Deluxe Hydra-Facial',
        description: 'Ultimate hydrafacial with boosters and LED therapy',
        duration: '1 hour',
        price: 'N$ 1,200',
        benefits: ['Complete treatment', 'Customized boosters', 'LED therapy included']
      }
    ]
  },
  {
    id: 'acne-bootcamp',
    name: 'Acne Bootcamp - 8 Week Program',
    icon: 'Shield',
    description: 'Comprehensive 8-week acne treatment program',
    color: 'from-teal-400 to-green-500',
    image: 'https://images.unsplash.com/photo-1619451334792-150fd785ee74?w=800&q=80',
    subServices: [
      {
        id: 'bootcamp-full',
        name: 'Complete 8-Week Acne Bootcamp',
        description: 'Intensive program including all weekly treatments',
        duration: '8 weeks',
        price: 'N$ 5,000',
        benefits: ['Complete transformation', 'Weekly treatments', 'Guaranteed results']
      },
      {
        id: 'week1',
        name: 'Week 1: Skin Analysis & Deep Cleansing',
        description: 'Initial assessment and treatment planning',
        duration: '2 hours',
        price: 'Included',
        benefits: ['Detailed analysis', 'Custom plan', 'Deep cleansing']
      },
      {
        id: 'week2',
        name: 'Week 2: Acne Treatment & LED Therapy',
        description: 'Targeted acne treatment with blue light therapy',
        duration: '1 hour',
        price: 'Included',
        benefits: ['Active treatment', 'LED therapy', 'Bacteria elimination']
      },
      {
        id: 'week3',
        name: 'Week 3: First Chemical Peel',
        description: 'Professional peel to accelerate healing',
        duration: '1 hour',
        price: 'Included',
        benefits: ['Exfoliation', 'Unclog pores', 'Skin renewal']
      },
      {
        id: 'week4',
        name: 'Week 4: Barrier Repair & Hydration',
        description: 'Restore skin barrier and balance',
        duration: '1 hour',
        price: 'Included',
        benefits: ['Barrier repair', 'Deep hydration', 'Calming treatment']
      },
      {
        id: 'week5',
        name: 'Week 5: Microneedling for Scars',
        description: 'Advanced treatment for acne scarring',
        duration: '1 hour',
        price: 'Included',
        benefits: ['Scar reduction', 'Texture improvement', 'Collagen boost']
      },
      {
        id: 'week6',
        name: 'Week 6: Pigmentation Peel',
        description: 'Target post-acne marks and discoloration',
        duration: '1 hour',
        price: 'Included',
        benefits: ['Fade dark spots', 'Even skin tone', 'Brighten complexion']
      },
      {
        id: 'week7',
        name: 'Week 7: Spot Treatment & Exfoliation',
        description: 'Final targeted treatments for remaining concerns',
        duration: '1 hour',
        price: 'Included',
        benefits: ['Spot treatment', 'Final refinement', 'Polish skin']
      },
      {
        id: 'week8',
        name: 'Week 8: Maintenance Plan',
        description: 'Final assessment and future care planning',
        duration: '1 hour',
        price: 'Included',
        benefits: ['Final results', 'Maintenance plan', 'Product guidance']
      }
    ]
  }
];