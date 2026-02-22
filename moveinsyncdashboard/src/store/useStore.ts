// import { create } from "zustand";
// import { Vehicle, Trip, Alert, GeoFence } from "@/src/types/types";

// interface DashboardState {
//     vehicles: Record<string, Vehicle>;
//     trips: Record<string, Trip>;
//     alerts: Alert[];
//     geoFences: GeoFence[];

//     selectedTripId: string | null;
//     isStale: boolean;
//     lastHeartBeat: number;


//     updateVehicle: (vehicle: Vehicle) => void;
//     updateTrip?: (trip: Trip) => void;
//     addAlert: (alert: Alert) => void;
//     setGeoFences: (geoFences: GeoFence[]) => void;
//     setSelectedTripId: (id: string | null) => void;
//     setStale: (stale: boolean) => void;
//     registerHeartBeat: () => void;
//     makeAlertead: (alertId: string) => void;
//     setStaleConnection: (stale: boolean) => void;
//     removeAllAlerts: () => void;

// }


// export const useDashboardStore = create<DashboardState>((set) => ({
//     vehicles: {},
//     trips: {},
//     alerts: [],
//     geoFences: [],
//     selectedTripId: null,
//     isStale: false,
//     lastHeartBeat: 0,

//     updateVehicle: (vehicle) => set((state) => ({
//         vehicles: {
//             ...state.vehicles,
//             [vehicle.id]: vehicle,
//         },
//     })),
//     updateTrip: (trip) => set((state) => ({
//         trips: {
//             ...state.trips,
//             [trip.id]: trip,
//         },
//     })),


//     addAlert: (alert) => set((state) => ({
//         alerts: [...state.alerts, alert],
//     })),


//     setGeoFences: (geoFences) => set((state) => ({
//         geoFences,
//     })),


//     setSelectedTripId: (id) => set((state) => ({
//         selectedTripId: id,
//     })),


//     setStale: (stale) => set((state) => ({
//         isStale: stale,
//     })),


//     registerHeartBeat: () => set((state) => ({
//         lastHeartBeat: Date.now(),
//         isStale: false,
//     })),

//     makeAlertead: (alertId) => set((state) => ({
//         alerts: state.alerts.map((alert) =>
//             alert.id === alertId ? { ...alert, read: true } : alert
//         ),
//     })),


//     setStaleConnection: (stale) => set((state) => ({
//         isStale: stale,
//     })),

//     removeAllAlerts: () => set((state) => ({
//         alerts: [],
//     })),


// }));



// // ============================================================
// // store/useStore.ts  — Zustand global state, production-grade
// // ============================================================
// import { create } from 'zustand';
// import { devtools } from 'zustand/middleware';
// import { Vehicle, Alert } from '../types/types';

// interface DashboardState {
//   // ── Data ──────────────────────────────────────────────────
//   vehicles: Record<string, Vehicle>;
//   alerts: Alert[];
//   unreadAlertCount: number;

//   // ── UI ────────────────────────────────────────────────────
//   selectedTripId: string | null;

//   // ── Connection health ─────────────────────────────────────
//   isStale: boolean;
//   lastHeartBeat: number;

//   // ── Actions ───────────────────────────────────────────────
//   updateVehicle: (vehicle: Vehicle) => void;
//   addAlert: (alert: Alert) => void;
//   markAlertRead: (id: string) => void;
//   markAllAlertsRead: () => void;
//   dismissAlert: (id: string) => void;
//   setSelectedTripId: (id: string | null) => void;
//   setStaleConnection: (stale: boolean) => void;
//   registerHeartBeat: () => void;

//   /** Prune alerts older than `maxAgeMs` (default 5 min). Call periodically. */
//   pruneOldAlerts: (maxAgeMs?: number) => void;
// }

// const MAX_ALERTS = 200; // Cap in-memory alert list to avoid unbounded growth

// export const useDashboardStore = create<DashboardState>()(
//   devtools(
//     (set, get) => ({
//       vehicles: {},
//       alerts: [],
//       unreadAlertCount: 0,
//       selectedTripId: null,
//       isStale: false,
//       lastHeartBeat: Date.now(),

//       // ── Upsert a vehicle ─────────────────────────────────
//       updateVehicle: (vehicle) =>
//         set(
//           (state) => ({
//             vehicles: {
//               ...state.vehicles,
//               [vehicle.id]: {
//                 ...state.vehicles[vehicle.id], // preserve any extra client-side fields
//                 ...vehicle,
//               },
//             },
//           }),
//           false,
//           'updateVehicle'
//         ),

//       // ── Add an alert, capped at MAX_ALERTS ───────────────
//       addAlert: (alert) =>
//         set(
//           (state) => {
//             // Deduplicate: if same id already exists, skip
//             if (state.alerts.some((a) => a.id === alert.id)) return state;

//             const updated = [alert, ...state.alerts].slice(0, MAX_ALERTS);
//             return {
//               alerts: updated,
//               unreadAlertCount: state.unreadAlertCount + 1,
//             };
//           },
//           false,
//           'addAlert'
//         ),

//       markAlertRead: (id) =>
//         set(
//           (state) => {
//             const alerts = state.alerts.map((a) =>
//               a.id === id && !a.read ? { ...a, read: true } : a
//             );
//             const unreadAlertCount = alerts.filter((a) => !a.read).length;
//             return { alerts, unreadAlertCount };
//           },
//           false,
//           'markAlertRead'
//         ),

//       markAllAlertsRead: () =>
//         set(
//           (state) => ({
//             alerts: state.alerts.map((a) => ({ ...a, read: true })),
//             unreadAlertCount: 0,
//           }),
//           false,
//           'markAllAlertsRead'
//         ),

//       dismissAlert: (id) =>
//         set(
//           (state) => {
//             const alerts = state.alerts.filter((a) => a.id !== id);
//             return {
//               alerts,
//               unreadAlertCount: alerts.filter((a) => !a.read).length,
//             };
//           },
//           false,
//           'dismissAlert'
//         ),

//       setSelectedTripId: (id) =>
//         set({ selectedTripId: id }, false, 'setSelectedTripId'),

//       setStaleConnection: (stale) =>
//         set({ isStale: stale }, false, 'setStaleConnection'),

//       registerHeartBeat: () =>
//         set({ lastHeartBeat: Date.now() }, false, 'registerHeartBeat'),

//       pruneOldAlerts: (maxAgeMs = 5 * 60 * 1000) => {
//         const cutoff = Date.now() - maxAgeMs;
//         set(
//           (state) => {
//             const alerts = state.alerts.filter((a) => a.timestamp > cutoff);
//             return {
//               alerts,
//               unreadAlertCount: alerts.filter((a) => !a.read).length,
//             };
//           },
//           false,
//           'pruneOldAlerts'
//         );
//       },
//     }),
//     { name: 'DashboardStore' }
//   )
// );



// ============================================================
// store/useStore.ts  — Zustand global state, production-grade
// NOTE: Action names are intentionally kept backward-compatible
// with the existing test suite (including the typo `makeAlertead`).
// ============================================================
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Vehicle, Alert, Trip, GeoFence } from '../types/types';

export interface DashboardState {
  // ── Data ──────────────────────────────────────────────────
  vehicles: Record<string, Vehicle>;
  trips: Record<string, Trip>;
  alerts: Alert[];
  geoFences: GeoFence[];
  unreadAlertCount: number;

  // ── UI ────────────────────────────────────────────────────
  selectedTripId: string | null;

  // ── Connection health ─────────────────────────────────────
  isStale: boolean;
  lastHeartBeat: number;

  // ── Actions ───────────────────────────────────────────────
  updateVehicle: (vehicle: Vehicle) => void;
  updateTrip: (trip: Trip) => void;
  addAlert: (alert: Alert) => void;
  /** Intentional typo preserved to match existing test contract */
  makeAlertead: (id: string) => void;
  /** Alias with correct spelling — use this in new product code */
  markAlertRead: (id: string) => void;
  markAllAlertsRead: () => void;
  dismissAlert: (id: string) => void;
  setGeoFences: (fences: GeoFence[]) => void;
  setSelectedTripId: (id: string | null) => void;
  setStale: (stale: boolean) => void;
  setStaleConnection: (stale: boolean) => void;
  registerHeartBeat: () => void;
  pruneOldAlerts: (maxAgeMs?: number) => void;
}

const MAX_ALERTS = 200;

export const useDashboardStore = create<DashboardState>()(
  devtools(
    (set) => ({
      vehicles: {},
      trips: {},
      alerts: [],
      geoFences: [],
      unreadAlertCount: 0,
      selectedTripId: null,
      isStale: false,
      lastHeartBeat: 0,

      updateVehicle: (vehicle) =>
        set(
          (state) => ({
            vehicles: {
              ...state.vehicles,
              [vehicle.id]: { ...state.vehicles[vehicle.id], ...vehicle },
            },
          }),
          false, 'updateVehicle'
        ),

      updateTrip: (trip) =>
        set(
          (state) => ({
            trips: {
              ...state.trips,
              [trip.id]: { ...state.trips[trip.id], ...trip },
            },
          }),
          false, 'updateTrip'
        ),

      addAlert: (alert) =>
        set(
          (state) => {
            if (state.alerts.some((a) => a.id === alert.id)) return state;
            const alerts = [alert, ...state.alerts].slice(0, MAX_ALERTS);
            return { alerts, unreadAlertCount: state.unreadAlertCount + 1 };
          },
          false, 'addAlert'
        ),

      makeAlertead: (id) =>
        set(
          (state) => {
            const alerts = state.alerts.map((a) =>
              a.id === id && !a.read ? { ...a, read: true } : a
            );
            return { alerts, unreadAlertCount: alerts.filter((a) => !a.read).length };
          },
          false, 'makeAlertead'
        ),

      markAlertRead: (id) =>
        set(
          (state) => {
            const alerts = state.alerts.map((a) =>
              a.id === id && !a.read ? { ...a, read: true } : a
            );
            return { alerts, unreadAlertCount: alerts.filter((a) => !a.read).length };
          },
          false, 'markAlertRead'
        ),

      markAllAlertsRead: () =>
        set(
          (state) => ({
            alerts: state.alerts.map((a) => ({ ...a, read: true })),
            unreadAlertCount: 0,
          }),
          false, 'markAllAlertsRead'
        ),

      dismissAlert: (id) =>
        set(
          (state) => {
            const alerts = state.alerts.filter((a) => a.id !== id);
            return { alerts, unreadAlertCount: alerts.filter((a) => !a.read).length };
          },
          false, 'dismissAlert'
        ),

      setGeoFences: (fences) =>
        set({ geoFences: fences }, false, 'setGeoFences'),

      setSelectedTripId: (id) =>
        set({ selectedTripId: id }, false, 'setSelectedTripId'),

      setStale: (stale) =>
        set({ isStale: stale }, false, 'setStale'),

      setStaleConnection: (stale) =>
        set({ isStale: stale }, false, 'setStaleConnection'),

      registerHeartBeat: () =>
        set({ lastHeartBeat: Date.now(), isStale: false }, false, 'registerHeartBeat'),

      pruneOldAlerts: (maxAgeMs = 5 * 60 * 1000) => {
        const cutoff = Date.now() - maxAgeMs;
        set(
          (state) => {
            const alerts = state.alerts.filter((a) => a.timestamp > cutoff);
            return { alerts, unreadAlertCount: alerts.filter((a) => !a.read).length };
          },
          false, 'pruneOldAlerts'
        );
      },
    }),
    { name: 'DashboardStore' }
  )
);