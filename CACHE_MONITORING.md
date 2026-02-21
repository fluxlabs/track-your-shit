# Cache Monitoring Dashboard

## Overview

The Cache Monitoring Dashboard provides comprehensive insights into the Project Autopilot's prompt cache performance, helping optimize costs and understand caching efficiency.

## Features

### 1. Cache Overview
- **Hit Rate**: Real-time cache effectiveness metric with health status (Excellent/Good/Fair/Poor)
- **Tokens Saved**: Total tokens saved through cache hits
- **Cost Saved**: Dollar amount saved through caching
- **Cache Size**: Total cache size and entry count

### 2. Timeline Visualization
- Line chart showing cache hits, misses, and hit rate over time
- Helps identify performance trends and optimization opportunities
- Real-time updates every 5 seconds

### 3. Cache Entries Management
- Detailed table of all cache entries with:
  - Cache key and category
  - Size and hit/miss statistics
  - Hit rate percentage with color coding
  - Last access time and TTL information
- Filtering by category (system-prompt, skill-definition, project-context, etc.)
- Sorting by hits, size, or recency
- Individual entry eviction

### 4. Category Breakdown
- Cards showing statistics for each cache category
- Entries count, hits, and size per category
- Quick overview of which categories are most effective

## Files Created

### React Components
- `/src/components/cache/cache-overview.tsx` - Overview stats cards
- `/src/components/cache/cache-timeline.tsx` - Timeline chart component
- `/src/components/cache/cache-details.tsx` - Cache entries table
- `/src/components/cache/index.ts` - Component exports

### Pages
- `/src/pages/cache.tsx` - Main cache monitoring page

### API Integration
- `/src/lib/tauri.ts` - Added cache types and API functions:
  - `CacheStats`, `CacheEntry`, `CacheFilters` types
  - `getCacheStats()`, `getCacheEntries()`, `clearCache()`, `evictCacheEntry()` functions
- `/src/lib/queries.ts` - Added React Query hooks:
  - `useCacheStats()` - Fetch cache statistics (auto-refresh every 5s)
  - `useCacheEntries()` - Fetch paginated cache entries
  - `useClearCache()` - Clear all or category-specific cache
  - `useEvictCacheEntry()` - Remove individual entries

### Rust Backend (Tauri)
- `/src-tauri/src/commands/cache.rs` - Tauri commands for cache operations:
  - `get_cache_stats()` - Fetches stats from Node.js API
  - `get_cache_entries()` - Fetches and filters cache entries
  - `clear_cache()` - Clears cache with optional category filter
  - `evict_cache_entry()` - Evicts single entry (placeholder)
- `/src-tauri/Cargo.toml` - Added `reqwest` dependency for HTTP calls

## Files Modified

### Navigation
- `/src/App.tsx` - Added `/cache` route and imported `CachePage`
- `/src/components/layout/main-layout.tsx` - Added "Cache" menu item with Database icon

### Module Registration
- `/src-tauri/src/commands/mod.rs` - Registered cache module
- `/src-tauri/src/lib.rs` - Registered cache commands in Tauri invoke handler

## How It Works

### Architecture
1. **Frontend (React + TypeScript)**:
   - React Query manages data fetching and caching
   - Recharts provides timeline visualization
   - Tailwind CSS ensures consistent styling

2. **Tauri Commands (Rust)**:
   - Acts as a bridge between frontend and Node.js API
   - Calls `http://localhost:3000/api/cache/*` endpoints
   - Transforms API responses to match frontend types

3. **Backend API (Node.js)**:
   - Existing cache statistics API at `/api/cache/stats`
   - Tracks cache hits, misses, and savings
   - Stores data in SQLite database

### Data Flow
```
React Components
    ↓ (use React Query hooks)
Tauri Commands (Rust)
    ↓ (HTTP requests via reqwest)
Node.js API Server
    ↓ (SQLite queries)
Cache Statistics Database
```

## Usage

### Accessing the Dashboard
1. Launch Control Tower
2. Click "Cache" in the sidebar navigation
3. View real-time cache performance metrics

### Filtering and Sorting
- Use the category dropdown to filter by cache type
- Change sort order: Most Hits, Largest Size, Most Recent
- View detailed statistics in the table

### Clearing Cache
1. Click "Clear Cache" button in the header
2. Confirm the action in the dialog
3. Cache will rebuild automatically as system is used

### Monitoring Performance
- Green hit rate (≥80%): Excellent caching
- Blue hit rate (60-79%): Good caching
- Yellow hit rate (40-59%): Fair caching (optimization needed)
- Red hit rate (<40%): Poor caching (requires investigation)

## Cache Categories

The system tracks the following cache categories:

- **system-prompt**: Core system prompts
- **skill-definition**: Skill definitions and documentation
- **project-context**: Project-specific context
- **phase-definition**: Flight plan phase definitions
- **clearance**: Clearance and permission documentation
- **flightplan**: Flight plan metadata

## Design Patterns

### Component Structure
- **Presentational Components**: Pure components receiving props
- **Container Pattern**: Page component manages state and data fetching
- **Composition**: Small, focused components composed together

### State Management
- React Query for server state (automatic caching, refetching, optimistic updates)
- Local state (useState) for UI state (filters, dialogs)
- No global state needed for this feature

### Styling
- Tailwind CSS utility classes
- Consistent with existing Control Tower design system
- Responsive grid layouts for different screen sizes
- Dark mode support via CSS variables

### Performance
- Automatic refetching every 5 seconds for real-time data
- Pagination for large entry lists (20 per page)
- Lazy loading of chart data
- Efficient re-renders with React.memo where needed

## Future Enhancements

### Potential Improvements
1. **Real-time Updates**: WebSocket connection for live cache events
2. **Advanced Filtering**: Date range, minimum hits, size thresholds
3. **Export Functionality**: Export cache statistics to CSV/JSON
4. **Trend Analysis**: Weekly/monthly cache performance reports
5. **Optimization Suggestions**: AI-powered caching recommendations
6. **Per-Project Cache Stats**: Filter cache by specific projects
7. **Cache Warming**: Pre-populate cache with common patterns
8. **TTL Management**: Configure TTL for different cache categories

### Known Limitations
1. `evict_cache_entry` is a placeholder (API endpoint doesn't exist yet)
2. Timeline generation is simplified (groups by hour, max 24 entries)
3. Size calculation is estimated (4 bytes per token)
4. API URL is hardcoded to `localhost:3000`

## Testing

### Manual Testing Checklist
- [ ] Dashboard loads without errors
- [ ] Stats cards display correct data
- [ ] Timeline chart renders properly
- [ ] Table shows cache entries with proper formatting
- [ ] Category filter works correctly
- [ ] Sort options change order as expected
- [ ] Clear cache button shows confirmation dialog
- [ ] Clear cache action updates the UI
- [ ] Navigation to/from cache page works
- [ ] Real-time updates occur every 5 seconds

### Error Handling
- API connection failures show user-friendly messages
- Loading states prevent UI flicker
- Empty states guide users when no data exists
- Failed mutations don't crash the app

## Dependencies

### Frontend
- `recharts`: Chart visualization
- `@tanstack/react-query`: Data fetching and caching
- `date-fns`: Date formatting
- `lucide-react`: Icons

### Backend (Rust)
- `reqwest`: HTTP client
- `serde/serde_json`: JSON serialization
- `tokio`: Async runtime

## Copyright

Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

All components follow the established copyright header pattern.
