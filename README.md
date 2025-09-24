Features: Categories, Brands, Products, User Authentication and Authorization, Cart, Checkout, Payment.

## Project Overview

A simple e-commerce MVP for gadgets. Built to demonstrate end-to-end product catalog, cart, checkout, and payment flow.

### 1. Tech Stack

- **Framework:** Next.js (Full Stack) + TypeScript
- **Styling:** Tailwind CSS + Shadcn UI
- **Database & ORM:** PostgreSQL + Prisma
- **Auth:** NextAuth.js & OAuth
- **State Management:** Zustand
- **Version Control:** Git & Github
- **Testing:** Vitest
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

- Users ↔ Orders (1:N)
- Orders ↔ Products (via OrderItems M:N)
- Categories ↔ Products (via ProductCategory) (M:N)
- Brands ↔ Products (via ProductBrand) (M:N)
- Users ↔ CartItems (1:N)

### 5. Development Approach

- Planning: Defined MVP scope (features above)
- Design: Created ERD + database schema
- Development (TDD): Feature/Module wise (API -> UI -> Integration)
- Version Control Management: GitHub Flow with feature branches, PR review, and merge dev to main

#### Implementation:

- Database models with Prisma
- API routes (products, cart, checkout)
- UI with Tailwind + Shadcn
- Testing: Unit tests for business logic, integration tests for API endpoints, minimal UI tests.
- Deployment: Hosted frontend + backend on Vercel, database on managed PostgreSQL

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
