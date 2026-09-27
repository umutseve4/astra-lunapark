/* Astra Park — articulated Ferris wheel. THREE r160, no external assets. */
(function () {
  'use strict';

  window.createFerrisWheel = function createFerrisWheel(THREE, scene) {
    const TAU = Math.PI * 2;
    const RADIUS = 14;
    const CENTER_Y = 17;
    const NOMINAL_SPEED = 0.12;
    const GRAVITY = 9.81;
    const PENDULUM_LENGTH = 1.25;
    const CABIN_COUNT = 12;
    const root = new THREE.Group();
    root.name = 'Articulated Ferris wheel';
    root.position.set(20, 0, -7);
    scene.add(root);

    const mat = (color, roughness = 0.58, metalness = 0.15) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const cream = mat(0xf4e2bd, 0.48, 0.28);
    const ivory = mat(0xfff2d8, 0.45, 0.18);
    const teal = mat(0x126f70, 0.42, 0.4);
    const darkTeal = mat(0x16474d, 0.55, 0.35);
    const brass = mat(0xdca64f, 0.37, 0.65);
    const coral = mat(0xee7966, 0.53, 0.18);
    const turquoise = mat(0x64c5b4, 0.53, 0.15);
    const golden = mat(0xeab95f, 0.5, 0.2);
    const wood = mat(0xb99673, 0.86, 0);
    const pavement = mat(0xe4d5b9, 0.96, 0);
    const rubber = mat(0x253e41, 0.9, 0.05);
    const skin = mat(0xd4a785, 0.95, 0);
    const clothes = mat(0x314b58, 0.85, 0);
    const lamp = new THREE.MeshStandardMaterial({ color: 0xffe7ac, emissive: 0xffbd54, emissiveIntensity: 0.55, roughness: 0.25 });
    const redLamp = new THREE.MeshStandardMaterial({ color: 0xffaa87, emissive: 0xf46546, emissiveIntensity: 0.3 });

    function mesh(geometry, material, parent = root, position) {
      const object = new THREE.Mesh(geometry, material);
      if (position) object.position.set(...position);
      object.castShadow = true;
      object.receiveShadow = true;
      parent.add(object);
      return object;
    }

    function box(w, h, d, material, x, y, z, parent = root) {
      return mesh(new THREE.BoxGeometry(w, h, d), material, parent, [x, y, z]);
    }

    const up = new THREE.Vector3(0, 1, 0);
    const tmp = new THREE.Object3D();
    const tempMatrix = new THREE.Matrix4();
    const batchList = [];

    function instance(geometry, material, transforms, parent = root) {
      const object = new THREE.InstancedMesh(geometry, material, transforms.length);
      for (let i = 0; i < transforms.length; i++) object.setMatrixAt(i, transforms[i]);
      object.castShadow = true;
      object.receiveShadow = true;
      parent.add(object);
      return object;
    }

    function transform(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
      tmp.position.set(x, y, z);
      tmp.rotation.set(rx, ry, rz);
      tmp.scale.set(sx, sy, sz);
      tmp.updateMatrix();
      return tmp.matrix.clone();
    }

    function beamMatrix(a, b, radius = 1) {
      const start = new THREE.Vector3(...a);
      const end = new THREE.Vector3(...b);
      const direction = end.clone().sub(start);
      tmp.position.copy(start).add(end).multiplyScalar(0.5);
      tmp.quaternion.setFromUnitVectors(up, direction.clone().normalize());
      tmp.scale.set(radius, direction.length(), radius);
      tmp.updateMatrix();
      return tmp.matrix.clone();
    }

    const beamGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
    const tubeGeometry = new THREE.CylinderGeometry(1, 1, 1, 6);

    // A broad boarding deck, footings, stairs, and separated entrance lanes.
    const deck = mesh(new THREE.CylinderGeometry(8.1, 8.3, 0.4, 12), pavement, root, [0, 0.2, 1.1]);
    deck.scale.z = 0.72;
    const deckTop = mesh(new THREE.CylinderGeometry(7.92, 7.92, 0.06, 12), wood, root, [0, 0.43, 1.1]);
    deckTop.scale.z = 0.72;
    box(4.0, 0.15, 0.72, pavement, 0, 0.075, 7.0);
    box(4.0, 0.28, 0.64, pavement, 0, 0.14, 6.53);
    box(4.0, 0.41, 0.60, pavement, 0, 0.205, 6.09);
    const plankLines = [];
    for (let x = -6.8; x <= 6.8; x += 0.58) {
      const halfDepth = Math.sqrt(Math.max(0, 7.8 * 7.8 - x * x)) * 0.7;
      plankLines.push(transform(x, 0.466, 1.1, 0, 0, 0, 0.025, 0.01, halfDepth * 2));
    }
    instance(new THREE.BoxGeometry(1, 1, 1), pavement, plankLines);

    const mainSupports = [];
    const braces = [];
    for (const zSign of [-1, 1]) {
      const footZ = zSign * 3.35;
      const hubZ = zSign * 1.88;
      for (const side of [-1, 1]) {
        const footX = side * 5.65;
        mainSupports.push(beamMatrix([footX, 0.65, footZ], [0, CENTER_Y, hubZ], 0.36));
        box(1.65, 0.9, 1.7, cream, footX, 0.45, footZ);
        box(1.22, 0.12, 1.26, darkTeal, footX, 0.95, footZ);
        for (const dx of [-0.44, 0.44]) {
          for (const dz of [-0.47, 0.47]) {
            mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.12, 6), brass, root, [footX + dx, 1.065, footZ + dz]);
          }
        }
      }
      braces.push(beamMatrix([-4.45, 4.15, zSign * 3.04], [4.45, 4.15, zSign * 3.04], 0.14));
      braces.push(beamMatrix([-4.25, 4.65, zSign * 2.97], [2.24, 10.55, zSign * 2.47], 0.075));
      braces.push(beamMatrix([4.25, 4.65, zSign * 2.97], [-2.24, 10.55, zSign * 2.47], 0.075));
    }
    instance(beamGeometry, teal, mainSupports);
    instance(beamGeometry, darkTeal, braces);
    const axle = mesh(new THREE.CylinderGeometry(0.37, 0.37, 5.7, 20), brass, root, [0, CENTER_Y, 0]);
    axle.rotation.x = Math.PI / 2;
    for (const z of [-2.2, 2.2]) {
      const bearing = mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.48, 24), teal, root, [0, CENTER_Y, z]);
      bearing.rotation.x = Math.PI / 2;
      const cap = mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.57, 20), cream, root, [0, CENTER_Y, z]);
      cap.rotation.x = Math.PI / 2;
    }

    const rotor = new THREE.Group();
    rotor.name = 'Wheel rotor — only the steelwork rotates';
    rotor.position.y = CENTER_Y;
    root.add(rotor);
    const spokes = [];
    const wireSpokes = [];
    const crossRim = [];
    const lamps = [];
    const boltMatrices = [];
    for (const z of [-1.3, 1.3]) {
      mesh(new THREE.TorusGeometry(RADIUS, 0.205, 8, 144), cream, rotor, [0, 0, z]);
      mesh(new THREE.TorusGeometry(RADIUS - 0.47, 0.066, 6, 144), brass, rotor, [0, 0, z]);
      mesh(new THREE.TorusGeometry(1.12, 0.12, 8, 40), brass, rotor, [0, 0, z]);
      const hub = mesh(new THREE.CylinderGeometry(0.96, 0.96, 0.22, 24), cream, rotor, [0, 0, z]);
      hub.rotation.x = Math.PI / 2;
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * TAU - Math.PI / 2;
        spokes.push(beamMatrix([Math.cos(a) * 0.9, Math.sin(a) * 0.9, z], [Math.cos(a) * RADIUS, Math.sin(a) * RADIUS, z], i % 2 ? 0.055 : 0.095));
        const offset = a + TAU / 24;
        wireSpokes.push(beamMatrix([Math.cos(offset) * 1.1, Math.sin(offset) * 1.1, z], [Math.cos(a) * (RADIUS - 0.47), Math.sin(a) * (RADIUS - 0.47), z], 0.021));
        boltMatrices.push(transform(Math.cos(a) * 0.79, Math.sin(a) * 0.79, z + Math.sign(z) * 0.15));
      }
      for (let i = 0; i < 108; i++) {
        const a = i / 108 * TAU;
        lamps.push(transform(Math.cos(a) * RADIUS, Math.sin(a) * RADIUS, z + Math.sign(z) * 0.21));
      }
    }
    for (let i = 0; i < CABIN_COUNT; i++) {
      const a = i / CABIN_COUNT * TAU - Math.PI / 2;
      crossRim.push(beamMatrix([Math.cos(a) * RADIUS, Math.sin(a) * RADIUS, -1.51], [Math.cos(a) * RADIUS, Math.sin(a) * RADIUS, 1.51], 0.10));
      const a2 = a + TAU / CABIN_COUNT;
      crossRim.push(beamMatrix([Math.cos(a) * (RADIUS - 0.47), Math.sin(a) * (RADIUS - 0.47), -1.3], [Math.cos(a2) * (RADIUS - 0.47), Math.sin(a2) * (RADIUS - 0.47), 1.3], 0.03));
    }
    instance(tubeGeometry, cream, spokes, rotor);
    instance(tubeGeometry, teal, wireSpokes, rotor);
    instance(tubeGeometry, brass, crossRim, rotor);
    instance(new THREE.SphereGeometry(0.105, 6, 5), lamp, lamps, rotor);
    instance(new THREE.SphereGeometry(0.047, 6, 4), darkTeal, boltMatrices, rotor);

    // A visible chain-drive / gearbox sits on the front bearing.
    const gear = new THREE.Group();
    gear.position.set(0, CENTER_Y, 2.61);
    root.add(gear);
    mesh(new THREE.TorusGeometry(0.72, 0.14, 8, 32), brass, gear);
    const teeth = [];
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU;
      teeth.push(transform(Math.cos(a) * 0.83, Math.sin(a) * 0.83, 0, 0, 0, a, 0.2, 0.11, 0.2));
    }
    instance(new THREE.BoxGeometry(1, 1, 1), brass, teeth, gear);
    const motor = box(1.55, 0.78, 0.75, teal, 0.65, 15.5, 2.44);
    motor.rotation.z = -0.1;
    const driveBelt = mesh(new THREE.TorusGeometry(0.8, 0.046, 6, 28), rubber, root, [0.18, 16.13, 2.68]);
    driveBelt.scale.set(0.65, 1.35, 1);

    // Each suspended cabin owns a world-upright pivot transform. Its parts are
    // instanced across all 12 cabins, so detailing does not multiply draw calls.
    const cabins = [];
    let angle = 0.085;
    let angularSpeed = NOMINAL_SPEED;
    let targetSpeed = NOMINAL_SPEED;
    let simulatedSeconds = 0;
    let maxObservedSwing = 0;
    for (let i = 0; i < CABIN_COUNT; i++) {
      const phase = i / CABIN_COUNT * TAU - Math.PI / 2;
      const theta = phase + angle;
      const ax = -RADIUS * Math.cos(theta) * angularSpeed * angularSpeed;
      const ay = -RADIUS * Math.sin(theta) * angularSpeed * angularSpeed;
      const pivot = new THREE.Object3D();
      pivot.name = 'Gravity suspended cabin ' + String(i + 1).padStart(2, '0');
      root.add(pivot);
      cabins.push({ phase, swing: Math.atan2(-ax, GRAVITY + ay), velocity: 0, pivot });
    }

    function cabinBatch(geometry, material, parts, predicate) {
      const entries = [];
      for (let i = 0; i < CABIN_COUNT; i++) {
        if (predicate && !predicate(i)) continue;
        for (const part of parts) entries.push({ cabin: i, matrix: part });
      }
      const object = new THREE.InstancedMesh(geometry, material, entries.length);
      object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      object.castShadow = true;
      object.receiveShadow = true;
      // Cabins travel around the full wheel; a stationary bound cannot follow it.
      object.frustumCulled = false;
      root.add(object);
      batchList.push({ object, entries });
    }

    const colors = [coral, turquoise, golden];
    for (let color = 0; color < colors.length; color++) {
      cabinBatch(new THREE.CylinderGeometry(0.92, 0.79, 0.51, 12), colors[color], [transform(0, -1.84, 0)], i => i % 3 === color);
      cabinBatch(new THREE.CylinderGeometry(0.65, 1.08, 0.31, 12), colors[color], [transform(0, -0.535, 0)], i => i % 3 === color);
    }
    cabinBatch(new THREE.CylinderGeometry(1.08, 1.08, 0.1, 12), ivory, [transform(0, -0.725, 0)]);
    cabinBatch(new THREE.CylinderGeometry(0.87, 0.87, 0.10, 12), cream, [transform(0, -2.105, 0)]);
    cabinBatch(new THREE.TorusGeometry(0.914, 0.035, 6, 24), brass, [transform(0, -1.59, 0, Math.PI / 2)]);
    cabinBatch(new THREE.TorusGeometry(1.07, 0.034, 6, 24), lamp, [transform(0, -0.764, 0, Math.PI / 2)]);
    const uprights = [];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + Math.PI / 6;
      uprights.push(transform(Math.cos(a) * 0.88, -1.175, Math.sin(a) * 0.88));
    }
    cabinBatch(new THREE.CylinderGeometry(0.034, 0.034, 0.93, 6), cream, uprights);
    cabinBatch(new THREE.CylinderGeometry(0.059, 0.059, 0.48, 8), teal, [transform(0, -0.21, -0.56), transform(0, -0.21, 0.56)]);
    cabinBatch(new THREE.SphereGeometry(0.135, 8, 6), brass, [transform(0, 0, -1.3), transform(0, 0, 1.3)]);
    cabinBatch(new THREE.BoxGeometry(1.17, 0.12, 0.3), darkTeal, [transform(0, -1.58, -0.43), transform(0, -1.58, 0.43)]);
    cabinBatch(new THREE.BoxGeometry(1.12, 0.29, 0.08), darkTeal, [transform(0, -1.46, -0.57), transform(0, -1.46, 0.57)]);
    cabinBatch(new THREE.SphereGeometry(0.125, 8, 6), skin, [transform(-0.24, -1.045, -0.35), transform(0.26, -1.045, 0.35)], i => i % 4 !== 0);
    cabinBatch(new THREE.CapsuleGeometry(0.115, 0.25, 3, 6), clothes, [transform(-0.24, -1.365, -0.35), transform(0.26, -1.365, 0.35)], i => i % 4 !== 0);
    cabinBatch(new THREE.CylinderGeometry(0.052, 0.047, 0.30, 6), clothes, [transform(-0.31, -1.73, -0.17), transform(-0.17, -1.73, -0.17), transform(0.19, -1.73, 0.17), transform(0.33, -1.73, 0.17)], i => i % 4 !== 0);

    // Boarding lanes and a compact operator console.
    const queuePosts = [];
    const queueRails = [];
    const postXs = [-3.6, -2.1, 2.1, 3.6];
    for (const x of postXs) {
      for (const z of [4.0, 5.1, 6.0]) {
        queuePosts.push(transform(x, 1.02, z));
      }
      queueRails.push(beamMatrix([x, 1.43, 4.0], [x, 1.43, 6.0], 0.033));
    }
    instance(new THREE.CylinderGeometry(0.047, 0.062, 1.12, 8), teal, queuePosts);
    instance(beamGeometry, brass, queueRails);
    const queueCaps = queuePosts.map(m => {
      const p = new THREE.Vector3().setFromMatrixPosition(m);
      return transform(p.x, 1.60, p.z);
    });
    instance(new THREE.SphereGeometry(0.08, 8, 5), brass, queueCaps);
    box(1.55, 1.35, 1.1, turquoise, -6.4, 1.15, 3.7);
    box(1.76, 0.12, 1.28, cream, -6.4, 1.88, 3.7);
    const controlPanel = box(0.84, 0.10, 0.57, darkTeal, -6.4, 1.99, 3.7);
    controlPanel.rotation.x = 0.16;
    mesh(new THREE.SphereGeometry(0.058, 8, 6), redLamp, root, [-6.14, 2.08, 3.87]);
    mesh(new THREE.SphereGeometry(0.058, 8, 6), lamp, root, [-6.37, 2.08, 3.87]);

    const signCanvas = document.createElement('canvas');
    signCanvas.width = 1024;
    signCanvas.height = 192;
    const ctx = signCanvas.getContext('2d');
    ctx.fillStyle = '#174e51';
    ctx.fillRect(0, 0, 1024, 192);
    ctx.strokeStyle = '#d9b875';
    ctx.lineWidth = 3;
    ctx.strokeRect(13, 13, 998, 166);
    ctx.fillStyle = '#fff0cd';
    ctx.font = '600 80px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('ASTRA WHEEL', 512, 105);
    ctx.font = '22px Arial, sans-serif';
    ctx.fillStyle = '#f2bc74';
    ctx.fillText('A LITTLE CLOSER TO THE STARS', 512, 149);
    const signTexture = new THREE.CanvasTexture(signCanvas);
    signTexture.colorSpace = THREE.SRGBColorSpace;
    const signMaterial = new THREE.MeshStandardMaterial({ map: signTexture, emissiveMap: signTexture, emissive: 0xffffff, emissiveIntensity: 0.04, roughness: 0.8 });
    box(6.6, 1.25, 0.18, brass, 0, 4.2, 3.38);
    mesh(new THREE.PlaneGeometry(6.5, 1.15), signMaterial, root, [0, 4.2, 3.48]);
    const signLights = [];
    for (let i = 0; i < 17; i++) {
      signLights.push(transform(-3.08 + i * 0.385, 4.79, 3.54));
      signLights.push(transform(-3.08 + i * 0.385, 3.61, 3.54));
    }
    instance(new THREE.SphereGeometry(0.051, 6, 5), lamp, signLights);

    const accentLight = new THREE.PointLight(0xffc36c, 0, 24, 2);
    accentLight.position.set(0, 9.5, 5);
    root.add(accentLight);

    function applyTransforms() {
      rotor.rotation.z = angle;
      gear.rotation.z = -angle * 3.5;
      for (const cabin of cabins) {
        const theta = cabin.phase + angle;
        cabin.pivot.position.set(RADIUS * Math.cos(theta), CENTER_Y + RADIUS * Math.sin(theta), 0);
        cabin.pivot.rotation.z = cabin.swing;
        cabin.pivot.updateMatrix();
      }
      for (const batch of batchList) {
        for (let i = 0; i < batch.entries.length; i++) {
          const entry = batch.entries[i];
          tempMatrix.multiplyMatrices(cabins[entry.cabin].pivot.matrix, entry.matrix);
          batch.object.setMatrixAt(i, tempMatrix);
        }
        batch.object.instanceMatrix.needsUpdate = true;
      }
    }

    function update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      const duration = Math.min(dt, 0.1);
      const steps = Math.max(1, Math.ceil(duration / (1 / 120)));
      const step = duration / steps;
      for (let i = 0; i < steps; i++) {
        const oldSpeed = angularSpeed;
        const accelerationLimit = 0.035;
        const change = (targetSpeed - angularSpeed) * (1 - Math.exp(-1.7 * step));
        angularSpeed += THREE.MathUtils.clamp(change, -accelerationLimit * step, accelerationLimit * step);
        const angularAcceleration = (angularSpeed - oldSpeed) / step;
        angle = (angle + angularSpeed * step) % TAU;
        for (const cabin of cabins) {
          const theta = cabin.phase + angle;
          // r'' of the rotating suspension point, including start/stop motion.
          const ax = -RADIUS * (Math.cos(theta) * angularSpeed * angularSpeed + Math.sin(theta) * angularAcceleration);
          const ay = RADIUS * (-Math.sin(theta) * angularSpeed * angularSpeed + Math.cos(theta) * angularAcceleration);
          // A damped physical pendulum in the accelerating pivot's frame.
          const acceleration = -(GRAVITY + ay) / PENDULUM_LENGTH * Math.sin(cabin.swing)
            - ax / PENDULUM_LENGTH * Math.cos(cabin.swing) - 1.35 * cabin.velocity;
          cabin.velocity += acceleration * step;
          cabin.swing += cabin.velocity * step;
          maxObservedSwing = Math.max(maxObservedSwing, Math.abs(cabin.swing));
        }
        simulatedSeconds += step;
      }
      applyTransforms();
    }

    function getTelemetry() {
      return {
        rpm: angularSpeed * 60 / TAU,
        angle,
        swingDeg: Math.max(...cabins.map(c => Math.abs(c.swing))) * 180 / Math.PI,
        cabinCount: CABIN_COUNT,
        angularSpeed,
        simulatedSeconds
      };
    }

    function validate() {
      const finite = Number.isFinite(angle) && cabins.every(c => Number.isFinite(c.swing) && Number.isFinite(c.velocity));
      const maxSwingDeg = Math.max(...cabins.map(c => Math.abs(c.swing))) * 180 / Math.PI;
      // A conservative lower bound includes the bucket's edge as it swings.
      const minGroundClearance = Math.min(...cabins.map(c => c.pivot.position.y - 2.16 * Math.cos(c.swing) - 1.08 * Math.abs(Math.sin(c.swing))));
      return {
        ok: finite && maxSwingDeg < 35 && minGroundClearance > 0.35 && cabins.length === CABIN_COUNT,
        finite,
        cabinCount: cabins.length,
        maxSwingDeg,
        minGroundClearance,
        maxObservedSwingDeg: maxObservedSwing * 180 / Math.PI,
        speedRadSec: angularSpeed
      };
    }

    applyTransforms();
    return {
      root,
      update,
      getTelemetry,
      validate,
      setNight(value) {
        lamp.emissiveIntensity = value ? 3.2 : 0.55;
        redLamp.emissiveIntensity = value ? 2.1 : 0.3;
        signMaterial.emissiveIntensity = value ? 0.65 : 0.04;
        accentLight.intensity = value ? 95 : 0;
      },
      setSpeed(multiplier) {
        if (Number.isFinite(multiplier)) targetSpeed = NOMINAL_SPEED * THREE.MathUtils.clamp(multiplier, 0, 2.5);
      }
    };
  };
}());
