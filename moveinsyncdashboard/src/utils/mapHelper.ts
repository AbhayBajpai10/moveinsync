// import { Vehicle } from "../types/types";

// export const generateVehicleGeoJSON = (vehicles: Record<string, Vehicle>): GeoJSON.FeatureCollection => {
 

//     return {

//         type: 'FeatureCollection',
//         features: Object.values(vehicles).map((v) => ({
         
//             type: 'Feature',
//             geometry: {
//                 type: 'Point',
//                 coordinates: [v.currentLocation.lng, v.currentLocation.lat]
//             },
//             properties: {
//                 id: v.id,
//                 plateNumber: v.plateNumber,
//                 driverName: v.driverName,
//                 status: v.status,
//                 speed: v.currentSpeed,
//                 etaNextStop: v.etaNextStop
//             }
            
//         }))

//     }

// }


// ============================================================
// utils/mapHelper.ts  — GeoJSON serialization for vehicles
// ============================================================
import { Vehicle } from '../types/types';

export const generateVehicleGeoJSON = (
  vehicles: Record<string, Vehicle>
): GeoJSON.FeatureCollection => {
  return {
    type: 'FeatureCollection',
    features: Object.values(vehicles).map((v) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [v.currentLocation.lng, v.currentLocation.lat],
      },
      properties: {
        id:          v.id,
        tripId:      v.tripId ?? null,
        plateNumber: v.plateNumber,
        driverName:  v.driverName,
        status:      v.status,
        speed:       v.currentSpeed,
        etaNextStop: v.etaNextStop,
        // isArrived is set dynamically by MapContainer based on arrival state
        isArrived:   false,
      },
    })),
  };
};