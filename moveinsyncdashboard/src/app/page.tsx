// // src/app/page.tsx
// 'use client';

// import dynamic from 'next/dynamic';
// import useWebSocket from '../hooks/useWebSocket';
// import { Toaster } from 'sonner';

// // 1. SKELETON LOADER: High-Fidelity Mapbox Placeholder
// const MapContainer = dynamic(
//   () => import('../components/map/MapContainer').then((mod) => mod.MapContainer),
//   { 
//     ssr: false, 
//     loading: () => (
//       <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center space-y-6 relative overflow-hidden">
//         {/* Radar Sweep Animation Effect */}
//         <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-blue-500 via-slate-950 to-slate-950 animate-pulse"></div>

//         {/* Loading Spinner */}
//         <div className="w-16 h-16 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin z-10"></div>
//         <div className="text-slate-400 font-bold z-10 animate-pulse tracking-widest">

//         </div>
//       </div>
//     ) 
//   }
// );

// const CommandCenterSidebar = dynamic(
//   () => import('../components/sidebar/CommandCenterSidebar'),
//   { ssr: false }
// );

// const AlertFeed = dynamic(
//   () => import('../components/alerts/AlertFeed'),
//   { ssr: false }
// );

// export default function DashboardPage() {
//   const { isConnected, isSlowNetwork } = useWebSocket();

//   return (
//     <main className="h-screen w-screen overflow-hidden bg-slate-950 relative">

//       {/* 2. NETWORK SLOW INDICATOR (Graceful Degradation) */}
//       {!isConnected ? (
//         <div className="absolute top-0 left-0 w-full h-1 bg-red-600 z-50 animate-pulse" />
//       ) : isSlowNetwork ? (
//         <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 z-50 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
//       ) : (
//         <div className="absolute top-0 left-0 w-full h-1 bg-green-500 z-50" />
//       )}

//       <Toaster position="top-center" theme="dark" />

//       <MapContainer />
//       <AlertFeed />
//       <CommandCenterSidebar />
//     </main>
//   );
// }

// src/app/page.tsx
// 'use client';

// import dynamic from 'next/dynamic';
// import useWebSocket from '../hooks/useWebSocket';
// import { Toaster } from 'sonner';
// import { AlertCircle } from 'lucide-react';

// const MapContainer = dynamic(() => import('../components/map/MapContainer').then((mod) => mod.MapContainer), { ssr: false, loading: () => <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center space-y-6 relative overflow-hidden"><div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-blue-500 via-slate-950 to-slate-950 animate-pulse"></div><div className="w-16 h-16 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin z-10"></div><div className="text-slate-400 font-bold z-10 animate-pulse tracking-widest"></div></div> });
// const CommandCenterSidebar = dynamic(() => import('../components/sidebar/CommandCenterSidebar'), { ssr: false });
// const AlertFeed = dynamic(() => import('../components/alerts/AlertFeed'), { ssr: false });

// export default function DashboardPage() {
//   const { isConnected, isSlowNetwork, connectionStatus } = useWebSocket();

//   return (
//     <main className="h-screen w-screen overflow-hidden bg-slate-950 relative">

//       {/* Network Status Line */}
//       {!isConnected ? (
//         <div className="absolute top-0 left-0 w-full h-1 bg-red-600 z-50 animate-pulse" />
//       ) : isSlowNetwork ? (
//         <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 z-50 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
//       ) : (
//         <div className="absolute top-0 left-0 w-full h-1 bg-green-500 z-50" />
//       )}

//       {/* EXPLICIT GLOBAL ERROR BANNER */}
//       {connectionStatus && (
//         <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 bg-red-950 border-2 border-red-500 text-white px-6 py-3 rounded-lg shadow-2xl font-bold animate-in slide-in-from-top-4 flex items-center space-x-3">
//           <AlertCircle className="text-red-500" size={24} />
//           <span>{connectionStatus}</span>
//         </div>
//       )}

//       <Toaster position="top-center" theme="dark" />

//       <MapContainer />
//       <AlertFeed />
//       <CommandCenterSidebar />
//     </main>
//   );
// }



// ============================================================
// app/page.tsx  — Dashboard entry point
// ============================================================
'use client';

import dynamic from 'next/dynamic';
import useWebSocket from '../hooks/useWebSocket';
import { Toaster } from 'sonner';
import { AlertCircle } from 'lucide-react';
import MapErrorBoundary from '../components/error/MapErrorBoundary';

// ── Dynamic imports — SSR disabled (Mapbox requires window) ──
const MapContainer = dynamic(
  () => import('../components/map/MapContainer').then((m) => m.MapContainer),
  {
    ssr: false,
    loading: () => <MapLoadingSkeleton />,
  }
);

const CommandCenterSidebar = dynamic(
  () => import('../components/sidebar/CommandCenterSidebar'),
  { ssr: false }
);

const AlertFeed = dynamic(
  () => import('../components/alerts/AlertFeed'),
  { ssr: false }
);

// ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { isConnected, isSlowNetwork, connectionStatus } = useWebSocket();

  return (
    <main
      className="h-screen w-screen overflow-hidden bg-slate-950 relative"
      role="main"
      aria-label="Live vehicle tracking dashboard"
    >
      {/* ── Network status indicator bar ─────────────────── */}
      <div
        role="status"
        aria-live="polite"
        aria-label={
          !isConnected ? 'Disconnected' :
            isSlowNetwork ? 'Slow network' :
              'Connected'
        }
        className={`
          absolute top-0 left-0 w-full h-1 z-50 transition-colors duration-500
          ${!isConnected ? 'bg-red-600 animate-pulse' :
            isSlowNetwork ? 'bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]' :
              'bg-green-500'}
        `}
      />

      {/* ── Explicit error/status banner ─────────────────── */}
      {connectionStatus && (
        <div
          role="alert"
          aria-live="assertive"
          className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-red-950 border-2 border-red-500 text-white px-6 py-3 rounded-lg shadow-2xl font-bold animate-in slide-in-from-top-4 flex items-center space-x-3 max-w-[90vw] text-center"
        >
          <AlertCircle className="text-red-500 flex-shrink-0" size={20} aria-hidden="true" />
          <span className="text-sm">{connectionStatus}</span>
        </div>
      )}

      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{ style: { maxWidth: '90vw' , marginTop: '72px'} }}
      />

      {/* ── Map — absolute fill so Next.js dynamic() wrapper doesn't collapse height ── */}
      {/*
        WHY the extra div:
        Next.js `dynamic()` renders a plain <div> with no height around the lazy
        component. `<MapContainer>` uses `w-full h-full` internally, but h-full on
        a child of a 0-height parent resolves to 0. Pinning this wrapper to
        `absolute inset-0` makes it fill <main> directly, bypassing the dynamic
        wrapper's auto-height entirely.
      */}
      <div className="absolute inset-0">
        <MapErrorBoundary>
          <MapContainer />
        </MapErrorBoundary>
      </div>

      <AlertFeed />
      <CommandCenterSidebar />
    </main>
  );
}

// ── Skeleton loader ───────────────────────────────────────
function MapLoadingSkeleton() {
  return (
    <div
      className="w-full h-full bg-slate-950 flex flex-col items-center justify-center space-y-6 relative overflow-hidden"
      role="status"
      aria-label="Loading map…"
    >
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-blue-500 via-slate-950 to-slate-950 animate-pulse" />
      <div
        className="w-16 h-16 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin z-10"
        aria-hidden="true"
      />
      <p className="text-slate-400 font-bold z-10 animate-pulse tracking-widest text-sm sr-only">
        Loading map…
      </p>
    </div>
  );
}