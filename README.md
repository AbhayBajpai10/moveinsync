# MoveInSync Fleet Tracking Dashboard

A real-time fleet management dashboard built with **Next.js 16**, **Mapbox GL**, and **WebSockets**. It displays live vehicle positions on an interactive map and surfaces geofence / speed-violation alerts as they happen.

---

## ✨ Features

- 🗺️ **Live map** — Mapbox-powered interactive map showing real-time vehicle positions
- 📡 **WebSocket integration** — instant push updates with automatic reconnection & exponential back-off
- 🚨 **Alert feed** — real-time geofence-entry and speed-violation toasts + a persistent alert panel
- 📊 **Command-centre sidebar** — per-vehicle status, speed, ETA, and driver info
- 🌐 **Network health indicator** — colour-coded top bar (green / amber / red) + status banners
- 🧩 **Zustand global state** — production-grade store with devtools, deduplication, and alert pruning
- 🧪 **Full test suite** — Jest unit tests + Playwright E2E tests

---

## 🗂️ Project Structure

```
moveinsync/
├── mock-server/          # Standalone WebSocket mock server (Node.js + ws)
│   ├── server.ts         # Simulates 11 vehicles, broadcasts updates every 1 s
│   └── package.json
│
└── moveinsyncdashboard/  # Next.js application
    ├── src/
    │   ├── app/          # Next.js App Router (page.tsx, layout.tsx, globals.css)
    │   ├── components/
    │   │   ├── map/      # MapContainer (react-map-gl + Mapbox)
    │   │   ├── sidebar/  # CommandCenterSidebar
    │   │   ├── alerts/   # AlertFeed
    │   │   └── error/    # MapErrorBoundary
    │   ├── hooks/
    │   │   ├── useWebSocket.ts       # WebSocket lifecycle, reconnection, queue flushing
    │   │   └── useVehicleAnimation.ts
    │   ├── store/
    │   │   └── useStore.ts           # Zustand store (vehicles, alerts, trips, geofences)
    │   ├── types/                    # Shared TypeScript interfaces
    │   └── __tests__/               # Jest unit tests (hooks, store, utils)
    ├── e2e/                          # Playwright end-to-end tests
    └── package.json
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Minimum version |
|------|-----------------|
| Node.js | 18+ |
| npm | 9+ |
| A [Mapbox](https://account.mapbox.com/) public access token | — |

### 1 — Clone the repository

```bash
git clone <your-repo-url>
cd moveinsync
```

### 2 — Configure environment variables

Create `moveinsyncdashboard/.env.local`:

```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token_here
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

### 3 — Install dependencies

```bash
# Dashboard
cd moveinsyncdashboard
npm install

# Mock server
cd ../mock-server
npm install
```

### 4 — Start the mock WebSocket server

```bash
# From the mock-server directory
npx tsx server.ts
```

> The server starts on **ws://localhost:8080** and immediately begins broadcasting vehicle updates every second.

### 5 — Start the dashboard

```bash
# From the moveinsyncdashboard directory
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Tests

```bash
# From moveinsyncdashboard/

# Unit tests (Jest)
npm test

# Unit tests with coverage report
npm run test:coverage

# End-to-end tests (Playwright, headless)
npm run test:e2e

# End-to-end tests with UI
npm run test:e2e:ui
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Map | Mapbox GL JS 2 · react-map-gl 8 |
| State | Zustand 5 (with devtools) |
| Styling | Tailwind CSS 4 · shadcn/ui |
| Real-time | WebSocket (native browser API) |
| Notifications | Sonner |
| Icons | Lucide React |
| Unit tests | Jest 30 · React Testing Library |
| E2E tests | Playwright |
| Mock server | Node.js · ws |

---

## ⚙️ WebSocket Protocol

The mock server sends JSON messages over WebSocket. The dashboard handles two message types:

| `type` | Payload | Description |
|--------|---------|-------------|
| `VEHICLE_UPDATE` | `Vehicle` object | Position, speed, ETA, status |
| `TRIP_ALERT` | `Alert` object | Geofence entry or speed violation |

### Alert types

| Alert type | Severity | Toast colour |
|------------|----------|--------------|
| `GEOFENCE_ENTRY` | Normal | Blue |
| `SPEED_VIOLATION` | Critical | Red (8 s, persistent) |

---

## 🔌 Connection Resilience

`useWebSocket` implements production-grade connection management:

- **Exponential back-off** — retries after 1 s, 2 s, 4 s … up to 30 s
- **Max 5 reconnect attempts** before showing a "please refresh" message
- **Slow-network detection** — warns if no heartbeat received for > 4 s
- **Stale-connection detection** — flags the store after 10 s of silence
- **Graceful shutdown** — server sends close code `1001`; client does not retry
- **Batched vehicle updates** — queued messages are flushed every 500 ms to minimise re-renders

---

## 📝 Available Scripts

### Dashboard (`moveinsyncdashboard/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (webpack mode) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest unit tests |
| `npm run test:coverage` | Jest with coverage |
| `npm run test:e2e` | Playwright headless tests |
| `npm run test:e2e:ui` | Playwright interactive UI |

### Mock Server (`mock-server/`)

| Command | Description |
|---------|-------------|
| `npx tsx server.ts` | Start the WebSocket mock server |

---

## 📄 License

This project is for demonstration / assessment purposes.
