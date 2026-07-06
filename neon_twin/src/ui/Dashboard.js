import { state, trackingStatus } from '../robot/RobotState.js';

const $ = id => document.getElementById(id);

export class Dashboard {
  constructor(actions) {
    this.keys = {};
    this.joy = { x: 0, y: 0, on: false };

    addEventListener('keydown', e => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key === ' ') { this.toggleEstop(); e.preventDefault(); }
      if (e.key.toLowerCase() === 'c') {
        state.camMode = (state.camMode + 1) % 4;
        $('dCam').textContent = ['ORBIT', 'CHASE', 'TOP', 'CINEMA'][state.camMode];
      }
    });
    addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);

    $('estop').onclick = () => this.toggleEstop();

    document.querySelectorAll('.mbtn').forEach(btn => {
      btn.onclick = () => {
        state.mode = btn.dataset.mode;
        document.querySelectorAll('.mbtn').forEach(b =>
          b.classList.toggle('active', b === btn));
        this.log(`MODE → ${state.mode}`, 'w');
        actions.onModeChange(state.mode);
      };
    });

    $('connectBtn').onclick = actions.onConnectClick;

    $('maxLin').oninput = e => { state.limits.lin = +e.target.value; $('vLin').textContent = e.target.value; };
    $('maxAng').oninput = e => { state.limits.ang = +e.target.value; $('vAng').textContent = e.target.value; };

    const zone = $('joyZone'), knob = $('joyKnob');
    const move = e => {
      const r = zone.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const max = r.width / 2 - 25, d = Math.hypot(dx, dy);
      if (d > max) { dx *= max / d; dy *= max / d; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.joy.x = dx / max; this.joy.y = -dy / max;
    };
    const end = () => { this.joy = { x: 0, y: 0, on: false }; knob.style.transform = 'translate(-50%,-50%)'; };
    zone.addEventListener('pointerdown', e => { this.joy.on = true; zone.setPointerCapture(e.pointerId); move(e); });
    zone.addEventListener('pointermove', e => this.joy.on && move(e));
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    this.log('Dashboard ready — sim mode active.');
    this.log('Double-click the floor to set a nav goal.');
  }

  toggleEstop() {
    state.estop = !state.estop;
    $('estop').classList.toggle('armed', state.estop);
    $('estop').textContent = state.estop ? 'STOPPED' : 'E-STOP';
    this.log(state.estop ? 'Emergency stop engaged' : 'E-stop released', state.estop ? 'e' : 'l');
  }

  log(m, c = 'l') {
    const d = $('logInner');
    d.innerHTML += `<div class="${c}">[${new Date().toLocaleTimeString()}] ${m}</div>`;
    while (d.children.length > 8) d.removeChild(d.firstChild);
  }

  setConnected(on) {
    $('statusDot').classList.toggle('ok', on);
    $('statusTxt').textContent = on ? 'Link Active' : 'Offline — Sim Mode';
    $('connectBtn').textContent = on ? 'Sever Link' : 'Establish Link';
    $('connectBtn').classList.toggle('on', on);
    $('camOff').style.display = on ? 'none' : 'block';
  }

  setCameraFrame(dataUrl) { $('camImg').src = dataUrl; }

  readInput() {
    const boost = this.keys['shift'] ? 1.8 : 1;
    let L = 0, A = 0;
    if (this.keys['w'] || this.keys['arrowup']) L += 1;
    if (this.keys['s'] || this.keys['arrowdown']) L -= 1;
    if (this.keys['a'] || this.keys['arrowleft']) A += 1;
    if (this.keys['d'] || this.keys['arrowright']) A -= 1;
    if (this.joy.on) { L = this.joy.y; A = -this.joy.x; }
    state.want.lin = L * state.limits.lin * boost;
    state.want.ang = A * state.limits.ang * boost;
  }

  refresh() {
    const s = state;
    $('dLin').textContent = s.cmd.lin.toFixed(2) + ' m/s';
    $('dAng').textContent = s.cmd.ang.toFixed(2) + ' r/s';
    $('dX').textContent = s.pose.x.toFixed(2);
    $('dY').textContent = s.pose.y.toFixed(2);
    $('dYaw').textContent = (s.pose.yaw * 57.2958).toFixed(1) + '°';
    $('dGoal').textContent = s.goal ? `${s.goal.x.toFixed(1)}, ${s.goal.y.toFixed(1)}` : 'NONE';
    $('dStatus').textContent = s.robotStatus;
    if (s.battery !== null) {
      $('dBatt').textContent = s.battery.toFixed(0) + '%';
      $('battBar').style.width = s.battery + '%';
    }

    const tr = trackingStatus(), el = $('dTrack');
    el.textContent = tr === 'FOLLOWING' ? '◉ FOLLOWING' : tr === 'DETECTED' ? '◎ DETECTED'
                   : tr === 'LOST' ? '⚠ TARGET LOST' : 'NO TARGET';
    el.className = tr === 'FOLLOWING' ? 'following' : tr === 'LOST' ? 'lost'
                 : tr === 'NO TARGET' ? 'none' : '';
    $('dDist').textContent = s.person.visible ? s.person.distance.toFixed(2) + ' m' : '-- m';
    $('dBear').textContent = s.person.visible ? (s.person.bearing * 57.3).toFixed(0) + '°' : '--°';
  }
}
