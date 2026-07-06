import { state } from '../robot/RobotState.js';

export class Simulator {
  constructor(twin) {
    this.twin = twin;
    this.scanTimer = 0;
    this.personAngle = 0;
  }

  update(dt, t) {
    const s = state;

    this.personAngle += dt * 0.25;
    const pwx = Math.cos(this.personAngle) * 4;
    const pwy = Math.sin(this.personAngle) * 4;

    const dx = pwx - s.target.x, dy = pwy - s.target.y;
    const cos = Math.cos(-s.target.yaw), sin = Math.sin(-s.target.yaw);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    const dist = Math.hypot(rx, ry);

    const bearing = Math.atan2(ry, rx);
    if (dist < 6 && Math.abs(bearing) < 0.9) {
      s.person.x = rx; s.person.y = ry;
      s.person.distance = dist; s.person.bearing = bearing;
      s.person.visible = true; s.person.lastSeen = performance.now();
    } else {
      s.person.visible = false;
    }

    let lin = 0, ang = 0;
    if (s.mode === 'MANUAL') {
      lin = s.cmd.lin; ang = s.cmd.ang;
    } else if (s.mode === 'PERSON_FOLLOW' && s.person.visible) {
      const KEEP = 1.2;
      ang = 1.5 * bearing;
      lin = Math.max(0, Math.min(0.8, 0.6 * (dist - KEEP)));
      s.robotStatus = `SIM: FOLLOWING @${dist.toFixed(1)}m`;
    } else if (s.mode === 'AUTONOMOUS_NAV' && s.goal) {
      const gdx = s.goal.x - s.target.x, gdy = s.goal.y - s.target.y;
      const gDist = Math.hypot(gdx, gdy);
      let gBear = Math.atan2(gdy, gdx) - s.target.yaw;
      while (gBear > Math.PI) gBear -= 2 * Math.PI;
      while (gBear < -Math.PI) gBear += 2 * Math.PI;
      if (gDist > 0.15) {
        ang = 2.0 * gBear;
        lin = Math.abs(gBear) < 0.5 ? Math.min(0.8, gDist) : 0;
        s.robotStatus = `SIM: NAV ${gDist.toFixed(1)}m TO GOAL`;
        this.twin.setPath([{ x: s.target.x, y: s.target.y }, s.goal]);
      } else {
        s.goal = null;
        this.twin.setPath([]);
        s.robotStatus = 'SIM: GOAL REACHED ✔';
      }
    }
    if (s.estop || s.mode === 'STOP') { lin = 0; ang = 0; }
    if (s.mode !== 'MANUAL') { s.cmd.lin = lin; s.cmd.ang = ang; }

    s.target.yaw += ang * dt;
    s.target.x += lin * Math.cos(s.target.yaw) * dt;
    s.target.y += lin * Math.sin(s.target.yaw) * dt;

    this.scanTimer += dt;
    if (this.scanTimer > 0.2) {
      this.scanTimer = 0;
      const N = 180, ranges = [];
      for (let i = 0; i < N; i++) {
        const a = -Math.PI + i * (2 * Math.PI / N), ga = s.target.yaw + a;
        const cdx = Math.cos(ga), cdy = Math.sin(ga);
        const b = s.target.x * cdx + s.target.y * cdy;
        const disc = b * b - (s.target.x ** 2 + s.target.y ** 2 - 81);
        ranges.push(disc < 0 ? Infinity : (-b + Math.sqrt(disc)) + (Math.random() - .5) * .1);
      }
      this.twin.setScan({ ranges, angle_min: -Math.PI, angle_increment: 2 * Math.PI / N, range_max: 12 });
    }
  }
}
