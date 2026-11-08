// Case studies shown at /projects/<slug>. Keyed by the slug in works.js. Each entry:
//   lead:     the opening paragraph under the title
//   sections: [{ heading, paragraphs, list? }] read top to bottom
export const caseStudies = {
  'crossfit-os': {
    lead:
      'CrossFit OS is one platform for independent gyms. A gym gets a branded website, a storefront, member check-in and billing, and a member app with community and AI coaching, all managed from the same system.',
    sections: [
      {
        heading: 'The problem',
        paragraphs: [
          'Most small gyms run their digital life across several tools: a website builder, a payments app, a booking tool and a spreadsheet of members. Each one needs its own logins and its own updates, and none of them knows about the others.',
          'CrossFit OS was built as a single operating system for gym owners, mainly in India. The model is no upfront cost, with a revenue share on digital transactions.',
        ],
      },
      {
        heading: 'What it does',
        paragraphs: ['The platform covers the gym-facing side and the member-facing side:'],
        list: [
          'A landing-page builder for each gym, with a publish step and custom domains.',
          'A member app where people join their gym with a private code, so nobody has to search through every gym.',
          'Weekly training plans with warm-ups, trainer review and reusable templates.',
          'Class booking, daily WODs, and workout logging that still works offline and syncs when the connection returns.',
          'An AI coach chat that streams its replies. It is gated by member consent and a credit balance.',
          'A gym community with moderation and workout sharing.',
          'A print-on-demand store for gym merchandise.',
          'A desktop check-in kiosk that keeps running when the internet drops.',
        ],
      },
      {
        heading: 'Under the hood',
        paragraphs: [
          'The codebase is a pnpm and Turborepo monorepo. The web app is built with Astro 5 and React 19 and deployed to Cloudflare Workers. The member app is Expo and React Native, and the kiosk is an Electron app with a local SQLite database.',
          'All three clients share one tRPC API and one PostgreSQL database, accessed through Drizzle ORM. better-auth handles sign-in, and the marketing site runs as a separate Astro app on Cloudflare Workers.',
        ],
      },
      {
        heading: 'Decisions that mattered',
        paragraphs: [],
        list: [
          'The gym ID is never taken from the client. Every request is scoped on the server, so one gym cannot read another gym’s data.',
          'Offline writes go through an outbox with idempotent client IDs. A request that is retried after a dropped connection does not create a duplicate record.',
          'The AI coach uses a credit ledger with monthly and purchased balances. Reads skip locking when no balance update is due.',
          'Image moderation launched in audit mode rather than enforce mode, because the moderation API key had not been provisioned yet. Flagged images are recorded for review, but not blocked automatically.',
        ],
      },
    ],
  },

  'transport-management-system': {
    lead:
      'A single dashboard for a transport business. It tracks trips, drivers, vehicles and customers, and it turns the money side into invoices, statements, expenses and a profit view for each trip.',
    sections: [
      {
        heading: 'The problem',
        paragraphs: [
          'Fleet operations are spread across many places: trip schedules, driver and vehicle documents, customer invoices, supplier payments and the books. Expiry dates for licences and vehicle papers are easy to miss, and it is hard to see what a trip actually earned when costs and selling prices live in different places.',
          'The project was planned as a replacement for the Excel workbooks the business ran on, and it was built so that the important numbers come from one database instead of being copied between sheets.',
        ],
      },
      {
        heading: 'What it does',
        paragraphs: ['The application is organised around the day-to-day work of a fleet:'],
        list: [
          'Trips, shipments and transport requests. One shipment can have one bill of lading, several container trips and a single shipment invoice.',
          'Drivers, vehicles, trailers, vendors and customers, each with document uploads and expiry tracking.',
          'Trip, customer, shipment and container invoices, with PDF generation.',
          'Statements of account, receipts, cheque monitoring, and driver and supplier payments.',
          'Expenses with a chart of accounts and vouchers, plus profit and loss reports, including profit per trip.',
          'A live map built on GPS tracking data.',
          'Excel import dialogs for bringing existing records in.',
          'A separate dashboard for drivers.',
        ],
      },
      {
        heading: 'Money and permissions',
        paragraphs: [
          'Money is handled as two separate permissions: who can enter costs, and who can see selling prices. An operator can record what a trip cost without seeing what the customer is being charged. Admins, managers and finance users can see both sides.',
        ],
      },
      {
        heading: 'Under the hood',
        paragraphs: [
          'The frontend is React 19 with Vite, TanStack Router and TanStack Query, styled with Tailwind 4 and wired to the server through a tRPC client. The backend is a single Cloudflare Worker that serves the app, handles sign-in through better-auth, stores uploaded files in Cloudflare R2, and runs the tRPC API.',
          'The data lives in PostgreSQL, modelled with Drizzle across about sixty tables. Unit tests run on the Node test runner and end-to-end tests run on Playwright.',
        ],
      },
      {
        heading: 'Decisions and a fix worth noting',
        paragraphs: [],
        list: [
          'File storage moved from Supabase Storage to Cloudflare R2 to avoid egress fees. Uploads go through the Worker.',
          'Sign-in moved from Supabase Auth to better-auth. Passwords were not migrated, so users reset them once on their first login.',
          'Authorisation is being moved from database row rules into the tRPC layer, so the rules live in code that can be read and tested.',
          'Statement PDFs and PNGs came out at the wrong size. The root cause was that the image capture measured the width of its wrapper instead of the size of the sheet itself.',
        ],
      },
    ],
  },

  'a-s-unique-group': {
    lead:
      'A recruitment CRM for a manpower agency. It follows candidates from first selection through visa and deployment, tracks the requirements they are matched against, and handles the invoices and messages around each placement.',
    sections: [
      {
        heading: 'The problem',
        paragraphs: [
          'Recruitment drives usually arrive as folders of Excel sheets, PDFs and one document folder per candidate. Turning that into usable records by hand is slow, and the funnel from selection to deployment is hard to see at a glance.',
        ],
      },
      {
        heading: 'What it does',
        paragraphs: ['The platform handles the whole path from requirement to deployment:'],
        list: [
          'Requirements with positions, which can be shared with partner organisations through two-way connections.',
          'A candidate funnel: Total Selection, Visa Applied, Visa Issued and Deployed, with cumulative counts at each stage.',
          'Bulk candidate upload, and a recruitment-drive importer that reads the messy folder structure and reconciles it into requirements, candidates and documents.',
          'Invoices, income and expense entries, payments and financial reports.',
          'A message board with direct chats, group chats, and conversations attached to a requirement, plus push notifications.',
          'Offer-letter and poster generation.',
          'A candidate portal, where candidates see only their own records.',
        ],
      },
      {
        heading: 'Under the hood',
        paragraphs: [
          'The app is a Vite and React 19 frontend with TanStack Router, served from a Cloudflare Worker. The API is tRPC 11 with around thirty routers. Data is stored in Postgres, reached through Cloudflare Hyperdrive, and modelled with Drizzle.',
          'Documents live in Cloudflare R2 and are served through a Worker proxy. Large imports run in the background on a Cloudflare Queue, with a job table that tracks their progress. Sign-in is handled by better-auth, and the tests use Vitest and Playwright.',
        ],
      },
      {
        heading: 'Decisions and debugging',
        paragraphs: [],
        list: [
          'Requirements have a permanent internal ID, separate from the editable code that people type. Renaming a code no longer breaks the links behind it.',
          'The database connection is limited to one connection with prepared statements turned off, which avoids a connection pooler error.',
          'Import failures were hiding the real database error behind a generic message. The worker now surfaces the underlying cause, so problems can be diagnosed from the logs.',
        ],
      },
    ],
  },

  stamp: {
    lead:
      'STAMP runs a print shop’s work from the first enquiry to the final invoice. Every job order moves through the same tracked stages, and each stage checks what has to be true before the order can move on.',
    sections: [
      {
        heading: 'The problem',
        paragraphs: [
          'A print job passes through sample approval, quotation, production, packing, delivery and invoicing, often handled by different people. Without one shared record, approvals get missed, and it is hard to tell where an order is stuck.',
        ],
      },
      {
        heading: 'How a job moves',
        paragraphs: [
          'Every job order has ten statuses, from received through production and delivery to invoiced, plus on hold and cancelled. A state machine decides the next action from the current status. By default, production does not start until the sample is approved and the quotation is accepted.',
        ],
        list: [
          'Samples go through draft, review and approval, with revisions along the way.',
          'Quotations are submitted, approved, sent, and then accepted or rejected.',
          'Staff are assigned to production and packing, and the app blocks double-booking.',
          'Attendance tracking flags late arrivals.',
          'Invoices support both partial and full payment recording.',
          'Notifications arrive live through a server-sent events stream, with polling as a fallback.',
        ],
      },
      {
        heading: 'Access',
        paragraphs: [
          'Internal staff have five roles, from super admin down to staff. Customers have their own roles, and each customer company sees only its own orders and its company page. Internal production and staff data is hidden from them. New registrations stay pending until an admin approves them. The server checks permissions on every request.',
        ],
      },
      {
        heading: 'Under the hood',
        paragraphs: [
          'The app is built with TanStack Start in SPA mode, React 19 and Tailwind 4. The API is tRPC 11 with superjson, and sign-in uses Better Auth with email and password. Data is stored in Cloudflare D1 through Drizzle, and files go to R2.',
          'It runs as a Cloudflare Worker, with the API served under /api. Unit tests run with Vitest and the end-to-end suite with Playwright.',
        ],
      },
      {
        heading: 'A change from the plan',
        paragraphs: [
          'The original plan specified PostgreSQL. The build uses Cloudflare D1 instead, which fits the Worker deployment. The README and the code both reflect that choice.',
        ],
      },
    ],
  },

  'meditrack-ai': {
    lead:
      'MediTrack AI helps patients keep to their medication schedule. Each day it answers two questions: what do I take now, and how well am I following the plan? The AI only points out patterns in adherence. It never diagnoses or prescribes.',
    sections: [
      {
        heading: 'The problem',
        paragraphs: [
          'A missed dose is easy to forget, and it is hard to see your own patterns without writing them down. Patients and their caregivers need a simple daily view and an honest picture of how the schedule is going over time.',
        ],
      },
      {
        heading: 'What it does',
        paragraphs: ['The app focuses on the schedule and what happens to each dose:'],
        list: [
          'Medication and schedule management.',
          'A “today” view where each scheduled dose can be taken, skipped or snoozed.',
          'Reminders from a server-side scheduler, delivered as web push notifications.',
          'Adherence statistics and streaks, with CSV export.',
          'Caregiver invites, so a family member, friend or professional can receive alerts.',
          'AI insights and a voice assistant powered by Gemini. Its instructions forbid diagnosis and prescribing, and a unit test checks that rule.',
          'A demo workspace, so visitors can try the app without creating an account.',
        ],
      },
      {
        heading: 'Security',
        paragraphs: [
          'Sign-in uses Better Auth with email and password, a minimum password length of eight characters and sessions that last seven days. Access is checked on the server for each request rather than in the middleware. The web app sends a Content Security Policy and HSTS in production, and the mobile app keeps its session in the device’s secure storage.',
        ],
      },
      {
        heading: 'Under the hood',
        paragraphs: [
          'The web app is Next.js 15 with the App Router, React 19 and TypeScript. The API is tRPC 11 with TanStack Query, Zod validation and React Hook Form on the forms. Data lives in Postgres through Drizzle ORM, with Better Auth on the Drizzle adapter.',
          'A separate Expo and React Native app in apps/mobile talks to the same backend. Unit tests run on Vitest and end-to-end tests on Playwright.',
        ],
      },
      {
        heading: 'Where it stands',
        paragraphs: [
          'The build was tracked as eighteen completed phases. The final phase is code complete, and the production build and the full end-to-end run are still pending.',
        ],
      },
    ],
  },

  docuverify: {
    lead:
      'DocuVerify gives a first-pass check on a PDF or image. It returns a suspicion score from 0 to 100, a LOW, MEDIUM or HIGH risk level, and boxes around the parts that look wrong, each with the evidence behind it. It does not decide whether a document is genuine. It helps a reviewer decide where to look.',
    sections: [
      {
        heading: 'The problem',
        paragraphs: [
          'Checking certificates, statements and IDs by hand is slow, and the result depends on the reviewer’s eye. Black-box verdicts from AI tools are hard to audit. DocuVerify takes the opposite approach: it measures how far a document is from its own internal consistency, and it cites the evidence for every finding.',
        ],
      },
      {
        heading: 'What it checks',
        paragraphs: ['Each analyser looks at one kind of evidence:'],
        list: [
          'Layout: text blocks that sit away from the page’s dominant left edge.',
          'Typography: unexpected font families and size outliers in PDFs, and inconsistent text-box heights in scanned images.',
          'Visual: sharpness differences between text and image regions, and embedded images at low resolution.',
          'Metadata: editing-tool producers on documents with official-looking titles, and dates in an impossible order.',
          'Semantics: certificate fields such as CGPA against the declared scale, the duration, the issue date against the end year, and name consistency.',
          'Text layer: a comparison between a PDF’s embedded text and OCR of the rendered page.',
          'Domain verifiers: twelve checks, selected by the type of document.',
        ],
      },
      {
        heading: 'How the score works',
        paragraphs: [
          'Each category gets a weighted score, and layout and typography carry the most weight. Severity caps keep a single minor issue from dominating the result, and metadata is capped so it cannot decide a verdict on its own.',
          'Every highlighted region on the page is coloured by severity: red for high, orange for medium and yellow for low. Hovering over a finding lights up its box. Findings without a clear location are listed without a box.',
        ],
      },
      {
        heading: 'Under the hood',
        paragraphs: [
          'The backend is a FastAPI service using PyMuPDF for PDFs, OpenCV for image analysis, RapidOCR for text recognition and Pydantic for the data models. The frontend is React 19 with Vite, Tailwind 4 and a page viewer that draws the highlights. Sign-in runs as a small Better Auth service behind the same API.',
          'There is also an Expo app in the mobile folder with six screens that uses the same API.',
        ],
      },
      {
        heading: 'Where it stands',
        paragraphs: [
          'DocuVerify started as a hackathon project. Analysis jobs are kept in memory with a two-hour cleanup, so results do not persist between restarts yet. Planned work includes Postgres persistence, bank-statement reconciliation and contract checks, a fine-tuned local classifier, and batch processing.',
        ],
      },
    ],
  },
};
