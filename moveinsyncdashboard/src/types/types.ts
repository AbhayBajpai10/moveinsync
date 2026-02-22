// export type TripStatus = 'idle' | 'in-progress' | 'completed' | 'delayed' | 'cancelled';
// export type GeoFenceType = 'office' | 'pickup';

// export interface Trip {
//     id: string;
//     status: TripStatus;
    
// }

// export interface Coordinate{
//     lat: number;
//     lng: number;
// }

// export interface Vehicle {
//     id: string;
//     tripId: string;
//     driverName: string;
//     plateNumber: string;
//     currentLocation: Coordinate;
//     currentSpeed: number;
//     status: TripStatus;
//     etaNextStop: number;
    
// }

// export interface GeoFence{
//     id: string;
//     type: GeoFenceType;
//     name: string;
//     coordinates: Coordinate |  Coordinate[];
//     radius?: number;
    
// }

// export interface Alert{
//     id: string;
//     message: string;
//     timestamp: number;
//     vehicleId?: string;
//     type?: 'geofence' | 'speed' | 'maintenance';
//     read: boolean;
    
// }

// export interface WebSocketPayload {

//     type: 'VEHICLE_UPDATE' | 'TRIP_ALERT' | 'GEOFENCE_EVENT';
//     data: Vehicle | Alert | Trip;
//     timestamp: number;
// }


// ============================================================
// types/types.ts  — Single source of truth for all data shapes
// ============================================================

// export type TripStatus = 'idle' | 'in-progress' | 'completed' | 'delayed' | 'cancelled';
// export type GeoFenceType = 'office' | 'pickup';

// /**
//  * Alert types MUST mirror what the WebSocket server actually sends.
//  * Server sends: 'GEOFENCE_ENTRY', 'SPEED_VIOLATION'
//  * Old code had:  'geofence' | 'speed' | 'maintenance' ← silent mismatch!
//  */
// export type AlertType =
//   | 'GEOFENCE_ENTRY'
//   | 'GEOFENCE_EXIT'
//   | 'SPEED_VIOLATION'
//   | 'MAINTENANCE'
//   | 'TRIP_CLOSED'
//   | 'PICKUP_ARRIVED';

// export interface Trip {
//   id: string;
//   status: TripStatus;
// }

// export interface Coordinate {
//   lat: number;
//   lng: number;
// }

// export interface Vehicle {
//   id: string;
//   tripId?: string;        // optional — not all vehicles have an active trip
//   driverName: string;
//   plateNumber: string;
//   currentLocation: Coordinate;
//   currentSpeed: number;
//   status: TripStatus;
//   etaNextStop: number;
// }

// export interface GeoFence {
//   id: string;
//   type: GeoFenceType;
//   name: string;
//   coordinates: Coordinate | Coordinate[];
//   radius?: number;
// }

// export interface Alert {
//   id: string;
//   message: string;
//   timestamp: number;
//   vehicleId?: string;
//   tripId?: string;
//   type?: AlertType;
//   read: boolean;
// }

// export interface WebSocketPayload {
//   type: 'VEHICLE_UPDATE' | 'TRIP_ALERT' | 'GEOFENCE_EVENT';
//   data: Vehicle | Alert | Trip;
//   timestamp?: number;       // made optional — server doesn't always send it
// }

// // ── Derived helpers ────────────────────────────────────────────────────────

// /** True when the alert type represents a critical / high-severity event */
// export const isCriticalAlert = (type?: AlertType): boolean =>
//   type === 'SPEED_VIOLATION' || type === 'TRIP_CLOSED';

// /** True when the alert type represents a geofence event */
// export const isGeofenceAlert = (type?: AlertType): boolean =>
//   type === 'GEOFENCE_ENTRY' || type === 'GEOFENCE_EXIT';



// ============================================================
// types/types.ts
// ============================================================

export type TripStatus = 'idle' | 'in-progress' | 'completed' | 'delayed' | 'cancelled';
export type GeoFenceType = 'office' | 'pickup';

export type AlertType =
  | 'GEOFENCE_ENTRY'
  | 'GEOFENCE_EXIT'
  | 'SPEED_VIOLATION'
  | 'MAINTENANCE'
  | 'TRIP_CLOSED'
  | 'PICKUP_ARRIVED'
  | 'geofence'
  | 'speed'
  | 'maintenance';

export interface Trip {
  id: string;
  status: TripStatus;
}

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface Vehicle {
  id: string;
  tripId?: string;
  driverName: string;
  plateNumber: string;
  currentLocation: Coordinate;
  currentSpeed: number;
  status: TripStatus;
  etaNextStop: number;
}

export interface GeoFence {
  id: string;
  type: GeoFenceType;
  name: string;
  coordinates: Coordinate | Coordinate[];
  radius?: number;
}

export interface Alert {
  id: string;
  message: string;
  timestamp: number;
  vehicleId?: string;
  tripId?: string;
  type?: AlertType;
  read: boolean;
}

export interface WebSocketPayload {
  type: 'VEHICLE_UPDATE' | 'TRIP_ALERT' | 'GEOFENCE_EVENT';
  data: Vehicle | Alert | Trip;
  timestamp?: number;
}

export const isCriticalAlert = (type?: AlertType): boolean =>
  type === 'SPEED_VIOLATION' || type === 'speed' || type === 'TRIP_CLOSED';

export const isGeofenceAlert = (type?: AlertType): boolean =>
  type === 'GEOFENCE_ENTRY' || type === 'GEOFENCE_EXIT' || type === 'geofence';