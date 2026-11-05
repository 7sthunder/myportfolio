// Projects shown in "My Featured Works". Text and screenshots come from the portfolio at
// D:\My ShYts\myself uhh\portfolio (src/data.ts, public/). Screenshots live in public/works/.
export const works = [
  {
    title: 'CrossFit OS',
    label: 'Company project',
    blurb:
      'Multi-tenant SaaS for gyms with member management, billing, attendance, AI trainer and community features.',
    tags: ['Astro', 'React', 'tRPC', 'PostgreSQL'],
    shot: 'works/crossfitos-landing.png',
    shotAlt: 'CrossFitOS landing page with the Website, Store and Community hero headline',
    live: 'https://crossfitos.com',
  },
  {
    title: 'Transport Management System',
    label: 'Company project',
    blurb:
      'A full-stack platform for UAE logistics operations. Manage transport requests, trips, vehicles, expenses, invoicing, driver assignments and more.',
    tags: ['React 19', 'TypeScript', 'tRPC', 'Drizzle', 'PostgreSQL', 'Cloudflare Workers', 'Tailwind CSS', 'Leaflet'],
    shot: 'works/tms-dashboard.png',
    shotAlt:
      'Transport Management System dashboard showing revenue against expenses, active drivers and available vehicles',
    live: 'https://tms.ascodelabs.com',
  },
  {
    title: 'A S Unique Group',
    label: 'Company project',
    blurb:
      'Recruitment operations platform for overseas hiring with candidate management, document workflows and team communication.',
    tags: ['React 19', 'tRPC', 'Cloudflare R2', 'PostgreSQL'],
    shot: 'works/asunique-dashboard.png',
    shotAlt:
      'A S Unique Group recruitment dashboard showing deployed candidates, total candidates and on-going requirements',
    live: 'https://asuniquegroup.com/app',
  },
  {
    title: 'STAMP',
    label: 'Company project',
    blurb:
      'Production management system for a print shop covering orders, quotations, production, packing, delivery and payments.',
    tags: ['React', 'tRPC', 'Cloudflare D1', 'Drizzle'],
    shot: 'works/stamp-dashboard.png',
    shotAlt: 'STAMP production dashboard showing job orders by status and orders over time',
    live: 'http://stamp-crm.ascodelabs.com/',
  },
  {
    title: 'MediTrack AI',
    label: 'Independent project',
    blurb:
      'A planned medication tracking platform with reminders, adherence analytics and supportive AI insights.',
    tags: ['Next.js', 'tRPC', 'PostgreSQL'],
    status: 'In development',
    shot: 'works/meditrack-ai.png',
    shotAlt: 'MediTrackAI landing page with the One secure vault headline and app preview',
  },
  {
    title: 'DocuVerify',
    label: 'Independent project',
    blurb:
      'Analyses PDFs and images for potential tampering, produces a suspicion score, and highlights suspicious regions with evidence-backed explanations.',
    tags: ['Python', 'OpenCV', 'FastAPI', 'React'],
    shot: 'works/docuverify-dashboard.png',
    shotAlt:
      'DocuVerify dashboard with the Verify Documents hero and an analysis summary showing a 62 out of 100 score',
  },
];
