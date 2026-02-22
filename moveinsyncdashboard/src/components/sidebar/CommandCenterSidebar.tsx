// 'use client';

// import { useState, useRef } from 'react';
// import { useDashboardStore } from '../../store/useStore';
// import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
// import { Car, AlertTriangle, Building, MapPin, Menu } from 'lucide-react';
// // 🚀 ENTERPRISE SCALING: Virtualization
// import { useVirtualizer } from '@tanstack/react-virtual';

// export default function CommandCenterSidebar() {
//   const { vehicles, setSelectedTripId } = useDashboardStore();
//   const [statusFilter, setStatusFilter] = useState<string>('all');

//   // Ref for the scrolling container
//   const parentRef = useRef<HTMLDivElement>(null);

//   const vehicleArray = Object.values(vehicles);



//   const activeTrips = vehicleArray.filter(v => v.status === 'in-progress').length;
//   const delayedTrips = vehicleArray.filter(v => v.status === 'delayed').length;
//   const insideOffice = vehicleArray.filter(v => Math.hypot(v.currentLocation.lng - 77.595, v.currentLocation.lat - 12.97) < 0.015).length;
//   const approachingPickup = vehicleArray.filter(v => v.etaNextStop < 5).length;

//   const filteredVehicles = vehicleArray.filter(v => {
//     if (statusFilter === 'all') return true;
//     return v.status === statusFilter;
//   });

//   // 🚀 ENTERPRISE SCALING: Setup Virtualizer
//   // Even if filteredVehicles has 100,000 items, this will only render ~8 DOM nodes at a time!
//   const rowVirtualizer = useVirtualizer({
//     count: filteredVehicles.length,
//     getScrollElement: () => parentRef.current,
//     estimateSize: () => 100, // Approximate height of each card in px
//     overscan: 5, // Render 5 items outside the visible viewport for smooth scrolling
//   });

//   return (
//     <Sheet modal={false}>
//       <SheetTrigger asChild>
//         <button className="absolute top-4 right-4 z-20 bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-700 hover:bg-slate-800 transition-all flex items-center space-x-2">
//           <Menu size={20} />
//           <span className="font-semibold">Command Center</span>
//         </button>
//       </SheetTrigger>

//       <SheetContent side="right" className="w-[400px] bg-slate-950 border-l border-slate-800 text-white p-0 flex flex-col z-30">
//         <SheetHeader className="p-6 border-b border-slate-800 bg-slate-900 shrink-0">
//           <SheetTitle className="text-white text-xl flex items-center">
//             <Car className="mr-2 text-blue-500" />
//             Live Trip Summary
//           </SheetTitle>
//         </SheetHeader>

//         <div className="p-6 space-y-6 shrink-0">
//           <div className="grid grid-cols-2 gap-4">
//             <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-col items-center text-center">
//               <Car className="text-green-500 mb-2" size={24} />
//               <span className="text-2xl font-bold">{activeTrips}</span>
//               <span className="text-xs text-slate-400">Active Trips</span>
//             </div>
//             <div className="bg-slate-900 p-4 rounded-lg border border-red-900/50 flex flex-col items-center text-center">
//               <AlertTriangle className="text-red-500 mb-2" size={24} />
//               <span className="text-2xl font-bold">{delayedTrips}</span>
//               <span className="text-xs text-slate-400">Delayed Trips</span>
//             </div>
//             <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-col items-center text-center">
//               <Building className="text-blue-500 mb-2" size={24} />
//               <span className="text-2xl font-bold">{insideOffice}</span>
//               <span className="text-xs text-slate-400">In Office Zone</span>
//             </div>
//             <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-col items-center text-center">
//               <MapPin className="text-orange-500 mb-2" size={24} />
//               <span className="text-2xl font-bold">{approachingPickup}</span>
//               <span className="text-xs text-slate-400">Approaching</span>
//             </div>
//           </div>

//           <div className="space-y-2">
//             <label className="text-sm font-semibold text-slate-300">Filter by Status</label>
//             <select 
//               className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
//               value={statusFilter}
//               onChange={(e) => setStatusFilter(e.target.value)}
//             >
//               <option value="all">All Trips</option>
//               <option value="in-progress">In Progress</option>
//               <option value="delayed">Delayed</option>
//               <option value="idle">Idle</option>
//             </select>
//           </div>

//           <h3 className="text-sm font-semibold text-slate-300 border-t border-slate-800 pt-4">
//             Active Fleet ({filteredVehicles.length})
//           </h3>
//         </div>

//         {/* 🚀 ENTERPRISE SCALING: The Virtualized Scrolling Container */}
//         <div 
//           ref={parentRef} 
//           className="flex-1 overflow-auto px-6 pb-6"
//         >
//           <div
//             style={{
//               height: `${rowVirtualizer.getTotalSize()}px`,
//               width: '100%',
//               position: 'relative',
//             }}
//           >
//             {rowVirtualizer.getVirtualItems().map((virtualRow) => {
//               const vehicle = filteredVehicles[virtualRow.index];
//               return (
//                 <div
//                   key={virtualRow.index}
//                   style={{
//                     position: 'absolute',
//                     top: 0,
//                     left: 0,
//                     width: '100%',
//                     height: `${virtualRow.size}px`,
//                     transform: `translateY(${virtualRow.start}px)`,
//                     paddingBottom: '12px' 
//                   }}
//                 >
//                   <div 
//                     onClick={() => setSelectedTripId(vehicle.tripId || vehicle.id)}
//                     className="bg-slate-900 border border-slate-800 p-4 rounded-lg cursor-pointer hover:border-blue-500 transition-colors group h-full"
//                   >
//                     <div className="flex justify-between items-start mb-2">
//                       <div>
//                         <h4 className="font-bold group-hover:text-blue-400">{vehicle.driverName}</h4>
//                         <p className="text-xs text-slate-400">ID: {vehicle.tripId || vehicle.id}</p>
//                       </div>
//                       <span className={`text-xs font-bold px-2 py-1 rounded-full ${
//                         vehicle.status === 'delayed' ? 'bg-red-900/50 text-red-400' : 
//                         vehicle.status === 'in-progress' ? 'bg-green-900/50 text-green-400' : 
//                         'bg-slate-800 text-slate-300'
//                       }`}>
//                         {vehicle.status.toUpperCase()}
//                       </span>
//                     </div>

//                     <div className="flex justify-between text-sm text-slate-300 mt-3">
//                       <span>ETA: <strong className="text-white">{vehicle.etaNextStop} mins</strong></span>
//                       <span>Speed: <strong className="text-white">{Math.round(vehicle.currentSpeed)} km/h</strong></span>
//                     </div>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>

//           {filteredVehicles.length === 0 && (
//             <div className="text-center text-slate-500 py-8">
//               No trips match this filter.
//             </div>
//           )}
//         </div>
//       </SheetContent>
//     </Sheet>
//   );
// }




// ============================================================
// components/sidebar/CommandCenterSidebar.tsx
// ============================================================
// 'use client';

// import { useState, useRef, useCallback } from 'react';
// import { useDashboardStore } from '../../store/useStore';
// import {
//   Sheet,
//   SheetContent,
//   SheetHeader,
//   SheetTitle,
//   SheetTrigger,
// } from '@/components/ui/sheet';
// import { Car, AlertTriangle, Building, MapPin, Menu } from 'lucide-react';
// import { useVirtualizer } from '@tanstack/react-virtual';
// import type { TripStatus } from '../../types/types';

// type FilterOption = TripStatus | 'all';

// const STATUS_LABELS: Record<FilterOption, string> = {
//   all: 'All Trips',
//   'in-progress': 'In Progress',
//   delayed: 'Delayed',
//   idle: 'Idle',
//   completed: 'Completed',
//   cancelled: 'Cancelled',
// };

// export default function CommandCenterSidebar() {
//   const { vehicles, setSelectedTripId } = useDashboardStore();
//   const [statusFilter, setStatusFilter] = useState<FilterOption>('all');
//   const [isOpen, setIsOpen] = useState(false);
//   const parentRef = useRef<HTMLDivElement>(null);

//   const vehicleArray = Object.values(vehicles);

//   // ── Stats ───────────────────────────────────────────────
//   const activeTrips = vehicleArray.filter((v) => v.status === 'in-progress').length;
//   const delayedTrips = vehicleArray.filter((v) => v.status === 'delayed').length;
//   const insideOffice = vehicleArray.filter(
//     (v) => Math.hypot(v.currentLocation.lng - 77.595, v.currentLocation.lat - 12.97) < 0.015
//   ).length;
//   const approachingPickup = vehicleArray.filter((v) => v.etaNextStop < 5 && v.status !== 'idle').length;

//   // ── Filtered list ────────────────────────────────────────
//   const filteredVehicles = vehicleArray.filter(
//     (v) => statusFilter === 'all' || v.status === statusFilter
//   );

//   // ── Virtualizer ──────────────────────────────────────────
//   const rowVirtualizer = useVirtualizer({
//     count: filteredVehicles.length,
//     getScrollElement: () => parentRef.current,
//     estimateSize: () => 104, // card height + gap
//     overscan: 5,
//   });

//   const handleVehicleSelect = useCallback(
//     (id: string) => {
//       setSelectedTripId(id);
//       // On mobile, close the sheet after selection so the map is visible
//       if (window.innerWidth < 640) setIsOpen(false);
//     },
//     [setSelectedTripId]
//   );

//   return (
//     <Sheet open={isOpen} onOpenChange={setIsOpen} modal={false}>
//       <SheetTrigger asChild>
//         <button
//           className="absolute top-4 right-4 z-20 bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-700 hover:bg-slate-800 transition-all flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
//           aria-label="Open command center"
//           aria-expanded={isOpen}
//         >
//           <Menu size={20} aria-hidden="true" />
//           <span className="font-semibold text-sm">Command Center</span>
//         </button>
//       </SheetTrigger>

//       {/* ✅ Fix: responsive width — full on mobile, 400px on desktop */}
//       <SheetContent
//         side="right"
//         className="w-full sm:w-[400px] bg-slate-950 border-l border-slate-800 text-white p-0 flex flex-col z-30"
//         aria-label="Live trip command center"
//       >
//         <SheetHeader className="p-6 border-b border-slate-800 bg-slate-900 shrink-0">
//           <SheetTitle className="text-white text-xl flex items-center">
//             <Car className="mr-2 text-blue-500" aria-hidden="true" />
//             Live Trip Summary
//           </SheetTitle>
//         </SheetHeader>

//         <div className="p-6 space-y-6 shrink-0">
//           {/* Stats grid */}
//           <div className="grid grid-cols-2 gap-3" role="region" aria-label="Fleet statistics">
//             <StatCard
//               icon={<Car className="text-green-500" size={22} aria-hidden="true" />}
//               value={activeTrips}
//               label="Active Trips"
//               borderClass="border-slate-800"
//             />
//             <StatCard
//               icon={<AlertTriangle className="text-red-500" size={22} aria-hidden="true" />}
//               value={delayedTrips}
//               label="Delayed Trips"
//               borderClass="border-red-900/50"
//             />
//             <StatCard
//               icon={<Building className="text-blue-500" size={22} aria-hidden="true" />}
//               value={insideOffice}
//               label="In Office Zone"
//               borderClass="border-slate-800"
//             />
//             <StatCard
//               icon={<MapPin className="text-orange-500" size={22} aria-hidden="true" />}
//               value={approachingPickup}
//               label="Approaching"
//               borderClass="border-slate-800"
//             />
//           </div>

//           {/* Filter */}
//           <div className="space-y-2">
//             <label htmlFor="status-filter" className="text-sm font-semibold text-slate-300">
//               Filter by Status
//             </label>
//             <select
//               id="status-filter"
//               className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
//               value={statusFilter}
//               onChange={(e) => setStatusFilter(e.target.value as FilterOption)}
//             >
//               {(Object.keys(STATUS_LABELS) as FilterOption[]).map((s) => (
//                 <option key={s} value={s}>
//                   {STATUS_LABELS[s]}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <h3 className="text-sm font-semibold text-slate-300 border-t border-slate-800 pt-4">
//             Active Fleet ({filteredVehicles.length})
//           </h3>
//         </div>

//         {/* Virtualised list */}
//         <div
//           ref={parentRef}
//           className="flex-1 overflow-auto px-6 pb-6"
//           role="list"
//           aria-label="Vehicle list"
//         >
//           {filteredVehicles.length === 0 ? (
//             <div className="text-center text-slate-500 py-8" role="status">
//               No trips match this filter.
//             </div>
//           ) : (
//             <div
//               style={{
//                 height: `${rowVirtualizer.getTotalSize()}px`,
//                 width: '100%',
//                 position: 'relative',
//               }}
//             >
//               {rowVirtualizer.getVirtualItems().map((virtualRow) => {
//                 const vehicle = filteredVehicles[virtualRow.index];
//                 const id = vehicle.tripId || vehicle.id;
//                 const isCritical = vehicle.status === 'delayed';

//                 return (
//                   <div
//                     key={virtualRow.index}
//                     role="listitem"
//                     style={{
//                       position: 'absolute',
//                       top: 0,
//                       left: 0,
//                       width: '100%',
//                       height: `${virtualRow.size}px`,
//                       transform: `translateY(${virtualRow.start}px)`,
//                       paddingBottom: '12px',
//                     }}
//                   >
//                     <div
//                       onClick={() => handleVehicleSelect(id)}
//                       onKeyDown={(e) => e.key === 'Enter' && handleVehicleSelect(id)}
//                       tabIndex={0}
//                       role="button"
//                       aria-label={`Select ${vehicle.driverName}, ${vehicle.status}, ETA ${vehicle.etaNextStop} minutes`}
//                       className={`
//                         bg-slate-900 border p-4 rounded-lg cursor-pointer
//                         hover:border-blue-500 transition-colors group h-full
//                         focus:outline-none focus:ring-2 focus:ring-blue-500
//                         ${isCritical ? 'border-red-900/60' : 'border-slate-800'}
//                       `}
//                     >
//                       <div className="flex justify-between items-start mb-2">
//                         <div className="min-w-0 flex-1">
//                           <h4 className="font-bold group-hover:text-blue-400 truncate">
//                             {vehicle.driverName}
//                           </h4>
//                           <p className="text-xs text-slate-400 truncate">ID: {id}</p>
//                         </div>
//                         <span
//                           className={`text-xs font-bold px-2 py-1 rounded-full ml-2 flex-shrink-0 ${vehicle.status === 'delayed' ? 'bg-red-900/50 text-red-400' :
//                             vehicle.status === 'in-progress' ? 'bg-green-900/50 text-green-400' :
//                               'bg-slate-800 text-slate-300'
//                             }`}
//                           aria-label={`Status: ${vehicle.status}`}
//                         >
//                           {vehicle.status.toUpperCase()}
//                         </span>
//                       </div>

//                       <div className="flex justify-between text-sm text-slate-300 mt-3">
//                         <span>
//                           ETA:{' '}
//                           <strong className="text-white">{vehicle.etaNextStop} min</strong>
//                         </span>
//                         <span>
//                           Speed:{' '}
//                           <strong className="text-white">{Math.round(vehicle.currentSpeed)} km/h</strong>
//                         </span>
//                       </div>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//         </div>
//       </SheetContent>
//     </Sheet>
//   );
// }

// // ── Sub-component ─────────────────────────────────────────
// function StatCard({
//   icon,
//   value,
//   label,
//   borderClass,
// }: {
//   icon: React.ReactNode;
//   value: number;
//   label: string;
//   borderClass: string;
// }) {
//   return (
//     <div
//       className={`bg-slate-900 p-4 rounded-lg border ${borderClass} flex flex-col items-center text-center`}
//       role="figure"
//       aria-label={`${label}: ${value}`}
//     >
//       {icon}
//       <span className="text-2xl font-bold mt-2">{value}</span>
//       <span className="text-xs text-slate-400 mt-1">{label}</span>
//     </div>
//   );
// }

'use client';

import { useState, useRef, useCallback } from 'react';
import { useDashboardStore } from '../../store/useStore';
import { Car, AlertTriangle, Building, MapPin, Menu } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { TripStatus } from '../../types/types';

type FilterOption = TripStatus | 'all';

const STATUS_LABELS: Record<FilterOption, string> = {
  all: 'All Trips',
  'in-progress': 'In Progress',
  delayed: 'Delayed',
  idle: 'Idle',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function CommandCenterSidebar() {
  const { vehicles, setSelectedTripId } = useDashboardStore();

  const [statusFilter, setStatusFilter] = useState<FilterOption>('all');
  const [isOpen, setIsOpen] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);

  const vehicleArray = Object.values(vehicles);

  // ── Stats ───────────────────────────────────────────────
  const activeTrips = vehicleArray.filter(v => v.status === 'in-progress').length;
  const delayedTrips = vehicleArray.filter(v => v.status === 'delayed').length;
  const insideOffice = vehicleArray.filter(
    v => Math.hypot(v.currentLocation.lng - 77.595, v.currentLocation.lat - 12.97) < 0.015
  ).length;
  const approachingPickup = vehicleArray.filter(
    v => v.etaNextStop < 5 && v.status !== 'idle'
  ).length;

  // ── Filtered vehicles ───────────────────────────────────
  const filteredVehicles = vehicleArray.filter(
    v => statusFilter === 'all' || v.status === statusFilter
  );

  // ── Virtualizer (FIXED) ─────────────────────────────────
  const rowVirtualizer = useVirtualizer({
    count: filteredVehicles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 110, // card height + margin
    overscan: 5,
  });

  const handleVehicleSelect = useCallback(
    (id: string) => {
      setSelectedTripId(id);
      if (window.innerWidth < 640) setIsOpen(false);
    },
    [setSelectedTripId]
  );

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(true)}
        className="absolute top-4 right-4 z-20 bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-700 hover:bg-slate-800 transition-all flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Open command center"
      >
        <Menu size={20} />
        <span className="font-semibold text-sm">Command Center</span>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-[400px]
        bg-slate-950 border-l border-slate-800 text-white z-30
        transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        aria-label="Live trip command center"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
          <h2 className="text-xl flex items-center">
            <Car className="mr-2 text-blue-500" />
            Live Trip Summary
          </h2>
          <button onClick={() => setIsOpen(false)}>✕</button>
        </div>

        {/* Stats + Filter */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={<Car className="text-green-500" />} value={activeTrips} label="Active Trips" />
            <StatCard icon={<AlertTriangle className="text-red-500" />} value={delayedTrips} label="Delayed Trips" />
            <StatCard icon={<Building className="text-blue-500" />} value={insideOffice} label="In Office Zone" />
            <StatCard icon={<MapPin className="text-orange-500" />} value={approachingPickup} label="Approaching" />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-300">
              Filter by Status
            </label>
            <select
              className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-md p-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FilterOption)}
            >
              {(Object.keys(STATUS_LABELS) as FilterOption[]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <h3 className="text-sm font-semibold text-slate-300 border-t border-slate-800 pt-4">
            Active Fleet ({filteredVehicles.length})
          </h3>
        </div>

        {/* ✅ SCROLL CONTAINER (CRITICAL FIX) */}
        <div
          ref={parentRef}
          className="px-6 pb-6 overflow-auto"
          style={{ height: 'calc(100vh - 360px)' }}
        >
          {filteredVehicles.length === 0 ? (
            <div className="text-center text-slate-500 py-8">
              No trips match this filter.
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
                width: '100%',
              }}
            >
              {rowVirtualizer.getVirtualItems().map(row => {
                const v = filteredVehicles[row.index];
                const id = v.tripId || v.id;
                const critical = v.status === 'delayed';

                return (
                  <div
                    key={row.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${row.start}px)`,
                    }}
                  >
                    <div
                      onClick={() => handleVehicleSelect(id)}
                      className={`bg-slate-900 border p-4 rounded-lg cursor-pointer
                        hover:border-blue-500 transition-colors mb-3
                        ${critical ? 'border-red-900/60' : 'border-slate-800'}`}
                    >
                      <div className="flex justify-between">
                        <div>
                          <h4 className="font-bold">{v.driverName}</h4>
                          <p className="text-xs text-slate-400">ID: {id}</p>
                        </div>
                        <span className={`text-xs px-2 py-2 rounded-full
                          ${v.status === 'delayed'
                            ? 'bg-red-900/50 text-red-400'
                            : v.status === 'in-progress'
                            ? 'bg-green-900/50 text-green-400'
                            : 'bg-slate-800 text-slate-300'}`}
                        >
                          {v.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex justify-between text-sm mt-3">
                        <span>ETA: <strong>{v.etaNextStop} min</strong></span>
                        <span>Speed: <strong>{Math.round(v.currentSpeed)} km/h</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Stat Card ──────────────────────────────────────────────
function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-col items-center text-center">
      {icon}
      <span className="text-2xl font-bold mt-2">{value}</span>
      <span className="text-xs text-slate-400 mt-1">{label}</span>
    </div>
  );
}