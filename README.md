# Gym Platform Demo

Full-stack web platform for a gym: a public site, online membership sign-up and a member area with a QR access card, plus a back office for staff.

> **Demo with fictitious data.** "FORJA GYM" is an invented brand. Every member, price, schedule, image and contact detail in this repository is fake, and payments are simulated: no real charge is ever made.

## Features

- **Public site** with opening hours, live occupancy, products, membership plans, gallery and contact page.
- **Sign-up and login** with Supabase Auth, plus an onboarding form (emergency contacts, health notes).
- **Membership checkout** through a pluggable payment gateway; the demo uses a simulated one.
- **Member area** with membership status, days left and a signed QR card for check-in.
- **Back office** with role-based permissions: members, payments, plans, staff, check-in and capacity, CSV import, audit log and business settings.
- **Database security** with Postgres row-level security (RLS) policies; privileged operations go through the API.

## Stack

- **Client:** React 18 + Vite (SPA)
- **API:** Node.js + Express, served as a Vercel serverless function in production
- **Data and auth:** Supabase (Postgres, Auth, row-level security)
- **Deployment:** Vercel
- **Quality:** ESLint with complexity limits, `node --test` suites, SQL migration checks and GitHub Actions CI

## Run the demo locally

Requirements: Node.js 22 and Docker Desktop running.

```bash
npm ci
npm ci --prefix client
npm ci --prefix server
npm run demo
```

`npm run demo` starts a local Supabase in Docker, creates the schema, seeds a fictitious gym with 150 members, and serves:

- App: http://localhost:5180
- API: http://localhost:3080

The login page shows one-click buttons to enter as owner, manager, front desk, cashier, accountant or member. You can also create your own account and buy a membership with the simulated payment.

```bash
npm run demo:reset   # back to the freshly seeded gym
npm run demo:stop    # stop local Supabase
```

Demo mode only turns on against a local Supabase URL, so the passwordless entry never exists in a deployed build.

## Quality checks

```bash
npm run lint   # ESLint, zero warnings allowed
npm test       # server test suite
```

CI runs lint, server tests, SQL migrations (applied twice on a clean Postgres) and the client build on every pull request.

## Project structure

```
client/     React + Vite app
server/     Express API, SQL schema and migrations (server/db), demo seeder (server/demo)
api/        Vercel serverless entry point
scripts/    Local demo orchestrator
supabase/   Local Supabase config used by the demo
```
