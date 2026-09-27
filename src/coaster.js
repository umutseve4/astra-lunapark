/* Astra Park / metre-based, closed-circuit coaster. No runtime dependencies beyond THREE. */
(function () {
  'use strict';

  window.createCoaster = function (THREE, scene) {
    const root = new THREE.Group();
    root.name = 'ORBIT / gravity coaster';
    scene.add(root);
    const TAU = Math.PI * 2;
    const GRAVITY = 9.81;
    const GAUGE = 1.42;
    const WHEELBASE = 2.40;
    const HITCH_REACH = 1.78;
    const HITCH_LENGTH = 0.56;
    const SAMPLE_COUNT = 2400;
    const Y = new THREE.Vector3(0, 1, 0);
    const dummy = new THREE.Object3D();
    const matrix = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    const tmpC = new THREE.Vector3();
    const mod = (v, n) => ((v % n) + n) % n;
    const clamp = THREE.MathUtils.clamp;
    const material = (color, roughness, metalness) => new THREE.MeshStandardMaterial({color, roughness: roughness === undefined ? 0.56 : roughness, metalness: metalness || 0});
    const railMat = material(0xf4754c, 0.29, 0.42);
    const supportMat = material(0x175969, 0.48, 0.42);
    const tieMat = material(0x286b73, 0.48, 0.35);
    const concreteMat = material(0xd8ceae, 0.91);
    const creamMat = material(0xffead0, 0.37, 0.1);
    const bodyMat = material(0xdb493a, 0.36, 0.25);
    const darkMat = material(0x173541, 0.62, 0.12);
    const rubberMat = material(0x21323a, 0.8);
    const chromeMat = material(0xc9d4ce, 0.25, 0.7);
    const goldMat = material(0xffca75, 0.3, 0.45);
    const lampMat = new THREE.MeshStandardMaterial({color: 0xffd199, emissive: 0xffb568, emissiveIntensity: 0.15, roughness: 0.5});

    // A periodic cubic B-spline is C2 everywhere, including its closure.
    // The route has no crossovers, inversions, or vertical tangent singularities.
    const controls = [
      [-25, 3.8, 15.5], [-35.5, 4.0, 12.6], [-39, 8.2, 3.5],
      [-38, 15.5, -10.5], [-30, 23.0, -21.0], [-17, 22.0, -25.0],
      [-4.5, 13.0, -23.0], [3.5, 4.4, -15.0], [3.5, 4.0, -5.0],
      [-3.0, 6.0, 0.0], [-12.0, 8.0, -3.0], [-16.0, 10.0, -12.0],
      [-24.0, 7.0, -13.0], [-26.0, 4.0, -6.0], [-20.0, 5.0, 1.0],
      [-11.0, 7.0, 6.0], [-12.5, 4.8, 15.0],
      [-19.0, 3.8, 15.8]
    ].map(p => new THREE.Vector3(...p));
    function splinePoint(t, out) {
      const v = mod(t, 1) * controls.length;
      const k = Math.floor(v), u = v - k, u2 = u * u, u3 = u2 * u;
      const w = [(1 - 3*u + 3*u2 - u3)/6, (4 - 6*u2 + 3*u3)/6, (1 + 3*u + 3*u2 - 3*u3)/6, u3/6];
      out.set(0, 0, 0);
      for (let j = 0; j < 4; j++) out.addScaledVector(controls[mod(k + j - 1, controls.length)], w[j]);
      return out;
    }

    // Invert a high resolution length table once; all runtime motion is in metres.
    const rawCount = 12000;
    const rawPoints = [], rawLengths = new Float64Array(rawCount + 1);
    for (let i = 0; i <= rawCount; i++) {
      const p = splinePoint(i / rawCount, new THREE.Vector3());
      rawPoints.push(p);
      if (i) rawLengths[i] = rawLengths[i - 1] + p.distanceTo(rawPoints[i - 1]);
    }
    const trackLength = rawLengths[rawCount];
    const step = trackLength / SAMPLE_COUNT;
    const frames = [];
    let rawIndex = 0;
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const distance = i * step;
      while (rawIndex < rawCount - 1 && rawLengths[rawIndex + 1] < distance) rawIndex++;
      const f = (distance - rawLengths[rawIndex]) / (rawLengths[rawIndex + 1] - rawLengths[rawIndex]);
      frames.push({p: rawPoints[rawIndex].clone().lerp(rawPoints[rawIndex + 1], f), t: new THREE.Vector3(), u: new THREE.Vector3(), r: new THREE.Vector3(), c: new THREE.Vector3(), bank: 0});
    }
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      frames[i].t.subVectors(frames[(i + 1) % SAMPLE_COUNT].p, frames[mod(i - 1, SAMPLE_COUNT)].p).normalize();
    }
    const initialUp = Y.clone().addScaledVector(frames[0].t, -Y.dot(frames[0].t)).normalize();
    frames[0].u.copy(initialUp);
    for (let i = 1; i < SAMPLE_COUNT; i++) {
      q.setFromUnitVectors(frames[i - 1].t, frames[i].t);
      frames[i].u.copy(frames[i - 1].u).applyQuaternion(q);
      frames[i].u.addScaledVector(frames[i].t, -frames[i].u.dot(frames[i].t)).normalize();
    }
    const closureUp = frames[SAMPLE_COUNT - 1].u.clone().applyQuaternion(q.setFromUnitVectors(frames[SAMPLE_COUNT - 1].t, frames[0].t));
    const closureRoll = Math.atan2(frames[0].t.dot(tmpA.crossVectors(closureUp, initialUp)), closureUp.dot(initialUp));
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const frame = frames[i];
      frame.u.applyAxisAngle(frame.t, closureRoll * i / SAMPLE_COUNT);
      frame.c.subVectors(frames[(i + 2) % SAMPLE_COUNT].t, frames[mod(i - 2, SAMPLE_COUNT)].t).multiplyScalar(1 / (4 * step));
      const gravityUp = tmpA.copy(Y).addScaledVector(frame.t, -Y.dot(frame.t)).normalize();
      const gravityRight = tmpB.crossVectors(gravityUp, frame.t).normalize();
      const lateralCurvature = frame.c.dot(gravityRight);
      frame.bank = clamp(-Math.atan(10.5 * 10.5 * lateralCurvature / GRAVITY), -0.47, 0.47);
    }
    // Filter the bank angle around the entire periodic circuit.
    for (let pass = 0; pass < 3; pass++) {
      const angles = frames.map(f => f.bank);
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        let total = 0, weight = 0;
        for (let j = -16; j <= 16; j++) { const w = 17 - Math.abs(j); total += angles[mod(i + j, SAMPLE_COUNT)] * w; weight += w; }
        frames[i].bank = total / weight;
      }
    }
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const f = frames[i];
      // Gravity roll reference keeps transported frames upright over crests.
      const gravityUp = tmpA.copy(Y).addScaledVector(f.t, -Y.dot(f.t)).normalize();
      const referenceRoll = Math.atan2(f.t.dot(tmpB.crossVectors(f.u, gravityUp)), f.u.dot(gravityUp));
      f.u.applyAxisAngle(f.t, referenceRoll + f.bank).normalize();
      f.r.crossVectors(f.u, f.t).normalize();
      f.u.crossVectors(f.t, f.r).normalize();
    }

    // Trim brakes look ahead: bound both normal and lateral loads, then propagate
    // braking distance backwards. Include the full train's footprint in the limit.
    const localLimits = new Float64Array(SAMPLE_COUNT);
    const speedLimits = new Float64Array(SAMPLE_COUNT);
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const f = frames[i], normalCurve = f.c.dot(f.u), sideCurve = f.c.dot(f.r);
      let limitSquared = 22 * 22;
      if (normalCurve < -0.00001) limitSquared = Math.min(limitSquared, GRAVITY * Math.max(0.1, f.u.y-0.16) / -normalCurve);
      if (normalCurve > 0.00001) limitSquared = Math.min(limitSquared, GRAVITY * (3.25-f.u.y) / normalCurve);
      if (Math.abs(sideCurve) > 0.00001) limitSquared = Math.min(limitSquared, GRAVITY * (1.45-Math.sign(sideCurve)*f.r.y) / Math.abs(sideCurve));
      localLimits[i] = Math.sqrt(Math.max(16, limitSquared)) * 0.96;
      if (f.p.z > 10 && f.p.y < 6 && f.p.x < -10) localLimits[i] = Math.min(localLimits[i], 7.5);
    }
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      let limit = localLimits[i];
      for (let j = 1; j <= 20; j++) limit = Math.min(limit, localLimits[mod(i-Math.round(j/step), SAMPLE_COUNT)]);
      speedLimits[i] = limit;
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let i = SAMPLE_COUNT-1; i >= 0; i--) {
        const nextLimit = speedLimits[(i+1)%SAMPLE_COUNT];
        speedLimits[i] = Math.min(speedLimits[i], Math.sqrt(nextLimit*nextLimit + 2*3.4*step));
      }
    }
    function allowedSpeed(s) {
      const v = mod(s, trackLength)/step, i = Math.floor(v);
      return THREE.MathUtils.lerp(speedLimits[i], speedLimits[(i+1)%SAMPLE_COUNT], v-i);
    }

    function newSample() { return {p: new THREE.Vector3(), t: new THREE.Vector3(), u: new THREE.Vector3(), r: new THREE.Vector3(), c: new THREE.Vector3()}; }
    function sampleRail(s, out) {
      const index = mod(s, trackLength) / step;
      const i = Math.floor(index), w = index - i;
      const a = frames[i], b = frames[(i + 1) % SAMPLE_COUNT];
      out.p.lerpVectors(a.p, b.p, w);
      out.t.lerpVectors(a.t, b.t, w).normalize();
      out.u.lerpVectors(a.u, b.u, w).normalize();
      out.r.crossVectors(out.u, out.t).normalize();
      out.u.crossVectors(out.t, out.r).normalize();
      out.c.lerpVectors(a.c, b.c, w);
      return out;
    }

    // Explicit circular rail rings preserve gauge through the banked bends.
    function makeRail(offset, drop, radius, mat, segments) {
      const rings = 1200, sides = segments || 8;
      const positions = new Float32Array((rings + 1) * sides * 3);
      const normals = new Float32Array(positions.length);
      const indices = [];
      for (let i = 0; i <= rings; i++) {
        const f = frames[(i * 2) % SAMPLE_COUNT];
        for (let j = 0; j < sides; j++) {
          const theta = j / sides * TAU;
          const nx = Math.cos(theta), ny = Math.sin(theta);
          const n = tmpA.copy(f.r).multiplyScalar(nx).addScaledVector(f.u, ny);
          const p = tmpB.copy(f.p).addScaledVector(f.r, offset).addScaledVector(f.u, drop).addScaledVector(n, radius);
          const k = (i * sides + j) * 3;
          positions[k] = p.x; positions[k+1] = p.y; positions[k+2] = p.z;
          normals[k] = n.x; normals[k+1] = n.y; normals[k+2] = n.z;
          if (i < rings) {
            const a = i*sides+j, b = i*sides+(j+1)%sides, c = a+sides, d = b+sides;
            indices.push(a, b, c, b, d, c);
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.setIndex(indices);
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      root.add(mesh);
      return mesh;
    }
    makeRail(-GAUGE / 2, 0, 0.094, railMat);
    makeRail(GAUGE / 2, 0, 0.094, railMat);
    makeRail(0, -0.48, 0.21, tieMat, 10);

    function instancedBox(count, dimensions, mat) {
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(...dimensions), mat, count);
      mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
      return mesh;
    }
    function setBox(mesh, i, position, quaternion, scale) {
      dummy.position.copy(position); dummy.quaternion.copy(quaternion); dummy.scale.copy(scale || new THREE.Vector3(1, 1, 1));
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    }
    const tieCount = Math.floor(trackLength / 0.72);
    const ties = instancedBox(tieCount, [2.02, 0.14, 0.21], tieMat);
    const railSample = newSample();
    for (let i = 0; i < tieCount; i++) {
      const f = sampleRail(i / tieCount * trackLength, railSample);
      q.setFromRotationMatrix(matrix.makeBasis(f.r, f.u, f.t));
      setBox(ties, i, tmpA.copy(f.p).addScaledVector(f.u, -0.11), q);
    }

    // Paired steel bents, diagonal bracing and visible concrete foundations.
    const supportCount = Math.floor(trackLength / 6.3);
    const supportSegments = [];
    const feet = [];
    const lightPositions = [];
    for (let i = 0; i < supportCount; i++) {
      const f = sampleRail(i / supportCount * trackLength, railSample);
      const horizontalRight = new THREE.Vector3(f.r.x, 0, f.r.z).normalize();
      const top = f.p.clone().addScaledVector(f.u, -0.55);
      const topLeft = top.clone().addScaledVector(horizontalRight, -0.95);
      const topRight = top.clone().addScaledVector(horizontalRight, 0.95);
      const spread = 1.08 + top.y * 0.047;
      const left = new THREE.Vector3(top.x, 0.27, top.z).addScaledVector(horizontalRight, -spread);
      const right = new THREE.Vector3(top.x, 0.27, top.z).addScaledVector(horizontalRight, spread);
      supportSegments.push([left, topLeft, 0.19], [right, topRight, 0.19], [topLeft, topRight, 0.20]);
      if (top.y > 7.5) {
        const lowerLeft = left.clone().lerp(topLeft, 0.32), upperRight = right.clone().lerp(topRight, 0.70);
        const lowerRight = right.clone().lerp(topRight, 0.32), upperLeft = left.clone().lerp(topLeft, 0.70);
        supportSegments.push([lowerLeft, upperRight, 0.105], [lowerRight, upperLeft, 0.105]);
      }
      feet.push(left, right);
      lightPositions.push(topLeft.clone().add(new THREE.Vector3(0, 0.36, 0)));
    }
    const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
    const columns = new THREE.InstancedMesh(cylinderGeometry, supportMat, supportSegments.length);
    columns.castShadow = true; columns.receiveShadow = true; root.add(columns);
    function segmentMatrix(a, b, radius, out) {
      tmpA.subVectors(b, a);
      const length = tmpA.length();
      dummy.position.copy(a).add(b).multiplyScalar(0.5);
      dummy.quaternion.setFromUnitVectors(Y, tmpA.multiplyScalar(1 / length));
      dummy.scale.set(radius, length, radius); dummy.updateMatrix();
      out.copy(dummy.matrix);
    }
    supportSegments.forEach((s, i) => { segmentMatrix(s[0], s[1], s[2], matrix); columns.setMatrixAt(i, matrix); });
    const footingMesh = instancedBox(feet.length, [0.92, 0.42, 0.92], concreteMat);
    q.identity(); feet.forEach((p, i) => setBox(footingMesh, i, tmpA.copy(p).setY(0.22), q));
    const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), lampMat, lightPositions.length);
    root.add(lamps);
    lightPositions.forEach((p, i) => { dummy.position.copy(p); dummy.quaternion.identity(); dummy.scale.setScalar(1); dummy.updateMatrix(); lamps.setMatrixAt(i, dummy.matrix); });

    // The front boarding platform follows the nearly level station approach.
    const stationFrame = sampleRail(trackLength - 4.3, newSample());
    const platform = new THREE.Group();
    platform.name = 'ORBIT boarding platform';
    platform.position.copy(stationFrame.p).addScaledVector(stationFrame.r, 2.15);
    platform.position.y = stationFrame.p.y + 0.36;
    platform.rotation.y = Math.atan2(stationFrame.t.x, stationFrame.t.z);
    root.add(platform);
    function box(parent, size, mat, position) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
      m.position.set(...position); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    }
    // Seats, riders and station trim are baked by material to keep draw calls low.
    function bakeByMaterial(parent) {
      parent.updateMatrixWorld(true);
      const inverse = parent.matrixWorld.clone().invert();
      const batches = new Map();
      parent.traverse(child => {
        if (!child.isMesh || child.isInstancedMesh) return;
        let geometry = child.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, child.matrixWorld));
        if (geometry.index) { const indexed = geometry; geometry = geometry.toNonIndexed(); indexed.dispose(); }
        const key = child.material.uuid;
        if (!batches.has(key)) batches.set(key, {mat: child.material, positions: [], normals: [], length: 0});
        const batch = batches.get(key);
        batch.positions.push(geometry.attributes.position.array);
        batch.normals.push(geometry.attributes.normal.array);
        batch.length += geometry.attributes.position.array.length;
        geometry.dispose();
      });
      parent.clear();
      batches.forEach(batch => {
        const positions = new Float32Array(batch.length), normals = new Float32Array(batch.length);
        let offset = 0;
        for (let i = 0; i < batch.positions.length; i++) { positions.set(batch.positions[i], offset); normals.set(batch.normals[i], offset); offset += batch.positions[i].length; }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        const mesh = new THREE.Mesh(geometry, batch.mat); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
      });
    }
    box(platform, [2.2, 0.30, 8.8], creamMat, [0, 0, 0]);
    box(platform, [2.85, 0.24, 9.3], bodyMat, [0, 3.2, 0]);
    box(platform, [2.6, 0.13, 8.9], creamMat, [0, 3.05, 0]);
    [-3.8, 0, 3.8].forEach(z => {
      box(platform, [0.12, 3.05, 0.12], supportMat, [-0.93, 1.51, z]);
      box(platform, [0.12, 3.05, 0.12], supportMat, [0.93, 1.51, z]);
      const legHeight = platform.position.y-0.15;
      box(platform, [0.28, legHeight, 0.28], supportMat, [-0.8, -legHeight/2-0.15, z]);
      box(platform, [0.28, legHeight, 0.28], supportMat, [0.8, -legHeight/2-0.15, z]);
    });
    box(platform, [0.07, 0.08, 8.7], goldMat, [1.03, 1.12, 0]);
    box(platform, [0.07, 0.08, 8.7], goldMat, [1.03, 0.53, 0]);
    for (let i = 0; i < 10; i++) box(platform, [0.055, 1.15, 0.055], goldMat, [1.03, 0.62, -4.25 + i*0.94]);
    const stepRise = (platform.position.y+0.15)/16;
    for (let i = 0; i < 16; i++) {
      const stepHeight = (i+1)*stepRise;
      box(platform, [1.8, stepHeight, 0.37], concreteMat, [0, stepHeight/2-platform.position.y, -4.4-(16-i)*0.37]);
    }
    bakeByMaterial(platform);

    const wheelGeometry = new THREE.CylinderGeometry(0.165, 0.165, 0.13, 12);
    const hubGeometry = new THREE.CylinderGeometry(0.083, 0.083, 0.15, 10);
    const headGeometry = new THREE.SphereGeometry(0.155, 10, 8);
    const hairGeometry = new THREE.SphereGeometry(0.159, 10, 6, 0, TAU, 0, Math.PI * 0.53);
    const skinMats = [material(0xe3ad83), material(0xaf7451), material(0xf1c69b), material(0x85543d)];
    const shirtMats = [material(0x65babe), material(0xf5c050), material(0xe97c82), material(0x7774ab), material(0xf2e6ce)];
    const hairMat = material(0x49372e);
    function makeRider(parent, x, z, variant) {
      const person = new THREE.Group(); person.position.set(x, 0, z); parent.add(person);
      box(person, [0.30, 0.38, 0.24], shirtMats[variant % shirtMats.length], [0, 1.10, 0]);
      box(person, [0.31, 0.13, 0.31], darkMat, [0, 0.86, 0.08]);
      box(person, [0.10, 0.28, 0.10], darkMat, [-0.10, 0.67, 0.18]);
      box(person, [0.10, 0.28, 0.10], darkMat, [0.10, 0.67, 0.18]);
      const head = new THREE.Mesh(headGeometry, skinMats[variant % skinMats.length]); head.position.set(0, 1.43, 0.015); head.castShadow = true; person.add(head);
      const hair = new THREE.Mesh(hairGeometry, hairMat); hair.position.copy(head.position); person.add(hair);
      [-1, 1].forEach(side => {
        const arm = box(person, [0.085, 0.29, 0.085], skinMats[variant % skinMats.length], [side*0.195, 1.04, 0.13]); arm.rotation.x = -0.62;
      });
    }
    function makeCar(index) {
      const car = new THREE.Group(); car.name = 'Car ' + (index + 1); root.add(car);
      box(car, [1.78, 0.20, 3.36], darkMat, [0, 0.40, 0]);
      box(car, [1.94, 0.48, 3.30], bodyMat, [0, 0.72, 0]);
      box(car, [1.79, 0.12, 3.03], creamMat, [0, 0.99, 0]);
      // Passenger well, four individual seats, ivory sides and brass grab rails.
      box(car, [1.52, 0.075, 2.80], darkMat, [0, 1.056, 0]);
      [-1, 1].forEach(side => {
        box(car, [0.14, 0.30, 2.90], creamMat, [side*0.88, 1.06, 0]);
        box(car, [0.02, 0.065, 2.80], goldMat, [side*0.962, 0.72, 0]);
      });
      for (let row = 0; row < 2; row++) {
        const z = row === 0 ? 0.67 : -0.72;
        for (let side = 0; side < 2; side++) {
          const x = side === 0 ? -0.43 : 0.43;
          box(car, [0.65, 0.13, 0.59], darkMat, [x, 1.09, z]);
          box(car, [0.65, 0.53, 0.12], darkMat, [x, 1.34, z-0.28]);
          const riderMount = new THREE.Group(); riderMount.position.y = 0.30; car.add(riderMount);
          makeRider(riderMount, x, z, index*4 + row*2 + side);
        }
        box(car, [1.48, 0.07, 0.07], goldMat, [0, 1.30, z+0.29]);
        box(car, [0.06, 0.33, 0.06], goldMat, [-0.73, 1.15, z+0.29]);
        box(car, [0.06, 0.33, 0.06], goldMat, [0.73, 1.15, z+0.29]);
      }
      box(car, [1.77, 0.28, 0.19], creamMat, [0, 1.08, 1.57]);
      box(car, [1.77, 0.28, 0.19], creamMat, [0, 1.08, -1.57]);
      const frontBadge = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), goldMat); frontBadge.scale.set(1, 0.72, 0.24); frontBadge.position.set(0, 0.78, 1.68); car.add(frontBadge);
      const bogies = [], wheels = [];
      for (let end = 0; end < 2; end++) {
        const bogie = new THREE.Group(); root.add(bogie); bogies.push(bogie);
        box(bogie, [1.70, 0.12, 0.23], chromeMat, [0, 0.25, 0]);
        [-1, 1].forEach(side => {
          const wheel = new THREE.Mesh(wheelGeometry, rubberMat); wheel.position.set(side*GAUGE/2, 0.259, 0); wheel.rotation.z = Math.PI/2; bogie.add(wheel); wheels.push(wheel);
          const hub = new THREE.Mesh(hubGeometry, goldMat); hub.position.copy(wheel.position); hub.rotation.z = Math.PI/2; bogie.add(hub);
          const under = new THREE.Mesh(wheelGeometry, rubberMat); under.position.set(side*GAUGE/2, -0.19, 0); under.scale.setScalar(0.60); under.rotation.z = Math.PI/2; bogie.add(under);
          box(bogie, [0.09, 0.56, 0.17], chromeMat, [side*(GAUGE/2+0.17), 0.04, 0]);
        });
      }
      const jointGeometry = new THREE.SphereGeometry(0.10, 8, 6);
      [-1, 1].forEach(sign => { const joint = new THREE.Mesh(jointGeometry, chromeMat); joint.position.set(0, 0.43, sign*HITCH_REACH); car.add(joint); });
      bakeByMaterial(car);
      return {car, bogies, wheels};
    }
    const cars = Array.from({length: 5}, (_, i) => makeCar(i));
    const couplers = new THREE.InstancedMesh(cylinderGeometry, chromeMat, cars.length - 1);
    couplers.instanceMatrix.setUsage(THREE.DynamicDrawUsage); couplers.castShadow = true; root.add(couplers);

    function newPose() { return {frontS: 0, rearS: 0, front: newSample(), rear: newSample(), center: new THREE.Vector3(), forward: new THREE.Vector3(), up: new THREE.Vector3(), right: new THREE.Vector3(), frontHitch: new THREE.Vector3(), rearHitch: new THREE.Vector3(), quaternion: new THREE.Quaternion()}; }
    function solvePose(frontS, pose) {
      pose.frontS = frontS;
      sampleRail(frontS, pose.front);
      let rearS = frontS - WHEELBASE;
      // Newton solve makes the two bogies a rigid, exactly 2.40 m chord.
      for (let i = 0; i < 4; i++) {
        sampleRail(rearS, pose.rear);
        pose.forward.subVectors(pose.front.p, pose.rear.p);
        const length = pose.forward.length();
        const derivative = pose.forward.dot(pose.rear.t) / length;
        rearS += (length - WHEELBASE) / Math.max(0.65, derivative);
      }
      pose.rearS = rearS;
      sampleRail(rearS, pose.rear);
      pose.forward.subVectors(pose.front.p, pose.rear.p).normalize();
      pose.center.copy(pose.front.p).add(pose.rear.p).multiplyScalar(0.5);
      pose.up.copy(pose.front.u).add(pose.rear.u).normalize();
      pose.right.crossVectors(pose.up, pose.forward).normalize();
      pose.up.crossVectors(pose.forward, pose.right).normalize();
      pose.quaternion.setFromRotationMatrix(matrix.makeBasis(pose.right, pose.up, pose.forward));
      pose.frontHitch.copy(pose.center).addScaledVector(pose.forward, HITCH_REACH).addScaledVector(pose.up, 0.43);
      pose.rearHitch.copy(pose.center).addScaledVector(pose.forward, -HITCH_REACH).addScaledVector(pose.up, 0.43);
      return pose;
    }
    const poses = cars.map(newPose);
    const candidate = newPose();
    function solveTrain(s, result) {
      solvePose(s, result[0]);
      for (let i = 1; i < result.length; i++) {
        const previous = result[i-1];
        let near = 3.32, far = 5.15;
        // The rear branch of this constraint gives ordered cars and a fixed drawbar.
        for (let n = 0; n < 18; n++) {
          const spacing = (near + far) * 0.5;
          solvePose(previous.frontS - spacing, candidate);
          if (candidate.frontHitch.distanceTo(previous.rearHitch) > HITCH_LENGTH) far = spacing;
          else near = spacing;
        }
        solvePose(previous.frontS - (near + far) * 0.5, result[i]);
      }
    }
    let travel = trackLength * 0.63;
    const initialTravel = travel;
    let speed = Math.min(12.0, allowedSpeed(travel));
    let speedMultiplier = 1;
    let wheelAngle = 0;
    let night = false;
    let telemetry = {speedKmh: speed*3.6, height: 0, gForce: 1, lap: 0, distance: travel};
    solveTrain(travel, poses);
    function drawTrain() {
      for (let i = 0; i < cars.length; i++) {
        const car = cars[i], pose = poses[i];
        car.car.position.copy(pose.center); car.car.quaternion.copy(pose.quaternion);
        [pose.front, pose.rear].forEach((frame, end) => {
          car.bogies[end].position.copy(frame.p);
          car.bogies[end].quaternion.setFromRotationMatrix(matrix.makeBasis(frame.r, frame.u, frame.t));
        });
        car.wheels.forEach(wheel => { wheel.rotation.x = wheelAngle; });
        if (i) { segmentMatrix(poses[i-1].rearHitch, pose.frontHitch, 0.058, matrix); couplers.setMatrixAt(i-1, matrix); }
      }
      couplers.instanceMatrix.needsUpdate = true;
    }
    drawTrain();

    function update(dt) {
      let remaining = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.08) * speedMultiplier;
      while (remaining > 0.000001) {
        const h = Math.min(remaining, 1/90);
        let meanSlope = 0;
        // Gravity acts on the whole connected train, including cars still on a hill.
        for (let i = 0; i < poses.length; i++) meanSlope += poses[i].forward.y;
        meanSlope /= poses.length;
        let acceleration = -GRAVITY * meanSlope - 0.12 - 0.0015 * speed * speed;
        if (meanSlope > 0.02 && speed < 7.7) acceleration = Math.max(acceleration, (7.7-speed)*2.3);
        if (speed < 5.3) acceleration = Math.max(acceleration, (5.3-speed)*1.8);
        const lead = poses[0].center;
        const stationBrake = lead.z > 10 && lead.y < 6 && lead.x < -10;
        if (stationBrake && speed > 7.5) acceleration = Math.min(acceleration, -Math.min(6.0, (speed-7.5)*1.7));
        if (speed > 21.0) acceleration = Math.min(acceleration, -(speed-21.0)*2.8);
        const trimLimit = allowedSpeed(travel + speed*h + 1.2);
        if (speed > trimLimit) acceleration = Math.min(acceleration, (trimLimit-speed)*7.5);
        const nextSpeed = Math.max(3, speed + acceleration*h);
        const ds = (speed + nextSpeed)*0.5*h;
        speed = nextSpeed; travel += ds; wheelAngle -= ds/0.165;
        remaining -= h;
      }
      solveTrain(travel, poses);
      drawTrain();
      const lead = poses[0];
      telemetry = {speedKmh: speed*3.6, height: lead.center.y, gForce: lead.front.u.y + speed*speed*lead.front.c.dot(lead.front.u)/GRAVITY, lap: Math.floor((travel-initialTravel)/trackLength), distance: travel};
    }
    function setNight(value) {
      night = !!value;
      lampMat.emissiveIntensity = night ? 2.5 : 0.15;
      railMat.emissive.setHex(night ? 0x642216 : 0x000000);
      railMat.emissiveIntensity = night ? 0.30 : 0;
      goldMat.emissive.setHex(night ? 0x553718 : 0x000000);
      goldMat.emissiveIntensity = night ? 0.25 : 0;
    }
    function getRideCamera() {
      const p = poses[0];
      const position = p.center.clone().addScaledVector(p.up, 2.02).addScaledVector(p.forward, 1.22);
      const ahead = sampleRail(p.frontS + 9.5, newSample());
      return {position, target: ahead.p.clone().addScaledVector(ahead.u, 1.50), up: p.up.clone()};
    }

    let staticDiagnostics = null;
    function validate() {
      if (!staticDiagnostics) {
        let maxFrameStepDeg = 0, minWorldUpDot = 1, minRouteClearance = Infinity, maxGaugeError = 0;
        let minHeight = Infinity, maxHeight = -Infinity, maxCurvature = 0;
        for (let i = 0; i < SAMPLE_COUNT; i++) {
          const f = frames[i], next = frames[(i+1)%SAMPLE_COUNT];
          maxFrameStepDeg = Math.max(maxFrameStepDeg, f.u.angleTo(next.u)*180/Math.PI, f.t.angleTo(next.t)*180/Math.PI);
          minWorldUpDot = Math.min(minWorldUpDot, f.u.y);
          minHeight = Math.min(minHeight, f.p.y); maxHeight = Math.max(maxHeight, f.p.y);
          maxCurvature = Math.max(maxCurvature, f.c.length());
          const a = f.p.clone().addScaledVector(f.r, -GAUGE/2), b = f.p.clone().addScaledVector(f.r, GAUGE/2);
          maxGaugeError = Math.max(maxGaugeError, Math.abs(a.distanceTo(b)-GAUGE));
        }
        // Ignore neighbours within 18 m of rail when testing route separation.
        for (let i = 0; i < SAMPLE_COUNT; i += 16) {
          for (let j = i+16; j < SAMPLE_COUNT; j += 16) {
            const separation = Math.min(j-i, SAMPLE_COUNT-(j-i))*step;
            if (separation < 18) continue;
            minRouteClearance = Math.min(minRouteClearance, frames[i].p.distanceTo(frames[j].p));
          }
        }
        // Audit a full lap, rather than only the pose visible at the instant of inspection.
        const auditPoses = cars.map(newPose);
        let maxCouplerError = 0, maxCarWheelbaseError = 0, minCarCenterDistance = Infinity;
        for (let k = 0; k < 180; k++) {
          solveTrain(trackLength*k/180, auditPoses);
          for (let i = 0; i < auditPoses.length; i++) {
            const p = auditPoses[i];
            maxCarWheelbaseError = Math.max(maxCarWheelbaseError, Math.abs(p.front.p.distanceTo(p.rear.p)-WHEELBASE));
            if (i) {
              maxCouplerError = Math.max(maxCouplerError, Math.abs(auditPoses[i-1].rearHitch.distanceTo(p.frontHitch)-HITCH_LENGTH));
              minCarCenterDistance = Math.min(minCarCenterDistance, auditPoses[i-1].center.distanceTo(p.center));
            }
          }
        }
        staticDiagnostics = {trackLength, railGauge: GAUGE, maxGaugeError, maxCouplerError, minRouteClearance, maxFrameStepDeg, minWorldUpDot, maxCarWheelbaseError, minCarCenterDistance, minHeight, maxHeight, maxCurvature, cars: cars.length, closed: true, closurePositionError: frames[0].p.distanceTo(splinePoint(0, new THREE.Vector3())), method: 'C2 periodic B-spline, arc-length motion, transported banked frames, rigid bogies, fixed-length drawbars'};
      }
      return {...staticDiagnostics, speedKmh: telemetry.speedKmh, distance: travel};
    }
    update(0);
    return {root, update, setNight, setSpeed: value => { speedMultiplier = clamp(Number(value) || 0, 0, 3); }, getTelemetry: () => ({...telemetry}), getRideCamera, validate, trackLength};
  };
})();
