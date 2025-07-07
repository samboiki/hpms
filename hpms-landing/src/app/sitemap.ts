import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.newcharmdentalpractice.com';
  
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${baseUrl}/teeth-whitening`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    // Add more service pages as you create them:
    // { url: `${baseUrl}/dental-implants`, ... },
    // { url: `${baseUrl}/orthodontics`, ... },
    // { url: `${baseUrl}/emergency-dentist`, ... },
  ];
}