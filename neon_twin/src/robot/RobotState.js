export const state = {
  connected: false,
  estop: false,
  mode: 'MANUAL',
  target: { x: 0, y: 0, yaw: 0 },
  pose:   { x: 0, y: 0, yaw: 0 },
  want: { lin: 0, ang: 0 },
  cmd:  { lin: 0, ang: 0 },
  limits: { lin: 0.6, ang: 1.5 },
  person: {
    visible: false,
    x: 0, y: 0,
    distance: 0,
    bearing: 0,
    lastSeen: 0,
  },
  goal: null,
  battery: null,
  robotStatus: '—',
  camMode: 0,
};

export function trackingStatus() {
  if (!state.person.visible) return 'NO TARGET';
  if (performance.now() - state.person.lastSeen > 1000) return 'LOST';
  return state.mode === 'PERSON_FOLLOW' ? 'FOLLOWING' : 'DETECTED';
}
