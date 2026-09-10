# Architecture

## Overview

Vibekit is a minimal full-stack application template designed for building internal tools. It prioritizes simplicity, accessibility, and maintainability over features and flexibility.

## Design Principles

### 1. Minimal Dependencies

The only runtime dependencies are:
- **Shoelace** - UI component library
- **Zod** - Runtime validation (server only)

Everything else uses native browser/Node.js APIs.

### 2. No Build Step (Client)

Client code is served as raw ES modules. Modern browsers support this natively, eliminating bundler complexity.

### 3. Handler Chain Pattern (Server)

Instead of a routing framework, the server uses a simple handler chain:

```typescript
export async function handleApi(ctx: ApiContext): Promise<void> {
  if (await handleItems(ctx)) return;
  if (await handleUsers(ctx)) return;
  // ...
  notFound(ctx.res);
}
```

Each handler returns `true` if it handled the request, `false` to pass to the next handler.

### 4. File-Based Storage

Data is stored as JSON files in the `data/` directory. This eliminates database setup and makes backups trivial (just copy the directory).

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Router    │───▶│    View     │───▶│ Components  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                  │                   │            │
│         │                  ▼                   │            │
│         │           ┌─────────────┐            │            │
│         │           │  API Client │            │            │
│         │           └─────────────┘            │            │
└─────────│───────────────────│──────────────────│────────────┘
          │                   │                  │
          │                   ▼                  │
┌─────────│───────────────────────────────────────────────────┐
│         │              HTTP Request                          │
├─────────│───────────────────────────────────────────────────┤
│         │           ┌─────────────┐                          │
│         │           │   Server    │                          │
│         │           └─────────────┘                          │
│         │                  │                                 │
│         │    ┌─────────────┼─────────────┐                  │
│         │    ▼             ▼             ▼                  │
│    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│    │   Static    │  │  API Router │  │    Auth     │       │
│    └─────────────┘  └─────────────┘  └─────────────┘       │
│                            │                                 │
│                            ▼                                 │
│                     ┌─────────────┐                          │
│                     │   Storage   │                          │
│                     └─────────────┘                          │
│                            │                                 │
│                            ▼                                 │
│                     ┌─────────────┐                          │
│                     │  JSON Files │                          │
│                     └─────────────┘                          │
└──────────────────────────────────────────────────────────────┘
```

## Client Architecture

### Router

The client router uses the History API:

```javascript
route('/items/:id', async ({ params }) => {
  // Render view
  return cleanup; // Optional cleanup function
});

startRouter();
```

Routes can return a cleanup function that's called when navigating away.

### Views

Views are functions that render into a container:

```javascript
export async function renderItemList(container) {
  // Fetch data
  const response = await get('/api/items');

  // Render UI
  container.appendChild(/* ... */);

  // Return cleanup function
  return () => {
    // Cleanup event listeners, intervals, etc.
  };
}
```

### Components

Reusable UI patterns are provided as factory functions:

```javascript
import { pageHeader, formGroup, dataTable } from './lib/components.js';
```

These return DOM elements, not framework-specific abstractions.

### DOM Utilities

The `h()` function provides hyperscript-style element creation:

```javascript
h('div', { class: 'card', onclick: handleClick }, [
  h('h2', {}, ['Title']),
  h('p', {}, ['Content'])
]);
```

## Server Architecture

### Request Flow

1. Request received by `server.ts`
2. URL parsed, CORS headers set
3. API routes checked via handler chain
4. Static files served for non-API routes

### Handler Pattern

Each resource has its own handler file:

```typescript
// server/routes/api/items.ts
export async function handleItems(ctx: ApiContext): Promise<boolean> {
  // GET /api/items
  if (path === '/api/items' && method === 'GET') {
    const items = await listItems();
    ok(res, items);
    return true;
  }

  // Not handled
  return false;
}
```

### HTTP Utilities

Standard responses are provided as utilities:

```typescript
import { ok, created, badRequest, notFound, json } from '../utils/http.js';

const body = await json<CreateInput>(req);
ok(res, data);
badRequest(res, 'Invalid input');
```

### Storage Layer

Each entity has its own storage module:

```typescript
// server/storage/items.ts
export async function listItems(): Promise<Item[]>;
export async function getItem(id: string): Promise<Item | null>;
export async function createItem(data: CreateData): Promise<Item>;
export async function updateItem(id: string, data: UpdateData): Promise<Item>;
export async function deleteItem(id: string): Promise<boolean>;
```

## CSS Architecture

### Layer Structure

```
tokens.css          # Design tokens (CSS variables)
    │
    ▼
reset.css           # Minimal CSS reset
    │
    ▼
shoelace-theme.css  # Shoelace variable mappings
    │
    ▼
base.css            # Element styles (h1-h6, p, a, etc.)
    │
    ▼
components.css      # Component styles (.vk-card, .vk-table, etc.)
    │
    ▼
utilities.css       # Utility classes (.flex, .gap-4, etc.)
```

### Naming Convention

Components use a `.vk-` prefix with BEM-like structure:

```css
.vk-card { }           /* Component */
.vk-card-header { }    /* Element */
.vk-card.is-active { } /* Modifier */
```

### Design Tokens

All values are defined as CSS variables:

```css
:root {
  --vk-space-4: 1rem;
  --vk-color-text: #1a1a1a;
  --vk-radius-md: 6px;
}
```

Dark mode overrides these variables in a `.sl-theme-dark` class.

## Adding New Features

### 1. Add API Endpoint

Create `server/routes/api/newfeature.ts`:

```typescript
export async function handleNewFeature(ctx: ApiContext): Promise<boolean> {
  // Handle routes
  return false;
}
```

Register in `server/routes/api/index.ts`:

```typescript
if (await handleNewFeature(ctx)) return;
```

### 2. Add Storage

Create `server/storage/newfeature.ts` with CRUD functions.

### 3. Add Client View

Create `client/views/newfeature/list.js` and `client/views/newfeature/form.js`.

### 4. Add Routes

In `client/app.js`:

```javascript
route('/newfeature', () => renderNewFeatureList(container));
route('/newfeature/:id/edit', ({ params }) => renderNewFeatureForm(container, params.id));
```

## Testing Strategy

### Unit Tests (Vitest)

Test storage functions and utilities:

```typescript
describe('items storage', () => {
  it('creates an item', async () => {
    const item = await createItem({ name: 'Test' });
    expect(item.name).toBe('Test');
  });
});
```

### E2E Tests (Playwright)

Test user flows:

```typescript
test('creates a new item', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="new-item"]');
  await page.fill('[data-testid="name-input"]', 'New Item');
  await page.click('[data-testid="submit"]');
  await expect(page.locator('text=New Item')).toBeVisible();
});
```

## Security Considerations

- Input validation with Zod at API boundaries
- File paths sanitized for static serving
- No SQL (no injection risk)
- CORS configured for development
- Environment variables for secrets
