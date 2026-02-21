# Screenshot Capture Guide

Guide for capturing Control Tower app screenshots for the marketing website.

## Prerequisites

1. Seed the database with demo data:
   ```bash
   cd control-tower-app
   bash scripts/seed-demo.sh
   ```
2. Start the app:
   ```bash
   cargo tauri dev
   ```

## Window Sizes

| Aspect | Resolution | Usage |
|--------|-----------|-------|
| Wide (21:9) | 1440×620 | Hero screenshots |
| Video (16:9) | 1280×800 | Gallery screenshots |

## Screenshots to Capture

| File Name | Page/Route | Notes |
|-----------|-----------|-------|
| `dashboard-hero.png` | `/` (Dashboard) | Wide crop — show project cards + analytics |
| `dashboard-overview.png` | `/` (Dashboard) | Wide crop — gallery hero, similar angle |
| `projects-overview.png` | `/projects` | Show all 3 demo projects with status badges |
| `project-detail.png` | `/project/:id` (SaaS Dashboard) | Overview tab with flight plan progress |
| `flight-plan.png` | `/project/:id` Flight Plan tab | Expanded phases with tasks visible |
| `terminal.png` | `/shell` or Shell panel | Terminal with some command output |
| `execution-monitor.png` | `/project/:id` with running execution | Execution details with cost/progress |
| `settings.png` | `/settings` | Dark theme, show multiple sections |

## Capture Steps

1. Resize the app window to the target resolution
2. Navigate to the target page
3. Wait for all data to load (spinners gone)
4. Use `Cmd+Shift+4` (macOS) to capture a region, or `Cmd+Shift+5` for window capture
5. Save to `website/public/screenshots/` with the correct filename

## Image Optimization

Before committing, optimize PNGs to reduce file size:

```bash
# Using pngquant (brew install pngquant)
pngquant --quality=80-95 --strip --output optimized.png input.png

# Or batch optimize all screenshots
cd website/public/screenshots
for f in *.png; do
  pngquant --quality=80-95 --strip --force "$f"
done
```

Alternatively, use [Squoosh](https://squoosh.app/) for manual optimization with preview.

Target file sizes: under 300KB per image for fast page loads.
