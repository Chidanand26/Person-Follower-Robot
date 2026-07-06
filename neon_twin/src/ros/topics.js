import { state } from '../robot/RobotState.js';

const pubs = {};
let subs = [];

export function initTopics(ros, names, callbacks) {
  pubs.cmd = new ROSLIB.Topic({
    ros, name: names.cmd, messageType: 'geometry_msgs/msg/Twist',
  });
  pubs.goal = new ROSLIB.Topic({
    ros, name: '/goal_pose', messageType: 'geometry_msgs/msg/PoseStamped',
  });
  pubs.mode = new ROSLIB.Topic({
    ros, name: '/robot_mode', messageType: 'std_msgs/msg/String',
  });

  const sub = (name, messageType, cb, opts = {}) => {
    const t = new ROSLIB.Topic({ ros, name, messageType, ...opts });
    t.subscribe(cb);
    subs.push(t);
  };

  sub(names.odom, 'nav_msgs/msg/Odometry', (m) => {
    const p = m.pose.pose.position, q = m.pose.pose.orientation;
    state.target.x = p.x;
    state.target.y = p.y;
    state.target.yaw = Math.atan2(2 * (q.w * q.z + q.x * q.y),
                                  1 - 2 * (q.y * q.y + q.z * q.z));
  });

  sub(names.scan, 'sensor_msgs/msg/LaserScan', (m) => callbacks.onScan(m));

  sub(names.person, 'geometry_msgs/msg/PointStamped', (m) => {
    state.person.x = m.point.x;
    state.person.y = m.point.y;
    state.person.distance = Math.hypot(m.point.x, m.point.y);
    state.person.bearing = Math.atan2(m.point.y, m.point.x);
    state.person.visible = true;
    state.person.lastSeen = performance.now();
  });

  sub('/robot_status', 'std_msgs/msg/String', (m) => {
    state.robotStatus = m.data;
  });

  sub('/battery_state', 'sensor_msgs/msg/BatteryState', (m) => {
    let p = m.percentage;
    if (p <= 1.001) p *= 100;
    state.battery = p;
  });

  sub(names.cam, 'sensor_msgs/msg/CompressedImage',
      (m) => callbacks.onImage('data:image/jpeg;base64,' + m.data),
      { throttle_rate: 100 });

  sub('/plan', 'nav_msgs/msg/Path',
      (m) => callbacks.onPath(m.poses.map(p => ({
        x: p.pose.position.x, y: p.pose.position.y,
      }))));
}

export function teardownTopics() {
  subs.forEach(t => t.unsubscribe());
  subs = [];
}

export function publishCmdVel() {
  if (!state.connected || !pubs.cmd) return;
  if (state.mode !== 'MANUAL' && !state.estop) return;
  pubs.cmd.publish(new ROSLIB.Message({
    linear:  { x: state.estop ? 0 : state.cmd.lin, y: 0, z: 0 },
    angular: { x: 0, y: 0, z: state.estop ? 0 : state.cmd.ang },
  }));
}

export function publishGoal(x, y) {
  if (!state.connected || !pubs.goal) return;
  pubs.goal.publish(new ROSLIB.Message({
    header: { frame_id: 'map', stamp: { sec: 0, nanosec: 0 } },
    pose: {
      position: { x, y, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
    },
  }));
}

export function publishMode(mode) {
  if (!state.connected || !pubs.mode) return;
  pubs.mode.publish(new ROSLIB.Message({ data: mode }));
}
