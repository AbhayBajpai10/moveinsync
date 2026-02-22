// 'use client';

// import { useState } from 'react';
// import { useDashboardStore } from '../../store/useStore';
// import { Bell, AlertCircle, MapPin, ShieldAlert, CheckCircle2, X } from 'lucide-react';

// export default function AlertFeed() {
//   const [isOpen, setIsOpen] = useState(false);
//   const { alerts, setSelectedTripId, removeAllAlerts } = useDashboardStore();
  
//   // To manage "read" state locally without rewriting your Zustand store
//   const [readAlertIds, setReadAlertIds] = useState<Set<string>>(new Set());

//   const unreadCount = alerts.filter(a => !readAlertIds.has(a.id)).length;

//   const handleAlertClick = (vehicleId: string | undefined, alertId: string) => {
//     if(!vehicleId) return;
//     setSelectedTripId(vehicleId);
//     setReadAlertIds(prev => new Set(prev).add(alertId));
//     setIsOpen(false); // Close dropdown on click
//   };

//   const clearAllAlerts = () => {
    
//     setReadAlertIds(new Set());
//     removeAllAlerts();
//   };

//   const markAllAsRead = () => {
//     setReadAlertIds(new Set(alerts.map(a => a.id)));
//   };

//   const getAlertIcon = (type: string | undefined) => {
//     if(!type) return <ShieldAlert className="text-amber-500" size={18} />;
//     if (type.includes('geofence')) return <MapPin className="text-blue-500" size={18} />;
//     if (type.includes('speed')) return <AlertCircle className="text-red-500" size={18} />;
//     return <ShieldAlert className="text-amber-500" size={18} />; // Manual closure discrepancy
//   };

//   return (
//     <div className="absolute top-4 right-48 z-20">
//       {/* Bell Button with Badge */}
//       <button 
//         onClick={() => setIsOpen(!isOpen)}
//         className="relative bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-700 hover:bg-slate-800 transition-all"
//       >
//         <Bell size={20} />
//         {unreadCount > 0 && (
//           <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full animate-pulse border-2 border-slate-900">
//             {unreadCount > 99 ? '99+' : unreadCount}
//           </span>
//         )}
//       </button>

//       {/* Dropdown History Panel */}
//       {isOpen && (
//         <div className="absolute top-14 right-0 w-80 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[500px]">
//           <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
//             <h3 className="font-bold text-white">Alert History</h3>
//             {unreadCount > 0 && (
//               <button onClick={markAllAsRead} className="text-xs text-blue-400 hover:text-blue-300 flex items-center">
//                 <CheckCircle2 size={14} className="mr-1" /> Mark all read
//               </button>
//             )}
//             <button onClick={clearAllAlerts} className="text-xs text-red-400 hover:text-red-300 flex items-center">
//               <X size={14} className="mr-1" /> Clear all
//             </button>
//           </div>
          
//           <div className="overflow-y-auto flex-1 p-2 space-y-2">
//             {alerts.length === 0 ? (
//               <div className="p-4 text-center text-slate-500 text-sm">No alerts yet.</div>
//             ) : (
//               // Show newest alerts first
//               [...alerts].reverse().map((alert) => {
//                 const isUnread = !readAlertIds.has(alert.id);
//                 return (
//                   <div 
//                     key={alert.id}
//                     onClick={() => handleAlertClick(alert.vehicleId, alert.id)}
//                     className={`p-3 rounded-md border cursor-pointer transition-colors flex items-start space-x-3 ${
//                       isUnread 
//                         ? 'bg-slate-900 border-slate-700 hover:border-blue-500' 
//                         : 'bg-slate-950 border-transparent opacity-60 hover:opacity-100'
//                     }`}
//                   >
//                     <div className="mt-1">{getAlertIcon(alert.type)}</div>
//                     <div>
//                       <p className={`text-sm ${isUnread ? 'text-white font-semibold' : 'text-slate-300'}`}>
//                         {alert.message}
//                       </p>
//                       <p className="text-xs text-slate-500 mt-1">
//                         {new Date(alert.timestamp).toLocaleTimeString()}
//                       </p>
//                     </div>
//                     {isUnread && <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />}
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }




// ============================================================
// components/alerts/AlertFeed.tsx
// ============================================================
'use client';

import { useState, useCallback } from 'react';
import { useDashboardStore } from '../../store/useStore';
import { isCriticalAlert, isGeofenceAlert, type Alert } from '../../types/types';
import { Bell, X, CheckCheck, MapPin, AlertTriangle, Gauge, Zap } from 'lucide-react';

export default function AlertFeed() {
  const { alerts, unreadAlertCount, markAlertRead, markAllAlertsRead, dismissAlert, setSelectedTripId } =
    useDashboardStore();

  const [isOpen, setIsOpen] = useState(false);

  const handleAlertClick = useCallback(
    (alert: Alert) => {
      markAlertRead(alert.id);
      if (alert.vehicleId) setSelectedTripId(alert.vehicleId);
      setIsOpen(false);
    },
    [markAlertRead, setSelectedTripId]
  );

  const handleDismiss = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      dismissAlert(id);
    },
    [dismissAlert]
  );

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
      {/* Bell trigger */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="relative bg-slate-900 border border-slate-700 text-white p-3 rounded-lg shadow-xl hover:bg-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Alerts — ${unreadAlertCount} unread`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell size={18} aria-hidden="true" />
        {unreadAlertCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
            aria-hidden="true"
          >
            {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Alert feed"
          aria-modal="false"
          className="absolute top-12 left-1/2 -translate-x-1/2 w-[340px] max-w-[90vw] bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
            <h2 className="text-white font-bold text-sm">Live Alerts</h2>
            <div className="flex items-center gap-2">
              {unreadAlertCount > 0 && (
                <button
                  onClick={markAllAlertsRead}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 focus:outline-none focus:underline"
                  aria-label="Mark all alerts as read"
                >
                  <CheckCheck size={14} aria-hidden="true" />
                  All read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-0.5"
                aria-label="Close alert feed"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Alert list */}
          <ul
            role="list"
            aria-label="Alerts"
            aria-live="polite"
            className="max-h-[400px] overflow-y-auto divide-y divide-slate-800/50"
          >
            {alerts.length === 0 ? (
              <li className="text-center text-slate-500 py-8 text-sm" role="status">
                No alerts yet
              </li>
            ) : (
              alerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  onClick={handleAlertClick}
                  onDismiss={handleDismiss}
                />
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Alert row sub-component ───────────────────────────────
function AlertRow({
  alert,
  onClick,
  onDismiss,
}: {
  alert: Alert;
  onClick: (a: Alert) => void;
  onDismiss: (e: React.MouseEvent, id: string) => void;
}) {
  const critical  = isCriticalAlert(alert.type);
  const geofence  = isGeofenceAlert(alert.type);

  const Icon = critical ? AlertTriangle : geofence ? MapPin : alert.type === 'SPEED_VIOLATION' ? Gauge : Zap;
  const iconColor = critical
    ? 'text-red-400'
    : geofence
    ? 'text-blue-400'
    : 'text-orange-400';

  return (
    <li
      role="listitem"
      className={`
        group flex items-start gap-3 px-4 py-3 cursor-pointer
        hover:bg-slate-900 transition-colors
        ${!alert.read ? 'bg-slate-900/60' : ''}
      `}
      onClick={() => onClick(alert)}
      onKeyDown={(e) => e.key === 'Enter' && onClick(alert)}
      tabIndex={0}
      aria-label={`${alert.message}${!alert.read ? ' — unread' : ''}`}
    >
      {/* Unread dot */}
      <div className="mt-1 flex-shrink-0 w-4 flex items-center justify-center">
        {!alert.read && (
          <span
            className="w-2 h-2 rounded-full bg-blue-500"
            aria-hidden="true"
          />
        )}
      </div>

      <Icon
        size={16}
        className={`${iconColor} flex-shrink-0 mt-0.5`}
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        <p className={`text-sm ${alert.read ? 'text-slate-400' : 'text-white font-medium'} truncate`}>
          {alert.message}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {new Date(alert.timestamp).toLocaleTimeString()}
        </p>
        {alert.vehicleId && (
          <p className="text-xs text-blue-400 mt-0.5 flex items-center gap-1">
            <MapPin size={10} aria-hidden="true" />
            Tap to locate
          </p>
        )}
      </div>

      <button
        onClick={(e) => onDismiss(e, alert.id)}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-500 hover:text-white transition-all p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 flex-shrink-0"
        aria-label="Dismiss alert"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </li>
  );
}