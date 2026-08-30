<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Guidelines & Rules

## 1. Package Manager
- **Always use `pnpm` exclusively** for installing packages, running scripts, and building the project (e.g., `pnpm add`, `pnpm run dev`, `pnpm build`). Never use `npm`, `yarn`, or `bun`.

## 2. Design System & UI Rules
- **No Sparkle Icons**: Do not use `Sparkles` or decorative sparkle icons anywhere in headings, badges, or sections.
- **No Background/Border Boxes Under Icons**: Do not wrap icons inside individual colored background boxes or bordered containers (e.g., avoid `w-10 h-10 bg-zinc-950 rounded-xl` icon wrappers). Render icons cleanly and directly inline with natural typography-aligned sizing and subtle colors (e.g., `w-5 h-5 text-zinc-900` or `text-zinc-500`).
- **Clean & Seamless Typography (No Card Boxing)**: Avoid segmenting content into small individual boxed cards with separate background colors, borders, and shadows (`bg-white border rounded-2xl shadow`). Keep layouts clean, seamless, and typography-driven with generous whitespace or subtle divider lines (`divide-y divide-zinc-200/80`).
- **Dark Container Sections (e.g., Quick Start Guide)**: When a dark container is used (`bg-zinc-950 text-white rounded-3xl p-8 sm:p-10`), do not add inner boxed sub-cards. Keep the interior clean with bold step numbers (`01`, `02`, `03` in `text-zinc-600`), headings in `text-white`, and description text in `text-zinc-400`.
- **Badges & Tags**: Keep badges, category tags, and status labels clean, text-based, and minimalist without heavy background boxes or thick borders.
- **FAQ Accordions & Lists**: Use clean single divider lines (`divide-y border-y`) rather than individual card boxes around each question.

