import { LatLng, AgentLocationUpdate, AgentSimulatorState } from '../types';

/**
 * Predefined route through Pune, Maharashtra covering major landmarks:
 * Shivajinagar → FC Road → Deccan Gymkhana → JM Road → Sambhaji Park →
 * Prabhat Road → Law College Road → Swargate → Pune Station → MG Road →
 * Koregaon Park → Boat Club Road → Bund Garden → Yerawada → Aga Khan Palace →
 * Nagar Road → Viman Nagar → Kalyani Nagar → back toward Shivajinagar
 */
export const PUNE_ROUTE: LatLng[] = [
  { lat: 18.5308, lng: 73.8475 }, // Shivajinagar Bus Stand
  { lat: 18.5270, lng: 73.8410 }, // Ferguson College
  { lat: 18.5235, lng: 73.8390 }, // FC Road mid-point
  { lat: 18.5195, lng: 73.8370 }, // Deccan Gymkhana
  { lat: 18.5170, lng: 73.8410 }, // JM Road near Garware Bridge
  { lat: 18.5145, lng: 73.8450 }, // Sambhaji Park
  { lat: 18.5120, lng: 73.8380 }, // Prabhat Road
  { lat: 18.5090, lng: 73.8420 }, // Law College Road
  { lat: 18.5020, lng: 73.8565 }, // Swargate Bus Depot
  { lat: 18.5050, lng: 73.8620 }, // Near Swargate Chowk
  { lat: 18.5120, lng: 73.8680 }, // Pune Railway Station approach
  { lat: 18.5285, lng: 73.8745 }, // Pune Station
  { lat: 18.5330, lng: 73.8800 }, // MG Road
  { lat: 18.5365, lng: 73.8930 }, // Koregaon Park entrance
  { lat: 18.5370, lng: 73.8990 }, // Koregaon Park main road
  { lat: 18.5340, lng: 73.9020 }, // Boat Club Road
  { lat: 18.5310, lng: 73.8880 }, // Bund Garden
  { lat: 18.5450, lng: 73.8920 }, // Yerawada
  { lat: 18.5520, lng: 73.9010 }, // Aga Khan Palace
  { lat: 18.5580, lng: 73.9100 }, // Nagar Road
  { lat: 18.5670, lng: 73.9140 }, // Viman Nagar
  { lat: 18.5530, lng: 73.9050 }, // Kalyani Nagar
  { lat: 18.5420, lng: 73.8800 }, // Heading back west
  { lat: 18.5350, lng: 73.8600 }, // Near Sangamwadi
  { lat: 18.5310, lng: 73.8500 }, // Back toward Shivajinagar
];

const AGENT_ID = 'agent-001';
const TICK_INTERVAL_MS = 2000;

/**
 * Predefined speed for each segment (km/h).
 * Alternates between walking (~5 km/h) and driving (~30-40 km/h)
 * to simulate realistic movement patterns.
 * Length must equal PUNE_ROUTE.length.
 */
const SEGMENT_SPEEDS: number[] = [
  5,   // Walking from Shivajinagar Bus Stand
  32,  // Driving along FC Road
  35,  // Driving FC Road mid
  5,   // Walking around Deccan Gymkhana
  30,  // Driving JM Road
  5,   // Walking near Sambhaji Park
  28,  // Driving Prabhat Road
  33,  // Driving Law College Road
  38,  // Driving to Swargate
  35,  // Driving near Swargate Chowk
  40,  // Driving to Pune Station approach
  36,  // Driving to Pune Station
  30,  // Driving MG Road
  5,   // Walking into Koregaon Park
  5,   // Walking Koregaon Park main road
  28,  // Driving Boat Club Road
  32,  // Driving to Bund Garden
  38,  // Driving to Yerawada
  5,   // Walking near Aga Khan Palace
  35,  // Driving Nagar Road
  40,  // Driving to Viman Nagar
  33,  // Driving to Kalyani Nagar
  36,  // Driving back west
  30,  // Driving near Sangamwadi
  28,  // Driving back toward Shivajinagar
];

let tickCount = 0;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Advances one step along the route and returns the location update.
 * Pure enough to test: given the current tickCount, returns the correct waypoint.
 */
export function tick(): AgentLocationUpdate {
  const index = tickCount % PUNE_ROUTE.length;
  const waypoint = PUNE_ROUTE[index];
  const speed = SEGMENT_SPEEDS[index];

  const update: AgentLocationUpdate = {
    agentId: AGENT_ID,
    latitude: waypoint.lat,
    longitude: waypoint.lng,
    timestamp: new Date().toISOString(),
    speed,
  };

  tickCount++;
  return update;
}

/**
 * Starts the simulator, calling the callback with an AgentLocationUpdate every 2 seconds.
 */
export function start(callback: (update: AgentLocationUpdate) => void): void {
  if (intervalHandle !== null) {
    return; // Already running
  }
  intervalHandle = setInterval(() => {
    const update = tick();
    callback(update);
  }, TICK_INTERVAL_MS);
}

/**
 * Stops the simulator interval.
 */
export function stop(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

/**
 * Returns the current state of the simulator.
 */
export function getState(): AgentSimulatorState {
  return {
    routeWaypoints: PUNE_ROUTE,
    currentIndex: tickCount % PUNE_ROUTE.length,
    agentId: AGENT_ID,
    intervalMs: TICK_INTERVAL_MS,
  };
}

/**
 * Resets the simulator tick count (useful for testing).
 */
export function reset(): void {
  stop();
  tickCount = 0;
}
