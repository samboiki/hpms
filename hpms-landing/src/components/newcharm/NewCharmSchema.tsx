import React from 'react';
import Script from 'next/script';

const NewCharmSchema: React.FC = () => {
  const schemaData = {
    "@context": "https://schema.org",
    "@type": ["Dentist", "LocalBusiness", "MedicalBusiness"],
    "name": "NewCharm Dental Practice",
    "image": "https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/documents/practice-logos/ffed1160-00ec-4c4f-8810-913a24348d90/logo_1751811291998.png",
    "logo": "https://jjxlfunlbyayxwvlpgwt.supabase.co/storage/v1/object/public/documents/practice-logos/ffed1160-00ec-4c4f-8810-913a24348d90/logo_1751811291998.png",
    "@id": "https://www.newcharmdentalpractice.com",
    "url": "https://www.newcharmdentalpractice.com",
    "telephone": "+264612345678",
    "priceRange": "$$",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "123 Independence Avenue",
      "addressLocality": "Windhoek",
      "addressRegion": "Khomas",
      "postalCode": "10001",
      "addressCountry": "NA"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -22.5609,
      "longitude": 17.0658
    },
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "opens": "08:00",
        "closes": "18:00"
      },
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": "Saturday",
        "opens": "09:00",
        "closes": "14:00"
      }
    ],
    "sameAs": [
      "https://www.facebook.com/profile.php?id=100095192419707",
      "https://www.instagram.com/newcharm_dentalpractice/"
    ],
    "medicalSpecialty": [
      "GeneralDentistry",
      "CosmeticDentistry",
      "Orthodontics",
      "OralSurgery",
      "Endodontics",
      "Periodontics",
      "PediatricDentistry"
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "150"
    },
    "review": [
      {
        "@type": "Review",
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "5"
        },
        "author": {
          "@type": "Person",
          "name": "Helena Shikongo"
        },
        "reviewBody": "Dr. Amalwa and her team at NewCharm Dental are absolutely exceptional! They transformed my smile with veneers, and I couldn't be happier."
      }
    ]
  };

  return (
    <Script
      id="newcharm-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      strategy="afterInteractive"
    />
  );
};

export default NewCharmSchema;