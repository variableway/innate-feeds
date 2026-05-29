# Frontend Specification

## Status

The frontend is **copied directly from Fusion** without structural changes. TrendRadar news appears as regular feed items because they share the same `items` table and API format.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Router**: TanStack Router
- **State Management**: TanStack Query + Zustand (ui store)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (sheet, tabs, scroll-area, sonner, tooltip, switch, command, avatar, dialog, separator, button, dropdown-menu, select, input)
- **Icons**: Lucide React

## Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | ArticleList | All items (unread + read) |
| `/feeds` | FeedList | Feed management |
| `/feeds/:feedId` | FeedItems | Items for a specific feed |
| `/groups/:groupId` | GroupItems | Items for a group |
| `/login` | Login | Password login |

## Key Components

- **AppLayout** — Sidebar + main content area + modals
- **Sidebar** — Feed groups + feed list + unread counts
- **ArticleList** — Item list with unread/read state
- **ArticleDrawer** — Slide-out article reader
- **SearchDialog** — FTS search across items

## No Changes Required

Because TrendRadar items use the same `model.Item` structure as RSS items, the frontend consumes them identically. The only visual difference is:
- RSS items: `content` = article body
- TrendRadar items: `content` = "Rank: #N | Platform: X"

If desired, the frontend can be enhanced later to show TrendRadar-specific metadata (rank, platform) in a richer format.
