/**
 * Socket.io event type definitions and server-side helper to emit events.
 */

// Event names that the server emits
export const SOCKET_EVENTS = {
  ALERT_CREATED: 'alert:created',
  ALERT_ACKNOWLEDGED: 'alert:acknowledged',
  ALERT_DELETED: 'alert:deleted',
  NETWORK_UPDATE_CHANGED: 'networkUpdate:changed',
  USER_UPDATED: 'user:updated',
  HAZARD_CHANGED: 'hazard:changed',
} as const;

/**
 * Emit a Socket.io event from the server side (called from API routes).
 * Safely no-ops if Socket.io is not initialized (e.g., during build).
 */
export function emitSocketEvent(event: string, data?: any): void {
  const io = (global as any).__io;
  if (io) {
    io.emit(event, data);
  }
}
