import { state } from '../robot/RobotState.js';

let ros = null;

export function connect(url, handlers) {
  ros = new ROSLIB.Ros({ url });
  ros.on('connection', () => {
    state.connected = true;
    state.estop = false;
    handlers.onConnect(ros);
  });
  ros.on('error', () => handlers.onError());
  ros.on('close', () => {
    state.connected = false;
    handlers.onClose();
  });
}

export function disconnect() { if (ros) ros.close(); }
export function isConnected() { return state.connected; }
