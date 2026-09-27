/* LUNA PARK — small world, big wonder. All art is procedural. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const T = window.THREE;
  const state = { mode: 'day', camera: 'overview', paused: false, speed: 1 };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    $('loading').classList.add('loaded'); $('error-panel').hidden = false;
    console.error('WebGL initialization failed', error); return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.24;
  $('world').appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Luna Park üç boyutlu sahne');
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0xeaf0e8, 0.0023);
  const camera = new T.PerspectiveCamera(38, innerWidth / innerHeight, 0.15, 650);
  const hemi = new T.HemisphereLight(0xf1f6eb, 0x739482, 2.0); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffedcf, 3.7);
  sun.position.set(-38, 65, 35); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 55, bottom: -55, near: 1, far: 190 });
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.normalBias = 0.045; sun.shadow.bias = -0.0002;
  scene.add(sun); scene.add(sun.target);
  const fill = new T.DirectionalLight(0xa9cad3, .7); fill.position.set(35, 25, -30); scene.add(fill);
  const atmosphere = {
    day: { fog: 0xeaf0e8, sky: 0xf1f6eb, ground: 0x739482, sun: 0xffedcf, sunPower: 3.7, ambient: 2, exposure: 1.24, fill: .7 },
    night: { fog: 0x101e30, sky: 0x859eda, ground: 0x23394d, sun: 0xaac6ff, sunPower: 1.1, ambient: .9, exposure: 1.28, fill: .7 },
    festival: { fog: 0x2a1d42, sky: 0xb9a1e7, ground: 0x4c2f55, sun: 0xffb99a, sunPower: 1.7, ambient: 1.25, exposure: 1.25, fill: .9 }
  };
  const targetColors = { fog: new T.Color(), sky: new T.Color(), ground: new T.Color(), sun: new T.Color() };
  const world = new T.Group(); scene.add(world);
  const mat = (color, roughness = .8, metalness = 0) => new T.MeshStandardMaterial({ color, roughness, metalness });
  const materials = {
    grass: mat(0x9eae79), grassEdge: mat(0x577e69), base: mat(0xd4cab0), path: mat(0xf3e7ca),
    cream: mat(0xfff0d1), coral: mat(0xdf7055), teal: mat(0x377e77), dark: mat(0x244d4a),
    gold: mat(0xe9ba64, .45, .3), trunk: mat(0x84624b), leaf: mat(0x619777), paleLeaf: mat(0x80aa82),
    pink: mat(0xea9290), blue: mat(0x789eae), white: mat(0xfff9e6), rubber: mat(0x3b4744),
    lamp: new T.MeshStandardMaterial({color:0xffecc5, emissive:0xffc577, emissiveIntensity:.15}),
    window: new T.MeshStandardMaterial({color:0x274d50, roughness:.2, metalness:.25})
  };
  function mesh(geometry, material, x = 0, y = 0, z = 0, parent = world) {
    const obj = new T.Mesh(geometry, material); obj.position.set(x,y,z); obj.castShadow = true; obj.receiveShadow = true; parent.add(obj); return obj;
  }
  const box = (w,h,d,m,x,y,z,p) => mesh(new T.BoxGeometry(w,h,d),m,x,y,z,p);
  const cylinder = (rt,rb,h,m,x,y,z,p,n=16) => mesh(new T.CylinderGeometry(rt,rb,h,n),m,x,y,z,p);
  const sphere = (r,m,x,y,z,p) => mesh(new T.SphereGeometry(r,12,8),m,x,y,z,p);
  const v = (x,y,z) => new T.Vector3(x,y,z);
  function beam(a,b,r,m,parent=world){const d=b.clone().sub(a),o=cylinder(r,r,d.length(),m,0,0,0,parent,8);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(v(0,1,0),d.normalize());return o;}
  function roundedShape(width, depth, radius) {
    const s = new T.Shape(), x=-width/2, y=-depth/2, w=width, h=depth, r=radius;
    s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y); return s;
  }
  function islandLayer(w,d,r,depth,y,m){const g=new T.ExtrudeGeometry(roundedShape(w,d,r),{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.2,bevelThickness:.15,curveSegments:12});g.rotateX(-Math.PI/2);return mesh(g,m,0,y,0);}
  islandLayer(100,75,12,1.5,-2.5,materials.base);
  islandLayer(99.5,74.5,12,.6,-1,materials.grassEdge);
  islandLayer(98.7,73.7,12,.3,-.36,materials.grass);
  // Soft grounding under the miniature island, independent of the shadow map.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;
  const sctx=shadowCanvas.getContext('2d');const grad=sctx.createRadialGradient(64,64,8,64,64,63);grad.addColorStop(0,'rgba(28,61,55,.24)');grad.addColorStop(.65,'rgba(28,61,55,.17)');grad.addColorStop(1,'rgba(28,61,55,0)');sctx.fillStyle=grad;sctx.fillRect(0,0,128,128);
  const contactShadow=mesh(new T.PlaneGeometry(151,120),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}),0,-2.8,2);contactShadow.rotation.x=-Math.PI/2;contactShadow.castShadow=false;
  // Broad promenades leave clear spaces around both moving attractions.
  box(84,.08,6,materials.path,0,.02,24);
  box(6,.08,38,materials.path,20,.025,7);
  cylinder(10,10,.1,materials.path,0,.05,23,world,64);
  const pathCurve=new T.CatmullRomCurve3([v(-41,.06,23),v(-43,.06,10),v(-42,.06,-20),v(-31,.06,-29),v(7,.06,-29),v(33,.06,-26),v(41,.06,-14),v(42,.06,19),v(37,.06,24)]);
  const perimeterPath=mesh(new T.TubeGeometry(pathCurve,140,1.35,4,false),materials.path);
  perimeterPath.scale.y=.045;perimeterPath.position.y=.06;
  const pathMarkMat=mat(0xdcd5b4);
  for(let x=-38;x<40;x+=3.4) box(.06,.03,5.8,pathMarkMat,x,.085,24);
  // Park fence, brass handrails, and a discreet entry gate.
  const fencePosts=[],fenceBars=[];
  for(let x=-39;x<=39;x+=3){fencePosts.push(v(x,.7,34));fencePosts.push(v(x,.7,-34));}
  for(let z=-27;z<=27;z+=3){fencePosts.push(v(-46,.7,z));fencePosts.push(v(46,.7,z));}
  const dummy=new T.Object3D();
  function instances(geometry,material,transforms){const im=new T.InstancedMesh(geometry,material,transforms.length);transforms.forEach((f,i)=>{dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);f(dummy);dummy.updateMatrix();im.setMatrixAt(i,dummy.matrix);});im.castShadow=true;im.receiveShadow=true;world.add(im);return im;}
  instances(new T.CylinderGeometry(.06,.06,1.4,6),materials.cream,fencePosts.map(p=>o=>o.position.copy(p)));
  for(const z of [-34,34]) {beam(v(-40,1.1,z),v(40,1.1,z),.045,materials.cream);beam(v(-40,.42,z),v(40,.42,z),.04,materials.cream);}
  for(const x of [-46,46]){beam(v(x,1.1,-28),v(x,1.1,28),.045,materials.cream);beam(v(x,.42,-28),v(x,.42,28),.04,materials.cream);}
  function tree(x,z,size=1,tone=0){const g=new T.Group();world.add(g);g.position.set(x,0,z);g.scale.setScalar(size);cylinder(.18,.3,2.5,materials.trunk,0,1.25,0,g,7);const canopy=sphere(1.9,tone?materials.paleLeaf:materials.leaf,0,3.6,0,g);canopy.scale.set(.87,1.35,.87);sphere(1.2,tone?materials.leaf:materials.paleLeaf,.8,3,.4,g);cylinder(1.6,1.8,.25,materials.grassEdge,0,.12,0,g);return g;}
  const treeSpots=[[-40,27,1],[-34,30,.8],[-28,31,.9],[-18,31,.72],[-11,31,.85],[12,31,.85],[24,31,.9],[33,30,1],[40,25,1.1],[42,10,.8],[41,4,1],[41,-7,1.1],[39,-20,.9],[33,-29,.85],[24,-31,1],[14,-31,.85],[3,-31,.8],[-10,-31,1],[-25,-31,.8],[-38,-26,.85],[-44,-15,.8],[-43,-4,.95],[-43,9,1],[-35,19,.75],[32,9,.65],[8,13,.75]];
  treeSpots.forEach(([x,z,s],i)=>tree(x,z,s,i%2));
  // Flower beds are instanced, so the little details remain inexpensive.
  const flowerTransforms=[];const flowerColors=[];
  for(let i=0;i<170;i++){const a=i*2.39996;const centers=[[-12,28],[28,28],[35,11],[-36,27]];const [cx,cz]=centers[i%4];const r=.3+Math.sqrt((i%43)/43)*2.0;flowerTransforms.push(o=>{o.position.set(cx+Math.cos(a)*r,.26,cz+Math.sin(a)*r);o.scale.set(.16,.22,.16);});flowerColors.push([0xeeb356,0xe78c83,0xffecba][i%3]);}
  const flowers=instances(new T.IcosahedronGeometry(1,0),mat(0xffffff),flowerTransforms);flowerColors.forEach((c,i)=>flowers.setColorAt(i,new T.Color(c)));flowers.instanceColor.needsUpdate=true;
  // Canvas labels are local textures; no font or image requests at runtime.
  function sign(text,w,h,x,y,z,parent=world,color='#fcf0cc',background='#285c58'){
    const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,512,128);ctx.strokeStyle=color;ctx.lineWidth=3;ctx.strokeRect(9,9,494,110);ctx.fillStyle=color;ctx.font='bold 49px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,67);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const o=mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:texture,roughness:.8,side:T.DoubleSide}),x,y,z,parent);return o;
  }
  const entrance=new T.Group();entrance.position.set(-25,0,29);world.add(entrance);
  for(const x of [-5,5]){cylinder(.24,.3,4.1,materials.coral,x,2.05,0,entrance);sphere(.42,materials.gold,x,4.2,0,entrance);}
  beam(v(-5,3.7,0),v(5,3.7,0),.13,materials.coral,entrance);sign('L U N A   P A R K',9,1.6,0,4.35,.08,entrance);
  function booth(x,z,text,bodyMat){const g=new T.Group();g.position.set(x,0,z);world.add(g);box(3.8,2.7,3,bodyMat,0,1.35,0,g);box(3.1,1.2,.06,materials.window,0,1.65,1.52,g);box(4,.16,1,materials.cream,0,1.03,1.65,g);box(4.8,.25,4,materials.cream,0,2.82,0,g);const roof=cylinder(0,3.1,1.6,materials.coral,0,3.65,0,g,4);roof.rotation.y=Math.PI/4;for(let i=0;i<8;i++)box(.45,.17,1, i%2?materials.cream:materials.coral,-1.6+i*.45,2.55,1.8,g);sign(text,3,.55,0,2.3,1.64,g);for(const x1 of [-1.65,1.65])cylinder(.08,.08,2.4,materials.cream,x1,1.2,1.8,g,8);return g;}
  booth(-32,26,'BİLETLER',materials.teal);booth(29,23,'GELATO',materials.pink);booth(36,22,'POPCORN',materials.gold);
  // Hand-built carousel with twelve orbiting horses and a striped canopy.
  const carousel=new T.Group();carousel.position.set(-1,0,22);world.add(carousel);
  cylinder(5.6,5.8,.55,materials.cream,0,.28,0,carousel,48);cylinder(5.3,5.3,.22,materials.coral,0,.66,0,carousel,48);
  const carouselSpin=new T.Group();carousel.add(carouselSpin);cylinder(.7,.8,5.2,materials.teal,0,3.1,0,carousel);
  const canopyMaterials=[materials.coral,materials.cream];
  for(let i=0;i<16;i++){const cone=new T.ConeGeometry(5.7,2.9,4,1,true,i*Math.PI/8,Math.PI/8);mesh(cone,canopyMaterials[i%2],0,6.45,0,carousel);}
  cylinder(5.7,5.7,.35,materials.gold,0,5.05,0,carousel,48);sphere(.35,materials.gold,0,8.07,0,carousel);
  const horseGroups=[];
  for(let i=0;i<10;i++){
    const a=i*Math.PI/5,r=3.8,g=new T.Group();g.position.set(Math.cos(a)*r,0,Math.sin(a)*r);g.rotation.y=-a;carouselSpin.add(g);
    cylinder(.055,.055,4.3,materials.gold,0,2.85,0,g,8);
    const horse=new T.Group();horse.position.y=2;g.add(horse);horseGroups.push(horse);
    const body=sphere(.46,i%2?materials.cream:materials.pink,0,0,0,horse);body.scale.set(.68,.95,1.7);
    const neck=box(.3,.7,.42,materials.cream,0,.45,.53,horse);neck.rotation.x=.4;sphere(.25,materials.cream,0,.84,.65,horse);
    box(.45,.15,.6,i%2?materials.coral:materials.teal,0,.42,-.08,horse);
    for(const xx of [-.2,.2])for(const zz of [-.46,.46]){const leg=box(.12,.64,.13,materials.cream,xx,-.52,zz,horse);leg.rotation.x=zz>0?-.4:.4;}
    beam(v(0,.2,-.55),v(0,-.25,-1),.085,materials.gold,horse);
  }
  // Benches, people and catenary-like string lights lend a human scale.
  function bench(x,z,rot=0){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rot;world.add(g);for(let i=0;i<3;i++)box(2,.11,.17,materials.cream,0,.68,i*.19,g);for(let i=0;i<2;i++)box(2,.17,.1,materials.teal,0,.98+i*.23,-.03,g);for(const xx of [-.76,.76]){box(.11,.6,.12,materials.dark,xx,.3,.28,g);box(.1,1.25,.1,materials.dark,xx,.62,-.07,g);}return g;}
  bench(12,28);bench(-13,28);bench(25,15,Math.PI/2);bench(34,7,Math.PI/2);bench(-39,15,-Math.PI/2);
  const lampPoints=[];
  function lamp(x,z){cylinder(.075,.12,4.8,materials.dark,x,2.4,z,world,8);cylinder(.45,.13,.35,materials.dark,x,4.87,z);sphere(.3,materials.lamp,x,4.55,z);lampPoints.push(v(x,4.5,z));}
  [[-20,27],[10,27],[24,27],[40,18],[37,-20],[-39,-20],[-39,4],[20,7]].forEach(([x,z])=>lamp(x,z));
  const bulbPositions=[];
  for(const [a,b] of [[v(-20,4.75,27),v(10,4.75,27)],[v(10,4.75,27),v(24,4.75,27)]]){
    const points=[];for(let i=0;i<=30;i++){const t=i/30,p=a.clone().lerp(b,t);p.y-=Math.sin(t*Math.PI)*1.2;points.push(p);if(i%2===0)bulbPositions.push(p.clone().add(v(0,-.1,0)));}mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),40,.025,4,false),materials.dark);
  }
  instances(new T.SphereGeometry(.12,6,5),materials.lamp,bulbPositions.map(p=>o=>o.position.copy(p)));
  const pathGlow=new T.PointLight(0xffcf88,0,36,2);pathGlow.position.set(2,6,23);scene.add(pathGlow);
  // People are static sculptures, like inhabitants of a model village.
  const people=[[-18,24],[15,22],[23,19],[26,24],[-27,24],[-24,24],[-11,21],[7,24],[9,23],[20,13],[19,11],[33,25],[-36,23],[38,17],[3,29],[-4,28],[21,-23],[30,-27],[-40,0]];
  people.forEach(([x,z],i)=>{const g=new T.Group();g.position.set(x,0,z);g.rotation.y=i*1.7;world.add(g);const skin=mat([0xe6bd96,0xc88e68,0x8c6148][i%3]);cylinder(.17,.21,.58,[materials.coral,materials.teal,materials.gold,materials.blue][i%4],0,.92,0,g,8);sphere(.17,skin,0,1.43,0,g);for(const xx of [-.105,.105])cylinder(.063,.07,.57,materials.dark,xx,.3,0,g,6);for(const xx of [-.25,.25]){const arm=cylinder(.055,.06,.48,skin,xx,.85,0,g,6);arm.rotation.z=xx*.8;}if(i%4===0)cylinder(.22,.22,.1,materials.cream,0,1.53,0,g,12);});
  // Balloons tethered to the gelato cart.
  const balloonGroup=new T.Group();balloonGroup.position.set(32,0,24);world.add(balloonGroup);
  for(let i=0;i<7;i++){const x=Math.sin(i*2.4)*1.15,z=Math.cos(i*2.4)*.7,y=4.1+(i%3)*.55;const b=sphere(.48,[materials.coral,materials.gold,materials.teal,materials.pink][i%4],x,y,z,balloonGroup);b.scale.y=1.3;beam(v(0,1.2,0),v(x,y-.58,z),.014,materials.cream,balloonGroup);}
  // Clouds and a pair of quiet hot air balloons behind the miniature park.
  const skyObjects=new T.Group();scene.add(skyObjects);
  const cloudMat=new T.MeshStandardMaterial({color:0xfff7e6,roughness:1,transparent:true,opacity:.85});
  const clouds=[];
  [[-37,37,-40,1],[7,40,-52,1.15],[43,32,-37,.7]].forEach(([x,y,z,s])=>{const g=new T.Group();g.position.set(x,y,z);g.scale.setScalar(s);skyObjects.add(g);for(let i=0;i<5;i++){const o=sphere(2.1,cloudMat,(i-2)*2.1,Math.sin(i*1.7)*.8,0,g);o.scale.set(1.1,.65,.65);o.castShadow=false;}clouds.push(g);});
  const airBalloons=[];
  function airBalloon(x,y,z,scale){const g=new T.Group();g.position.set(x,y,z);g.scale.setScalar(scale);skyObjects.add(g);for(let i=0;i<12;i++){const section=new T.SphereGeometry(3.1,4,14,i*Math.PI/6,Math.PI/6,0,Math.PI*.84);const b=mesh(section,i%2?materials.cream:materials.coral,0,0,0,g);b.scale.y=1.25;b.castShadow=false;}cylinder(.6,.7,.3,materials.gold,0,-3.55,0,g);box(1,.8,.85,materials.trunk,0,-4.8,0,g);for(const xx of [-.4,.4])for(const zz of [-.3,.3])beam(v(xx,-4.5,zz),v(xx*1.7,-3.1,zz*1.7),.028,materials.dark,g);airBalloons.push(g);}
  airBalloon(-35,33,-28,.85);airBalloon(37,43,-42,.6);
  // Distant stars are geometry, not a backdrop image.
  let randomSeed=421337;function random(){randomSeed=(Math.imul(1664525,randomSeed)+1013904223)>>>0;return randomSeed/4294967296;}
  const starPositions=[];for(let i=0;i<420;i++){const angle=random()*Math.PI*2,r=140+random()*110;starPositions.push(Math.cos(angle)*r,45+random()*100,Math.sin(angle)*r);}
  const starGeo=new T.BufferGeometry();starGeo.setAttribute('position',new T.Float32BufferAttribute(starPositions,3));
  const starMat=new T.PointsMaterial({color:0xffebcc,size:.37,transparent:true,opacity:0,depthWrite:false});scene.add(new T.Points(starGeo,starMat));
  const confettiCount=680;
  const confetti=new T.InstancedMesh(new T.PlaneGeometry(.2,.38),new T.MeshStandardMaterial({color:0xffffff,side:T.DoubleSide,roughness:.45,emissive:0xaaaaaa,emissiveIntensity:.18}),confettiCount);confetti.instanceMatrix.setUsage(T.DynamicDrawUsage);confetti.frustumCulled=false;confetti.visible=false;scene.add(confetti);
  const confettiData=Array.from({length:confettiCount},(_,i)=>{confetti.setColorAt(i,new T.Color([0xff7f6a,0xf9ce68,0x7ad5c1,0xc59def,0xffeee0][i%5]));return{x:(random()-.5)*98,y:random()*59+1,z:(random()-.5)*72,fall:2+random()*3.6,phase:random()*Math.PI*2,spin:random()*4+1};});
  const coaster = window.createCoaster(T,scene);
  const ferris = window.createFerrisWheel(T,scene);
  const batching = window.batchStaticMeshes(T,world,[carouselSpin,balloonGroup]);
  let elapsed=0,accumulator=0,frameCount=0,diagnosticRender=0;
  const STEP=1/120;
  function simulate(dt){coaster.update(dt);ferris.update(dt);elapsed+=dt;}
  function decorate(){
    carouselSpin.rotation.y=elapsed*.22;
    horseGroups.forEach((h,i)=>h.position.y=2+Math.sin(elapsed*1.8+i*Math.PI*.6)*.26);
    balloonGroup.rotation.z=Math.sin(elapsed*.75)*.035;
    airBalloons.forEach((b,i)=>b.position.y=[33,43][i]+Math.sin(elapsed*.21+i)*.5);
    clouds.forEach((c,i)=>c.position.x=[-37,7,43][i]+Math.sin(elapsed*.045+i)*2.1);
    if(state.mode==='festival'){
      confettiData.forEach((c,i)=>{const t=elapsed*c.fall;dummy.position.set(c.x+Math.sin(elapsed*.8+c.phase)*1.4,60-((t+60-c.y)%60),c.z+Math.sin(elapsed*.5+c.phase)*1.8);dummy.rotation.set(elapsed*c.spin+c.phase,elapsed+c.phase,elapsed*.4+c.phase);dummy.scale.setScalar(1);dummy.updateMatrix();confetti.setMatrixAt(i,dummy.matrix);});
      confetti.instanceMatrix.needsUpdate=true;
    }
  }
  // Custom orbit control keeps the deliverable self-contained and supports touch.
  const orbit={target:v(0,8,1),currentTarget:v(0,8,1),theta:.59,phi:.96,radius:139,currentTheta:.59,currentPhi:.96,currentRadius:139};
  function overviewPreset(){return innerWidth<761?{target:v(0,6,0),theta:.58,phi:.97,radius:Math.max(165,178/(innerWidth/innerHeight))}:{target:v(0,6,0),theta:.61,phi:.96,radius:137};}
  const cameraPresets={wheel:{target:v(20,15,-7),theta:.33,phi:1.1,radius:67},coaster:{target:v(-19,9,-5),theta:.65,phi:1.03,radius:87}};
  let cameraInitialized=false;
  function applyPreset(name,immediate=false){const p=name==='overview'?overviewPreset():cameraPresets[name];if(!p)return;const fit=innerWidth<761&&name!=='overview'?Math.max(1,.85/camera.aspect):1;orbit.target.copy(p.target);orbit.theta=p.theta;orbit.phi=p.phi;orbit.radius=p.radius*fit;if(immediate){orbit.currentTarget.copy(p.target);orbit.currentTheta=p.theta;orbit.currentPhi=p.phi;orbit.currentRadius=orbit.radius;}}
  function updateCamera(dt,immediate=false){
    if(state.camera==='ride'){
      scene.fog.density=.0023;
      const pose=coaster.getRideCamera();
      if(pose&&pose.position&&pose.target){camera.position.copy(pose.position);camera.up.copy(pose.up||v(0,1,0));camera.lookAt(pose.target);camera.fov=68;camera.updateProjectionMatrix();}
      return;
    }
    const k=immediate||reducedMotion?1:1-Math.exp(-dt*6);
    orbit.currentTarget.lerp(orbit.target,k);orbit.currentTheta+=(orbit.theta-orbit.currentTheta)*k;orbit.currentPhi+=(orbit.phi-orbit.currentPhi)*k;orbit.currentRadius+=(orbit.radius-orbit.currentRadius)*k;
    scene.fog.density=.0023*Math.min(1,137/orbit.currentRadius);
    const r=orbit.currentRadius,phi=orbit.currentPhi,theta=orbit.currentTheta;
    camera.position.set(r*Math.sin(phi)*Math.sin(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.cos(theta)).add(orbit.currentTarget);
    camera.up.set(0,1,0);camera.lookAt(orbit.currentTarget);if(camera.fov!==38){camera.fov=38;camera.updateProjectionMatrix();}
  }
  const caption={overview:['01.','ÖZGÜRCE KEŞFET','En güzel anı, bir sonraki tur.'],wheel:['02.','GÖKYÜZÜNE BİR BİLET','Hayata biraz da yukarıdan bak.'],coaster:['03.','HEYECANIN İZİNİ SÜR','Bir viraj. Bin kelebek.'],ride:['04.','ÖN KOLTUK SENİN','Sıkı tutun. Hikâye şimdi başlıyor.']};
  function setCamera(name,immediate=false){state.camera=name;document.body.dataset.camera=name;document.querySelectorAll('button[data-camera]').forEach(b=>{const active=b.dataset.camera===name;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});if(name!=='ride')applyPreset(name,immediate);$('caption-number').textContent=caption[name][0];$('caption-kicker').textContent=caption[name][1];$('caption-title').textContent=caption[name][2];if(name==='ride')toast('Ön koltuktasın. Parka dönmek için R tuşuna bas.');updateCamera(0,immediate);}
  function setMode(mode){state.mode=mode;document.body.dataset.mode=mode;document.querySelectorAll('button[data-mode]').forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});const night=mode!=='day';coaster.setNight(night);ferris.setNight(night);confetti.visible=mode==='festival';$('weather-label').textContent={day:'Güneşli, bol gülümsemeli',night:'Yıldızlı, biraz da büyülü',festival:'Gökyüzünden mutluluk yağıyor'}[mode];document.querySelector('.weather use').setAttribute('href',mode==='day'?'#i-sun':mode==='night'?'#i-moon':'#i-star');$('scene-tag-text').textContent={day:'36° HAYAL / 100% EĞLENCE',night:'YILDIZLARIN ALTINDA BİR TUR',festival:'KONFETİ, RENK VE BOLCA NEŞE'}[mode];decorate();}
  function updateAtmosphere(dt){const a=atmosphere[state.mode],k=1-Math.exp(-dt*2.5);for(const key of ['fog','sky','ground','sun'])targetColors[key].set(a[key]);scene.fog.color.lerp(targetColors.fog,k);hemi.color.lerp(targetColors.sky,k);hemi.groundColor.lerp(targetColors.ground,k);sun.color.lerp(targetColors.sun,k);sun.intensity+=(a.sunPower-sun.intensity)*k;hemi.intensity+=(a.ambient-hemi.intensity)*k;fill.intensity+=(a.fill-fill.intensity)*k;renderer.toneMappingExposure+=(a.exposure-renderer.toneMappingExposure)*k;const night=state.mode!=='day';materials.lamp.emissiveIntensity+=((night?3.3:.15)-materials.lamp.emissiveIntensity)*k;pathGlow.intensity+=((night?95:0)-pathGlow.intensity)*k;starMat.opacity+=((night?.8:0)-starMat.opacity)*k;cloudMat.opacity+=((night?.33:.85)-cloudMat.opacity)*k;}
  function setPaused(paused){state.paused=paused;accumulator=0;$('pause-btn').setAttribute('aria-pressed',String(paused));$('pause-btn').setAttribute('aria-label',paused?'Parkı sürdür':'Parkı duraklat');$('pause-btn').title=paused?'Sürdür (Boşluk)':'Duraklat (Boşluk)';$('pause-btn').querySelector('use').setAttribute('href',paused?'#i-play':'#i-pause');$('live-label').textContent=paused?'ZAMAN DURDU':'PARK CANLI';}
  let toastTimer;function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
  document.querySelectorAll('button[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  document.querySelectorAll('button[data-camera]').forEach(b=>b.addEventListener('click',()=>setCamera(b.dataset.camera)));
  $('pause-btn').addEventListener('click',()=>setPaused(!state.paused));
  $('speed-range').addEventListener('input',()=>{state.speed=Number($('speed-range').value);$('speed-output').textContent=state.speed+'×';});
  $('reset-camera').addEventListener('click',()=>setCamera('overview'));
  document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();setCamera('overview');});
  $('help-btn').addEventListener('click',()=>$('help-dialog').showModal());$('close-help').addEventListener('click',()=>$('help-dialog').close());
  $('help-dialog').addEventListener('click',e=>{if(e.target===$('help-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  $('fullscreen-btn').addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{toast('Bu tarayıcıda tam ekran kullanılamıyor.');}});
  addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||$('help-dialog').open)return;if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();setPaused(!state.paused);}else if(e.key==='1')setMode('day');else if(e.key==='2')setMode('night');else if(e.key==='3')setMode('festival');else if(e.key.toLowerCase()==='r'||e.key==='Escape')setCamera('overview');});
  const pointers=new Map();let dragX=0,dragY=0,pinchDistance=0;
  const surface=$('world');
  surface.addEventListener('pointerdown',e=>{if(state.camera==='ride')setCamera('overview');surface.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});dragX=e.clientX;dragY=e.clientY;surface.classList.add('dragging');if(pointers.size===2){const p=[...pointers.values()];pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}});
  surface.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinchDistance>0)orbit.radius=T.MathUtils.clamp(orbit.radius*pinchDistance/Math.max(1,d),25,480);pinchDistance=d;}else{orbit.theta-=(e.clientX-dragX)*.005;orbit.phi=T.MathUtils.clamp(orbit.phi-(e.clientY-dragY)*.004,.2,1.43);}dragX=e.clientX;dragY=e.clientY;});
  function endPointer(e){pointers.delete(e.pointerId);if(pointers.size===0)surface.classList.remove('dragging');else{const p=[...pointers.values()][0];dragX=p.x;dragY=p.y;}pinchDistance=0;}
  surface.addEventListener('pointerup',endPointer);surface.addEventListener('pointercancel',endPointer);surface.addEventListener('lostpointercapture',endPointer);
  surface.addEventListener('wheel',e=>{e.preventDefault();if(state.camera==='ride')return;orbit.radius=T.MathUtils.clamp(orbit.radius*Math.exp(e.deltaY*.0008),25,480);},{passive:false});
  addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();if(state.camera!=='ride')applyPreset(state.camera);});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();setPaused(true);toast('Grafik bağlantısı kesildi. Sayfayı yenileyebilirsin.');});
  let previous=performance.now(),lastUI=0;
  document.addEventListener('visibilitychange',()=>{previous=performance.now();accumulator=0;});
  function updateStats(){const t=coaster.getTelemetry();$('speed-stat').innerHTML=Math.round(t.speedKmh||0)+'<span>km/sa</span>';$('height-stat').innerHTML=Math.round(t.height||0)+'<span>m</span>';}
  function frame(now){requestAnimationFrame(frame);const realDt=Math.min((now-previous)/1000,.06);previous=now;if(!document.hidden){if(!state.paused){accumulator+=realDt*state.speed;let steps=0;while(accumulator>=STEP&&steps<30){simulate(STEP);accumulator-=STEP;steps++;}decorate();}updateAtmosphere(realDt);updateCamera(realDt);renderer.render(scene,camera);frameCount++;if(now-lastUI>160){updateStats();lastUI=now;}}}
  // Read-only diagnostics plus deterministic stepping for reproducible regression checks.
  window.parkDebug={
    state:()=>({...state,elapsed,cameraPosition:camera.position.toArray(),frames:frameCount}),
    diagnostics:()=>({coaster:{...coaster.getTelemetry(),...coaster.validate()},ferris:{...ferris.getTelemetry(),...ferris.validate()},confettiCount:confetti.visible?confettiCount:0,renderer:{drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles},batching,elapsed}),
    step:(seconds)=>{if(!Number.isFinite(seconds)||seconds<0||seconds>600)throw new RangeError('Step must be between 0 and 600 seconds.');for(let t=0;t<seconds;t+=STEP)simulate(Math.min(STEP,seconds-t));decorate();updateCamera(1,true);updateStats();renderer.render(scene,camera);return window.parkDebug.diagnostics();},
    coaster,ferris, setCamera, setMode
  };
  setCamera('overview',true);setMode('day');if(reducedMotion)setPaused(true);decorate();updateStats();renderer.render(scene,camera);
  requestAnimationFrame(frame);setTimeout(()=>$('loading').classList.add('loaded'),180);
})();
