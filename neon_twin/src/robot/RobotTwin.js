import * as THREE from 'three';
import { state, trackingStatus } from './RobotState.js';

export class RobotTwin {
  constructor(scene) {
    this.scene = scene;

    this.group = new THREE.Group();
    scene.add(this.group);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: .5, roughness: .5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, .32, .78), bodyMat);
    body.position.y = .34;
    this.group.add(body);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(body.geometry),
      new THREE.LineBasicMaterial({ color: 0x2563eb })
    );
    edges.position.copy(body.position);
    this.group.add(edges);

    this.wheels = [];
    const wGeo = new THREE.CylinderGeometry(.19, .19, .1, 24);
    const wMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x2563eb, emissiveIntensity: .12 });
    [[.38, .42], [.38, -.42], [-.38, .42], [-.38, -.42]].forEach(([x, z]) => {
      const w = new THREE.Mesh(wGeo, wMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, .19, z);
      this.group.add(w);
      this.wheels.push(w);
    });

    const turret = new THREE.Mesh(
      new THREE.CylinderGeometry(.14, .16, .16, 20),
      new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x2563eb, emissiveIntensity: .3 })
    );
    turret.position.y = .68;
    this.group.add(turret);

    this.beam = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, .012, .012),
      new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: .55 })
    );
    this.beam.position.y = .68;
    this.group.add(this.beam);

    this.pulse = new THREE.Mesh(
      new THREE.RingGeometry(.7, .78, 48),
      new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, side: THREE.DoubleSide })
    );
    this.pulse.rotation.x = -Math.PI / 2;
    this.pulse.position.y = .02;
    this.group.add(this.pulse);

    this.MAXPTS = 2000;
    this.lidarGeo = new THREE.BufferGeometry();
    this.lidarGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.MAXPTS * 3), 3));
    this.lidarGeo.setDrawRange(0, 0);
    const lidar = new THREE.Points(this.lidarGeo,
      new THREE.PointsMaterial({ color: 0x16a34a, size: .09, transparent: true, opacity: .95 }));
    lidar.position.y = .68;
    this.group.add(lidar);

    this.person = new THREE.Group();
    const pMat = new THREE.MeshStandardMaterial({
      color: 0x330000, emissive: 0xdc2626, emissiveIntensity: .9,
      transparent: true, opacity: .95,
    });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.18, .6, 8, 16), pMat);
    torso.position.y = .75;
    this.person.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.14, 16, 16), pMat);
    head.position.y = 1.35;
    this.person.add(head);

    this.personRing = new THREE.Mesh(
      new THREE.RingGeometry(.35, .42, 32),
      new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, side: THREE.DoubleSide })
    );
    this.personRing.rotation.x = -Math.PI / 2;
    this.personRing.position.y = .02;
    this.person.add(this.personRing);
    this.person.visible = false;
    this.group.add(this.person);

    this.lockGeo = new THREE.BufferGeometry().setFromPoints(
      [new THREE.Vector3(0, .5, 0), new THREE.Vector3(1, .8, 0)]);
    this.lockLine = new THREE.Line(this.lockGeo,
      new THREE.LineDashedMaterial({ color: 0xdc2626, dashSize: .15, gapSize: .1, transparent: true, opacity: .8 }));
    this.lockLine.visible = false;
    this.group.add(this.lockLine);

    this.goalMarker = new THREE.Group();
    const gRing = new THREE.Mesh(
      new THREE.RingGeometry(.4, .5, 32),
      new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, side: THREE.DoubleSide })
    );
    gRing.rotation.x = -Math.PI / 2;
    gRing.position.y = .02;
    this.goalRing = gRing;
    this.goalMarker.add(gRing);
    const gPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(.03, .03, 2.4, 8),
      new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: .4 })
    );
    gPillar.position.y = 1.2;
    this.goalMarker.add(gPillar);
    this.goalMarker.visible = false;
    scene.add(this.goalMarker);

    this.pathGeo = new THREE.BufferGeometry();
    this.pathGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(500 * 3), 3));
    this.pathGeo.setDrawRange(0, 0);
    scene.add(new THREE.Line(this.pathGeo,
      new THREE.LineBasicMaterial({ color: 0x2563eb, transparent: true, opacity: .7 })));

    this.TRAIL = 600;
    this.trailN = 0;
    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.TRAIL * 3), 3));
    this.trailGeo.setDrawRange(0, 0);
    scene.add(new THREE.Line(this.trailGeo,
      new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: .8 })));
  }

  setScan(msg) {
    const pos = this.lidarGeo.attributes.position.array;
    let n = 0;
    for (let i = 0; i < msg.ranges.length && n < this.MAXPTS; i++) {
      const r = msg.ranges[i];
      if (!isFinite(r) || r <= 0.05 || r > msg.range_max) continue;
      const a = msg.angle_min + i * msg.angle_increment;
      pos[n * 3] = r * Math.cos(a);
      pos[n * 3 + 1] = 0;
      pos[n * 3 + 2] = -r * Math.sin(a);
      n++;
    }
    this.lidarGeo.setDrawRange(0, n);
    this.lidarGeo.attributes.position.needsUpdate = true;
  }

  setPath(points) {
    const pos = this.pathGeo.attributes.position.array;
    const n = Math.min(points.length, 500);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = points[i].x;
      pos[i * 3 + 1] = .04;
      pos[i * 3 + 2] = -points[i].y;
    }
    this.pathGeo.setDrawRange(0, n);
    this.pathGeo.attributes.position.needsUpdate = true;
  }

  update(dt, t) {
    const k = Math.min(1, dt * 10), s = state;
    s.pose.x += (s.target.x - s.pose.x) * k;
    s.pose.y += (s.target.y - s.pose.y) * k;
    let dyaw = s.target.yaw - s.pose.yaw;
    while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
    while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
    s.pose.yaw += dyaw * k;

    this.group.position.set(s.pose.x, 0, -s.pose.y);
    this.group.rotation.y = s.pose.yaw;

    const tracking = trackingStatus();
    const showPerson = s.person.visible && tracking !== 'NO TARGET';
    this.person.visible = showPerson;
    this.lockLine.visible = showPerson && tracking === 'FOLLOWING';
    if (showPerson) {
      const px = s.person.x, pz = -s.person.y;
      this.person.position.set(px, 0, pz);
      this.personRing.material.color.set(tracking === 'FOLLOWING' ? 0x16a34a : 0xdc2626);
      const pr = 1 + Math.sin(t * 5) * .2;
      this.personRing.scale.set(pr, pr, pr);
      const lp = this.lockGeo.attributes.position.array;
      lp[3] = px; lp[4] = .8; lp[5] = pz;
      this.lockGeo.attributes.position.needsUpdate = true;
      this.lockLine.computeLineDistances();
    }

    this.goalMarker.visible = !!s.goal;
    if (s.goal) {
      this.goalMarker.position.set(s.goal.x, 0, -s.goal.y);
      const gs = 1 + Math.sin(t * 4) * .15;
      this.goalRing.scale.set(gs, gs, gs);
    }

    const tp = this.trailGeo.attributes.position.array;
    const lx = tp[(this.trailN - 1) * 3], lz = tp[(this.trailN - 1) * 3 + 2];
    const gx = this.group.position.x, gz = this.group.position.z;
    if (this.trailN === 0 || Math.hypot(gx - lx, gz - lz) > .08) {
      if (this.trailN >= this.TRAIL) { tp.copyWithin(0, 3); this.trailN = this.TRAIL - 1; }
      tp[this.trailN * 3] = gx;
      tp[this.trailN * 3 + 1] = .05;
      tp[this.trailN * 3 + 2] = gz;
      this.trailN++;
      this.trailGeo.setDrawRange(0, this.trailN);
      this.trailGeo.attributes.position.needsUpdate = true;
    }

    this.beam.rotation.y = t * 7;
    this.wheels.forEach(w => w.rotation.y += s.cmd.lin * dt * 6);
    const ps = 1 + Math.sin(t * 4) * .18;
    this.pulse.scale.set(ps, ps, ps);
    this.pulse.material.opacity = .5 + Math.sin(t * 4) * .3;
  }
}
