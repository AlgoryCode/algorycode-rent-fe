<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Design Color Rules

- Primary: `#3909e8`
- Secondary: `#16e88d`
- Tertiary: `#ddf0eb`
- Neutral: `#ffffff`

Use semantic Tailwind tokens (`primary`, `secondary`, `tertiary`, `neutral`) instead of ad-hoc hardcoded colors in new or updated UI work.

## Breakpoints (mobile vs desktop chrome)

Treat **`lg:` (≥1024px)** as desktop: fixed sidebar, dense header, wider tables.

Below **`lg`**, use the mobile shell (`DashboardShell`): bottom navigation, mobil kart listeleri, ve `rental-logs/mobile` ile hizalı `lg:hidden` bileşenler. Desktop-only UI uses `hidden lg:flex`, `hidden lg:block`, etc. Prefer `lg:` (not `md:`) when splitting “tablet = mobile UX” vs “geniş masaüstü”.
