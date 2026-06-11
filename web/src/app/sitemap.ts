import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return [
    {
      url: 'https://auditavto.ru',
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://auditavto.ru/demo',
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: 'https://auditavto.ru/security',
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: 'https://auditavto.ru/privacy',
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: 'https://auditavto.ru/terms',
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: 'https://auditavto.ru/cookie-policy',
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
