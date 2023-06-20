import * as THREE from "../99_Lib/three.module.min.js";
import { keyboard } from "./keyboard.mjs";
import { createVRcontrollers } from "./vr.mjs";
let first_initalCursorPos, second_initialCursorPos;

let worldPosition = new THREE.Vector3(),
  worldRotation = new THREE.Quaternion(),
  worldScale = new THREE.Vector3();

export function createLine(scene) {
  const material = new THREE.LineBasicMaterial({ color: 0xffffff });
  const points = [];
  points.push(new THREE.Vector3(0, 0, 0));
  points.push(new THREE.Vector3(0, 1, 0));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  const line = new THREE.Line(geometry, material);
  scene.add(line);

  const position = line.geometry.attributes.position.array;

  return (idx, pos) => {
    idx *= 3;
    position[idx++] = pos.x;
    position[idx++] = pos.y;
    position[idx++] = pos.z;
    line.geometry.attributes.position.needsUpdate = true;
  };
}

export function Ray(renderer, scene, world, cursor, objects) {
  const raycaster = new THREE.Raycaster();

  let first_grabbed = false,
    first_squeezed = false;

  let second_grabbed = false,
    second_squeezed = false;
  keyboard(" ", (state) => {
    console.log("grabbed", state);
    first_grabbed = state;
  });

  keyboard("s", (state) => {
    console.log("squeezed", state);
    first_squeezed = state;
  });

  let second_active_controller, second_active_inputsource;
  let second_cursor = new THREE.Group();

  let first_active_controller, first_active_inputsource;
  let { controller1, controller2 } = createVRcontrollers(
    scene,
    renderer,
    (current, src) => {
      // called if/when controllers connect
      if (first_active_controller === undefined) {
        cursor.matrixAutoUpdate = false;
        cursor.visible = false;
        first_active_controller = current;
        first_active_inputsource = src;
        console.log(`connected ${src.handedness} device`);
        renderer.xr.enabled = true;
      } else {
        second_active_controller = current;
        second_cursor.matrixAutoUpdate = false;
        second_cursor.visible = false;
        second_active_inputsource = src;
      }
    }
  );

  const lineFunc = createLine(scene);
  const flySpeedRotationFactor = 0.01;
  const flySpeedTranslationFactor = -0.02;

  let initialGrabbed,
    grabbedObject,
    hitObject,
    distance,
    inverseHand,
    inverseWorld;
  let differenceMatrix = new THREE.Matrix4();

  let deltaFlyRotation = new THREE.Quaternion();

  function updateRay() {
    if (first_active_controller) {
      cursor.matrix.copy(first_active_controller.matrix);
      first_grabbed = controller1.controller.userData.isSelecting;
      first_squeezed = controller1.controller.userData.isSqueezeing;
      let direction, position, rotation, scale;
      //direction.set(0, 0, -1);
    } else {
      cursor.updateMatrix();
      //direction.set(0, 1, 0);
    }
    if (second_active_controller) {
      second_cursor.matrix.copy(second_active_controller.matrix);
      second_grabbed = controller2.controller.userData.isSelecting;
      second_squeezed = controller2.controller.userData.isSqueezeing;
    }

    renderRay(cursor, first_squeezed, first_grabbed);
    renderRay(second_cursor, second_squeezed, second_grabbed);
  }

  function renderRay(cursor, squeezed, grabbed) {
    let initialGrabbed,
      grabbedObject,
      hitObject,
      distance,
      inverseHand,
      inverseWorld,
      initalCursorPos;
    let position = new THREE.Vector3();
    let rotation = new THREE.Quaternion();
    let scale = new THREE.Vector3();
    let endRay = new THREE.Vector3();
    let direction = new THREE.Vector3();

    cursor.matrix.decompose(position, rotation, scale);
    // Anwendung der CursorRotation auf Richtung
    direction.applyQuaternion(rotation);

    // Startpunkt des "Laserstrahls" im Cursor
    lineFunc(0, position);

    if (grabbedObject === undefined) {
      raycaster.set(position, direction);
      const intersects = raycaster.intersectObjects(objects);

      if (intersects.length && intersects[0].distance < 0.1) {
        console.log(intersects[0].distance);
        lineFunc(1, intersects[0].point);
        hitObject = intersects[0].object;
        distance = intersects[0].distance;
      } else {
        // Endpunkt des "Laserstrahls": Startpunkt ist Cursor-Position,
        // Endpunkt berechnet aus Richtung und Startpunkt
        endRay.addVectors(position, direction.multiplyScalar(0.3));
        lineFunc(1, endRay);
        hitObject = undefined;
      }
    }

    if (grabbed) {
      if (grabbedObject) {
        // grabbedObject.matrix.copy(cursor.matrix.clone().multiply(initialGrabbed));
        //grabbedObject.matrix.copy(inverseWorld.clone().multiply(cursor.matrix).multiply(initialGrabbed));
        endRay.addVectors(position, direction.multiplyScalar(distance));
        lineFunc(1, endRay);
        let deltaPos = new THREE.Vector3();
        console.log(initalCursorPos);
        deltaPos.subVectors(initalCursorPos, position);
        console.log(deltaPos);
        deltaPos.x *= -0.2;
        deltaPos.z = 0;
        deltaPos.y *= -0.2;

        world.matrix.decompose(worldPosition, worldRotation, worldScale);
        worldPosition.add(deltaPos);
        world.matrix.compose(worldPosition, worldRotation, worldScale);
      } else if (hitObject) {
        grabbedObject = hitObject;
        // initialGrabbed = cursor.matrix.clone().invert().multiply(grabbedObject.matrix);

        inverseWorld = world.matrix.clone().invert();
        initialGrabbed = cursor.matrix.clone().invert().multiply(world.matrix);
        initalCursorPos = position.clone();
      }
    } else {
      grabbedObject = undefined;
      initalCursorPos = undefined;
    }

    if (squeezed) {
      if (inverseHand !== undefined) {
        let differenceHand = cursor.matrix.clone().multiply(inverseHand);
        differenceHand.decompose(position, rotation, scale);
        deltaFlyRotation.set(0, 0, 0, 1);
        deltaFlyRotation.slerp(rotation.conjugate(), flySpeedRotationFactor);
        differenceMatrix.compose(
          position.multiplyScalar(flySpeedTranslationFactor),
          deltaFlyRotation,
          scale
        );
        world.matrix.premultiply(differenceMatrix);
      } else {
        inverseHand = cursor.matrix.clone().invert();
      }
    } else {
      inverseHand = undefined;
    }
  }

  return { updateRay };
}
