# Trending Aggregator — Web Frontend

React 19 + Vite + TypeScript frontend for the Trending Aggregator platform. Displays GitHub trending repos, starred repos, and Product Hunt products in a unified dashboard with i18n support.

## Quick Start

```bash
npm install
npm run dev                        # → http://localhost:5173
```

## Pages

| Route | Page |
|---|---|
| `/` | Dashboard with summary statistics |
| `/github-trending` | GitHub trending repos (daily/weekly/monthly) |
| `/github-starred` | GitHub user starred repos explorer |
| `/product-hunt` | Product Hunt trending products |
| `/settings` | API URL, theme, refresh settings |

## Tech Stack

- **React 19** + TypeScript
- **Vite** — build tool
- **Tailwind CSS** — styling
- **shadcn/ui** — 40+ UI components
- **TanStack Query** — data fetching and caching
- **Recharts** — charts and visualizations
- **Framer Motion** — animations
- **i18n**: English + Chinese (zh-CN)

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | TypeScript check + Vite build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
