# Gadget Website — Context Pointer

> **This file has been superseded.** The maintained orientation docs now live in
> [`docs/context/`](./docs/context/00-INDEX.md) — start there.

Quick links:

- [Docs index](./docs/context/00-INDEX.md)
- [Overview & env vars](./docs/context/01-overview.md)
- [Architecture](./docs/context/02-architecture.md)
- [Data model](./docs/context/03-data-model.md)
- [API reference](./docs/context/04-api-reference.md)
- [Frontend map](./docs/context/05-frontend.md)
- [Conventions / how to add a feature](./docs/context/06-conventions.md)
- [Known flaws (fix list)](./docs/issues/README.md)
- [Feature gaps](./docs/product/FEATURE-GAPS.md)
- [SEO audit](./docs/SEO-AUDIT.md)

## One-paragraph summary

Full-stack e-commerce app ("Cryptech") for gadgets: Next.js 16 App Router + TypeScript, Prisma + PostgreSQL, Auth.js v5 (JWT), TanStack Query + Zustand, Tailwind 4 + shadcn/ui, Cloudinary. Layered flow: UI → API route (Zod contract + auth check) → service (`src/server/**`) → Prisma. Storefront under `src/app/(public)`, admin under `src/app/(dashboard)`, guarded by `src/proxy.ts` + per-route `requireAdminSession()`. Deployed on Vercel free tier from `main`; keep solutions free-tier friendly.
