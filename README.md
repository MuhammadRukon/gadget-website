## Project Overview

A simple e-commerce MVP for gadgets. Built to demonstrate end-to-end product catalog, cart, checkout, and payment flow.

### 1. Tech Stack

- **Framework:** Next.js (Full Stack) + TypeScript
- **Styling:** Tailwind CSS + Shadcn UI
- **Database & ORM:** PostgreSQL + Prisma
- **Auth:** NextAuth.js & OAuth
- **State Management:** Zustand
- **Version Control:** Git & Github
- **Testing:** Vitest & React Testing Library
- **Form & Validation:** React Hook Form & Zod
- **Others:** TanStack Query
- **Deployment:** Vercel

### 2. Features (MVP)

- Categories & Brands management
- Product listing with details
- User authentication & authorization
- Shopping cart
- Checkout flow
- Payment integration (COD and Online payment)

### 3. System Design

- A simple Monolithic Architecture. (Optimal and viable for MVP).
- ER Diagram: https://drawsql.app/teams/muhammad-sheikh-rukon/diagrams/gadget
- Schema design: ./prisma/schema.prisma
  _more will be added as I build and learn_

#### Relations:

- Users -> Orders (1:N)
- Orders <-> Products (via OrderItems M:N)
- Categories <-> Products (via ProductCategory) (M:N)
- Brands -> Products (via ProductBrand) (1:N)
- Users -> CartItems (1:N)

### 5. Development Approach

- Planning: Defined MVP scope (features above)
- Design: Created ERD + database schema + Low Fidelity Wireframe
- Development (TDD): Feature/Module wise (API -> UI -> Integration)
- Version Control Management: GitHub Flow with feature branches, PR review, and merge dev to main

#### Implementation:

- Database models with Prisma
- API routes (products, cart, checkout)
- UI with Tailwind + Shadcn
- Testing: Unit tests for business logic, integration tests for API endpoints, minimal UI tests.
- Deployment: Hosted frontend + backend on Vercel, database on managed PostgreSQL. Only the `main` branch is deployed.

#### Git Flow:

##### Branches:

- **`main`** → Production branch. Always stable. Automatically deployed.
- **`dev`** → Integration branch. Used to validate features before merging to production `main`.
- **`feature/*`** → Feature/module branches created from `main`.

##### Workflow:

**Create a feature branch**

```bash
git switch main
git pull origin main
git checkout -b feature/<feature-name>
```

**Keep feature branch synced**

```bash
git checkout feature/<feature-name>
git fetch origin
git merge origin/main
```

**Open PR -> dev**

- After feature/module is complete, open a Pull Request from your feature/\* branch into dev.
- Validate on dev
- Code review and QA happen in dev.
- Fixed code is merged into dev
- Once dev is stable, open a Pull Request from dev into main. This merges tested features into production.

**Fix Issue**

```bash
git switch dev
git pull origin dev
git checkout -b feature/<feature-name>/hotfix
```

- Create a pull request to dev after fix.

### 6. Future Improvements

- Analytics
- Discount/coupon system
- Warranty

### 7. Folder Structure:

```text
src/
    app/                # routes
    (public)/           # All user facing routes
    (dashboard)/        # All dashboard related routes
    hooks/              # custom hooks
    stores/             # zustand stores
    actions/            # api service layer
```
