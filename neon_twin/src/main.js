import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { state } from './robot/RobotState.js';
import { connect, disconnect } from './ros/connection.js';
import { initTopics, teardownTopics, publishCmdVel, publishGoal, publishMode } from './ros/topics.js';
import { RobotTwin } from './robot/RobotTwin.js';
import { Simulator } from './simulation/Simulator.js';
import { Dashboard } from './ui/Dashboard.js';

const $ = id => document.getElementById(id);

/* ============================ SCENE ============================ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f5f7);
scene.fog = new THREE.FogExp2(0xf4f5f7, 0.022);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .1, 400);
camera.position.set(5, 4, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.18, .6, .9);
composer.addPass(bloom);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.05;

scene.add(new THREE.AmbientLight(0xffffff, 2.1));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(6, 12, 6);
scene.add(key);
const rim = new THREE.DirectionalLight(0xdfe6f0, 0.9);
rim.position.set(-6, 5, -4);
scene.add(rim);

const grid = new THREE.GridHelper(300, 150, 0xc4c9d2, 0xdfe2e8);
grid.material.transparent = true;
grid.material.opacity = .6;
scene.add(grid);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshStandardMaterial({ color: 0xeceef2, metalness: .1, roughness: .9 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.01;
scene.add(floor);

for (let i = 1; i <= 4; i++) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(i * 6 - .04, i * 6 + .04, 128),
    new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: .12, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .005;
  scene.add(ring);
}

/* ============================ MODULES ============================ */
const twin = new RobotTwin(scene);
const sim = new Simulator(twin);
const dashboard = new Dashboard({
  onModeChange: (mode) => publishMode(mode),
  onConnectClick: () => {
    if (state.connected) { disconnect(); return; }
    const url = $('wsUrl').value.trim();
    dashboard.log(`LINKING → ${url} ...`, 'w');
    connect(url, {
      onConnect: (ros) => {
        dashboard.setConnected(true);
        dashboard.log('Connection established');
        initTopics(ros, {
          cmd: $('tCmd').value, odom: $('tOdom').value, scan: $('tScan').value,
          person: $('tPerson').value, cam: $('tCam').value,
        }, {
          onScan: (msg) => twin.setScan(msg),
          onImage: (url) => dashboard.setCameraFrame(url),
          onPath: (pts) => twin.setPath(pts),
        });
        publishMode(state.mode);
      },
      onError: () => dashboard.log('Link error — check rosbridge', 'e'),
      onClose: () => {
        teardownTopics();
        dashboard.setConnected(false);
        dashboard.log('Link terminated — sim mode', 'w');
      },
    });
  },
});

setInterval(publishCmdVel, 100);

/* ============================ CLICK-TO-GOAL ============================ */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener('dblclick', (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(floor)[0];
  if (!hit) return;
  const gx = hit.point.x, gy = -hit.point.z;
  state.goal = { x: gx, y: gy };
  publishGoal(gx, gy);
  dashboard.log(`GOAL SET → (${gx.toFixed(2)}, ${gy.toFixed(2)})`);
  if (state.connected) twin.setPath([]);
});

/* ============================ MAIN LOOP ============================ */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;

  dashboard.readInput();
  if (state.mode === 'MANUAL') {
    state.cmd.lin += (state.want.lin - state.cmd.lin) * Math.min(1, dt * 8);
    state.cmd.ang += (state.want.ang - state.cmd.ang) * Math.min(1, dt * 8);
  }
  if (state.estop || state.mode === 'STOP') { state.cmd.lin = 0; state.cmd.ang = 0; }

  if (!state.connected) sim.update(dt, t);

  twin.update(dt, t);
  dashboard.refresh();

  const rp = twin.group.position;
  if (state.camMode === 0) {
    controls.target.lerp(rp.clone().setY(.4), .06);
    controls.update();
  } else if (state.camMode === 1) {
    const b = new THREE.Vector3(-4.2, 2.6, 0)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), state.pose.yaw).add(rp);
    camera.position.lerp(b, .07);
    camera.lookAt(rp.clone().setY(.5));
  } else if (state.camMode === 2) {
    camera.position.lerp(rp.clone().add(new THREE.Vector3(0, 17, .01)), .07);
    camera.lookAt(rp);
  } else {
    camera.position.lerp(
      new THREE.Vector3(Math.cos(t * .25) * 8, 4.5, Math.sin(t * .25) * 8).add(rp), .05
    );
    camera.lookAt(rp);
  }

  bloom.strength = 0.18;
  composer.render();
}

animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});
