import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: [
        '/',
        '/demo',
        '/privacy',
        '/personal-data-consent',
        '/terms',
        '/offer',
        '/marketing-consent',
        '/security',
        '/cookie-policy',
      ],
      disallow: [
        '/admin/',
        '/companies/',
        '/dashboard/',
        '/defects/',
        '/inspections/',
        '/login/',
        '/owner-setup/',
        '/profile/',
        '/saas-admin/',
        '/settings/',
        '/users/',
        '/vehicles/',
      ],
    },
    sitemap: 'https://auditavto.ru/sitemap.xml',
    host: 'https://auditavto.ru',
  }
}
