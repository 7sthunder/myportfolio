// Works shown in the "Some selected works" section, one at a time. Each one is drawn by the
// particles as a silver illustration (art = key in components/WorkArt.jsx). Each one also has a
// case study at /projects/<slug> (content in data/caseStudies.js).
export const works = [
  {
    slug: 'crossfit-os',
    title: 'CrossFit OS',
    info: 'Company project',
    summary: 'Website, store and community platform for CrossFit gyms.',
    tags: ['Astro', 'React', 'tRPC', 'PostgreSQL'],
    art: 'dumbbell',
    live: 'https://crossfitos.com',
  },
  {
    slug: 'transport-management-system',
    title: 'Transport Management System',
    info: 'Company project',
    summary: 'Trips, drivers, vehicles, revenue and expenses for a transport fleet in one dashboard.',
    tags: ['React 19', 'TypeScript', 'tRPC', 'Drizzle', 'PostgreSQL', 'Cloudflare Workers', 'Tailwind CSS', 'Leaflet'],
    art: 'truck',
    live: 'https://tms.ascodelabs.com',
  },
  {
    slug: 'a-s-unique-group',
    title: 'A S Unique Group',
    info: 'Company project',
    summary: 'Recruitment platform tracking candidates, deployments and open requirements.',
    tags: ['React 19', 'tRPC', 'Cloudflare R2', 'PostgreSQL'],
    art: 'interview',
    live: 'https://asuniquegroup.com/app',
  },
  {
    slug: 'stamp',
    title: 'STAMP',
    info: 'Company project',
    summary: 'Production CRM that follows every job order from intake to delivery.',
    tags: ['React', 'tRPC', 'Cloudflare D1', 'Drizzle'],
    art: 'stamp',
    live: 'http://stamp-crm.ascodelabs.com/',
  },
  {
    slug: 'meditrack-ai',
    title: 'MediTrack AI',
    info: 'Independent',
    summary: 'One secure vault for medical records and medication tracking.',
    tags: ['Next.js', 'tRPC', 'PostgreSQL'],
    art: 'pills',
  },
  {
    slug: 'docuverify',
    title: 'DocuVerify',
    info: 'Independent',
    summary: 'Forensic document analysis that scores authenticity and highlights suspicious regions.',
    tags: ['Python', 'OpenCV', 'FastAPI', 'React'],
    art: 'document',
  },
];
