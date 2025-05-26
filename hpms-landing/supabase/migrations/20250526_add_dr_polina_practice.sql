-- Add MedCenter Aesthetics practice
INSERT INTO practices (
  slug,
  name,
  domain,
  primary_color,
  secondary_color,
  logo_url,
  hero_image,
  hero_title,
  hero_subtitle,
  services,
  about_text,
  contact_email,
  contact_phone,
  address,
  city,
  country,
  postal_code,
  business_hours,
  social_links,
  features,
  certifications,
  testimonials
) VALUES (
  'medcenter-aesthetics',
  'MedCenter Aesthetics',
  'medcenter.vercel.app',
  '#E91E63', -- Elegant pink/rose color for aesthetics
  '#9C27B0', -- Purple as secondary
  '/images/dr-polina-logo.png',
  '/images/dr-polina-hero.jpg',
  'Reveal Your Natural Beauty',
  'Premier medical aesthetic center specializing in personalized skin, hair, and body treatments',
  jsonb_build_array(
    jsonb_build_object(
      'id', 'skin-analysis',
      'name', 'Advanced Skin Analysis',
      'description', 'Comprehensive skin evaluation using cutting-edge diagnostic technology',
      'icon', 'Microscope',
      'duration', '45 minutes',
      'price', 'N$ 350'
    ),
    jsonb_build_object(
      'id', 'acne-treatment',
      'name', 'Acne Treatment Program',
      'description', 'Medical-grade solutions for acne and acne scarring',
      'icon', 'Sparkles',
      'duration', '60 minutes',
      'price', 'From N$ 800'
    ),
    jsonb_build_object(
      'id', 'chemical-peels',
      'name', 'Chemical Peels',
      'description', 'Professional peels for skin rejuvenation and pigmentation',
      'icon', 'Droplets',
      'duration', '45 minutes',
      'price', 'From N$ 1,200'
    ),
    jsonb_build_object(
      'id', 'microneedling',
      'name', 'Microneedling Therapy',
      'description', 'Collagen induction therapy for skin texture and scarring',
      'icon', 'Activity',
      'duration', '90 minutes',
      'price', 'From N$ 1,500'
    ),
    jsonb_build_object(
      'id', 'botox',
      'name', 'Botulinum Toxin',
      'description', 'Anti-wrinkle injections for a youthful appearance',
      'icon', 'Syringe',
      'duration', '30 minutes',
      'price', 'From N$ 2,500'
    ),
    jsonb_build_object(
      'id', 'dermal-fillers',
      'name', 'Dermal Fillers',
      'description', 'Volume restoration and facial contouring',
      'icon', 'Heart',
      'duration', '45 minutes',
      'price', 'From N$ 3,500'
    ),
    jsonb_build_object(
      'id', 'hair-restoration',
      'name', 'Hair Restoration',
      'description', 'Advanced treatments for hair loss and thinning',
      'icon', 'Scissors',
      'duration', '60 minutes',
      'price', 'From N$ 2,000'
    ),
    jsonb_build_object(
      'id', 'weight-loss',
      'name', 'Weight Loss Programs',
      'description', 'Medical weight management with personalized plans',
      'icon', 'TrendingDown',
      'duration', 'Consultation',
      'price', 'Custom pricing'
    ),
    jsonb_build_object(
      'id', 'iv-therapy',
      'name', 'Vitamin IV Therapy',
      'description', 'Intravenous nutrient therapy for wellness and beauty',
      'icon', 'Zap',
      'duration', '45 minutes',
      'price', 'From N$ 800'
    ),
    jsonb_build_object(
      'id', 'thread-lifting',
      'name', 'PDO Thread Lifting',
      'description', 'Non-surgical face lifting and skin tightening',
      'icon', 'ArrowUp',
      'duration', '90 minutes',
      'price', 'From N$ 4,000'
    ),
    jsonb_build_object(
      'id', 'mesotherapy',
      'name', 'Mesotherapy',
      'description', 'Targeted micro-injections for skin rejuvenation',
      'icon', 'Target',
      'duration', '60 minutes',
      'price', 'From N$ 1,800'
    ),
    jsonb_build_object(
      'id', 'biorevitalization',
      'name', 'Biorevitalization',
      'description', 'Deep hydration and skin quality improvement',
      'icon', 'Droplet',
      'duration', '45 minutes',
      'price', 'From N$ 2,200'
    )
  ),
  'MedCenter Aesthetics is Namibia''s premier medical aesthetic center, providing medical-grade treatments and advanced aesthetic technologies. We are committed to delivering high-quality, results-driven treatments using cutting-edge skincare products and equipment. Our personalized approach ensures each patient receives treatments tailored to their unique needs and beauty goals.',
  'info@medcenter.com',
  '+264 81 435 8844',
  'Feld Street 4, Ausspannplatz',
  'Windhoek',
  'Namibia',
  '10001',
  jsonb_build_object(
    'monday', jsonb_build_object('open', '09:00', 'close', '18:00'),
    'tuesday', jsonb_build_object('open', '09:00', 'close', '18:00'),
    'wednesday', jsonb_build_object('open', '09:00', 'close', '18:00'),
    'thursday', jsonb_build_object('open', '09:00', 'close', '18:00'),
    'friday', jsonb_build_object('open', '09:00', 'close', '18:00'),
    'saturday', jsonb_build_object('open', '09:00', 'close', '14:00'),
    'sunday', jsonb_build_object('closed', true)
  ),
  jsonb_build_object(
    'facebook', 'https://facebook.com/medcenter',
    'instagram', 'https://instagram.com/medcenter',
    'whatsapp', '+26481435844'
  ),
  jsonb_build_array(
    'Advanced Skin Analysis Technology',
    'Medical-Grade Products',
    'Personalized Treatment Plans',
    'Experienced Medical Team',
    'Two Convenient Locations',
    'Results-Driven Approach'
  ),
  jsonb_build_array(
    'Medical Board Certified',
    'International Aesthetic Training',
    'Advanced Cosmetology Certification',
    'Ukraine Medical Degree'
  ),
  jsonb_build_array(
    jsonb_build_object(
      'author', 'Maria Shikongo',
      'rating', 5,
      'text', 'MedCenter transformed my skin! After struggling with acne for years, their treatment plan gave me the clear, glowing skin I''ve always wanted.',
      'date', '2024-11-15'
    ),
    jsonb_build_object(
      'author', 'John Namibia',
      'rating', 5,
      'text', 'The professionalism and expertise at this clinic is unmatched. My botox results look so natural, and the staff made me feel comfortable throughout.',
      'date', '2024-10-22'
    ),
    jsonb_build_object(
      'author', 'Sandra Iipinge',
      'rating', 5,
      'text', 'I''ve tried many aesthetic clinics, but MedCenter Aesthetics stands out. The personalized approach and attention to detail is exceptional.',
      'date', '2024-09-30'
    )
  )
)
ON CONFLICT (slug) 
DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color,
  hero_title = EXCLUDED.hero_title,
  hero_subtitle = EXCLUDED.hero_subtitle,
  services = EXCLUDED.services,
  about_text = EXCLUDED.about_text,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  address = EXCLUDED.address,
  features = EXCLUDED.features,
  certifications = EXCLUDED.certifications,
  testimonials = EXCLUDED.testimonials,
  updated_at = NOW();

-- Also add the second location as metadata
UPDATE practices 
SET metadata = jsonb_build_object(
  'locations', jsonb_build_array(
    jsonb_build_object(
      'name', 'Windhoek Clinic',
      'address', 'Feld Street 4, Ausspannplatz',
      'city', 'Windhoek',
      'description', 'Close to Maerua Mall',
      'phone', '+264 81 435 8844'
    ),
    jsonb_build_object(
      'name', 'Oshikango Clinic',
      'address', 'Freedom Square, Shop B3-first floor',
      'city', 'Oshikango',
      'description', 'Opposite Standard Bank',
      'phone', '+264 81 435 8844'
    )
  ),
  'specializations', jsonb_build_array(
    'Acne Treatment',
    'Hyperpigmentation',
    'Anti-Aging',
    'Sun Damage Repair',
    'Rosacea Treatment',
    'Hair Restoration',
    'Weight Loss Management'
  ),
  'founder', jsonb_build_object(
    'name', 'Dr. Teopolina N. Tileinge',
    'title', 'Medical Doctor & Aesthetic Specialist',
    'qualifications', jsonb_build_array(
      'Medical Degree - Ukraine',
      'Medical Aesthetics Certification',
      'Advanced Cosmetology Training',
      'Dermatology Specialization'
    )
  )
)
WHERE slug = 'medcenter-aesthetics';