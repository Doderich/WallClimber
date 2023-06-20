// import * as THREE from '../99_Lib/three.module.min.js';
import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { mousecursor } from "./mousecursor.mjs";
import { Ray } from "./ray.mjs";

console.log("ThreeJs mit VR Vorlesung", THREE.REVISION, new Date());
const loader = new GLTFLoader();

let geometries = [
  new THREE.BoxGeometry(0.25, 0.25, 0.25),
  new THREE.ConeGeometry(0.1, 0.4, 64),
  new THREE.CylinderGeometry(0.2, 0.2, 0.2, 64),
  new THREE.IcosahedronGeometry(0.2, 3),
  new THREE.TorusKnotGeometry(0.2, 0.03, 50, 16),
  new THREE.TorusGeometry(0.2, 0.04, 64, 32),
];

function randomMaterial() {
  return new THREE.MeshStandardMaterial({
    color: Math.random() * 0xff3333,
    roughness: 0.7,
    metalness: 0.0,
  });
}

function add(i, parent, x = 0, y = 0, z = 0) {
  let object = new THREE.Mesh(geometries[i], randomMaterial());
  object.position.set(x, y, z);
  object.updateMatrix();
  object.matrixAutoUpdate = false;
  parent.add(object);
  return object;
}

function addCustom(object, parent, x = 0, y = 0, z = 0, scale = 1) {
  object.position.set(x, y, z);
  object.scale.set(scale, scale, scale);
  object.updateMatrix();
  object.matrixAutoUpdate = false;
  parent.add(object);
  return object;
}

window.onload = function () {
  let scene = new THREE.Scene();
  //
  scene.add(new THREE.HemisphereLight(0x808080, 0x606060));
  let light = new THREE.DirectionalLight(0xffffff);
  light.position.set(0, 2, 0);
  scene.add(light);
  //
  let camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 1);
  scene.add(camera);
  //
  let cursor1 = add(1, scene);
  mousecursor(cursor1);

  let cursor2 = add(1, scene);
  mousecursor(cursor2);

  let world = new THREE.Group();
  world.matrixAutoUpdate = false;
  world.rotation.y = Math.PI;
  world.position.z = -1;
  world.updateMatrix();
  scene.add(world);

  let renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
  });

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xaaaaaa, 1);

  document.body.appendChild(renderer.domElement);
  document.body.appendChild(VRButton.createButton(renderer));

  let objects = [];

  for (let y = 0; y < 4; y += 0.5) {
    for (let x = -2; x < 2; x += 0.5) {
      loader.load(
        "assets/rock1.glb",
        function (gltf) {
          addCustom(gltf.scene, world, x, y, -0.3, 0.1);
          objects.push(gltf.scene);
        },
        undefined,
        function (error) {
          console.error(error);
        }
      );
    }
  }

  loader.load("assets/cave1.glb", function (gltf) {
    addCustom(gltf.scene, world, 5, -5, -0.3);
    objects.push(gltf.scene);
  });

  let ray = Ray(renderer, scene, world, cursor1, cursor2, objects);
  function render() {
    ray.updateRay();
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(render);
};
