/* Bake static scenery by material without changing any animated subtrees. */
(function () {
  'use strict';

  window.batchStaticMeshes = function batchStaticMeshes(THREE, root, excludedRoots = []) {
    const excluded = new Set(excludedRoots);
    const batches = new Map();
    const relativeMatrix = new THREE.Matrix4();
    root.updateWorldMatrix(true, true);
    const inverseRoot = root.matrixWorld.clone().invert();
    const stats = { mergedMeshes: 0, batchesCreated: 0, drawCallsSaved: 0, skippedMeshes: 0 };

    function attributeLayout(geometry) {
      return Object.keys(geometry.attributes).sort().map(name => {
        const attribute = geometry.attributes[name];
        const array = attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array;
        return [name, attribute.itemSize, array.constructor.name, attribute.normalized ? 1 : 0, attribute.gpuType || 0].join(':');
      }).join('|');
    }

    function eligible(object) {
      const material = object.material;
      const geometry = object.geometry;
      return object.isMesh && !object.isInstancedMesh && !object.isSkinnedMesh
        && !object.isBatchedMesh && geometry && geometry.attributes.position
        && object.children.length === 0 && material && !Array.isArray(material)
        && material.visible !== false && !material.transparent && material.opacity === 1
        && Object.keys(geometry.morphAttributes || {}).length === 0
        && !object.customDepthMaterial && !object.customDistanceMaterial
        && object.onBeforeRender === THREE.Object3D.prototype.onBeforeRender
        && object.onAfterRender === THREE.Object3D.prototype.onAfterRender
        && object.userData.batchStatic !== false;
    }

    function visit(object) {
      if (excluded.has(object) || !object.visible) return;
      if (eligible(object)) {
        const key = [object.material.uuid, Number(object.castShadow), Number(object.receiveShadow),
          object.layers.mask, object.renderOrder, Number(object.frustumCulled), attributeLayout(object.geometry)].join('/');
        if (!batches.has(key)) batches.set(key, []);
        batches.get(key).push(object);
      } else if (object.isMesh) {
        stats.skippedMeshes++;
      }
      for (const child of object.children) visit(child);
    }
    visit(root);

    for (const objects of batches.values()) {
      if (objects.length < 2) continue;
      const sources = [];
      let totalVertices = 0;

      for (const object of objects) {
        relativeMatrix.multiplyMatrices(inverseRoot, object.matrixWorld);
        let geometry = object.geometry.clone();
        geometry.applyMatrix4(relativeMatrix);
        if (geometry.index) {
          const indexed = geometry;
          geometry = geometry.toNonIndexed();
          indexed.dispose();
        }
        const available = geometry.attributes.position.count;
        const firstVertex = Math.max(0, Math.min(available, Math.floor(object.geometry.drawRange.start)));
        const requested = Math.min(available - firstVertex, object.geometry.drawRange.count);
        const vertexCount = Math.max(0, Math.floor(requested / 3) * 3);
        sources.push({ geometry, firstVertex, vertexCount, mirrored: relativeMatrix.determinant() < 0 });
        totalVertices += vertexCount;
      }

      if (!totalVertices) {
        for (const source of sources) source.geometry.dispose();
        continue;
      }
      const combined = new THREE.BufferGeometry();
      const attributeNames = Object.keys(sources[0].geometry.attributes);
      for (const name of attributeNames) {
        const original = sources[0].geometry.attributes[name];
        const originalArray = original.isInterleavedBufferAttribute ? original.data.array : original.array;
        const values = new originalArray.constructor(totalVertices * original.itemSize);
        let outputVertex = 0;
        for (const source of sources) {
          const attribute = source.geometry.attributes[name];
          const data = attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array;
          const stride = attribute.isInterleavedBufferAttribute ? attribute.data.stride : attribute.itemSize;
          const offset = attribute.isInterleavedBufferAttribute ? attribute.offset : 0;
          for (let i = 0; i < source.vertexCount; i++) {
            // A mirrored transform previously reversed the renderer's front face.
            // Reverse winding here to preserve that behaviour in the shared mesh.
            let vertex = i;
            if (source.mirrored) {
              if (i % 3 === 1) vertex++;
              else if (i % 3 === 2) vertex--;
            }
            const input = (source.firstVertex + vertex) * stride + offset;
            const output = (outputVertex + i) * attribute.itemSize;
            for (let component = 0; component < attribute.itemSize; component++) {
              values[output + component] = data[input + component];
            }
          }
          outputVertex += source.vertexCount;
        }
        const attribute = new THREE.BufferAttribute(values, original.itemSize, original.normalized);
        if (original.gpuType !== undefined) attribute.gpuType = original.gpuType;
        combined.setAttribute(name, attribute);
      }
      combined.computeBoundingBox();
      combined.computeBoundingSphere();
      const first = objects[0];
      const baked = new THREE.Mesh(combined, first.material);
      baked.name = 'Static scenery batch (' + objects.length + ' meshes)';
      baked.castShadow = first.castShadow;
      baked.receiveShadow = first.receiveShadow;
      baked.layers.mask = first.layers.mask;
      baked.renderOrder = first.renderOrder;
      baked.frustumCulled = first.frustumCulled;
      baked.userData.staticBatchSize = objects.length;
      root.add(baked);
      for (const object of objects) object.removeFromParent();
      for (const source of sources) source.geometry.dispose();
      stats.mergedMeshes += objects.length;
      stats.batchesCreated++;
      stats.drawCallsSaved += objects.length - 1;
    }
    return stats;
  };
}());
