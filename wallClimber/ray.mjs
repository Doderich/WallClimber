import * as THREE from "../99_Lib/three.module.min.js";
import { keyboard } from "./keyboard.mjs";
import { createVRcontrollers } from "./vr.mjs";

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

export function Ray(renderer, scene, world, cursor, second_cursor, objects) {
  const raycaster = new THREE.Raycaster();
  const direction1 = new THREE.Vector3();
  const direction2 = new THREE.Vector3();

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
  let first_active_controller, first_active_inputsource;
  let { controller1, controller2 } = createVRcontrollers(
    scene,
    renderer,
    (current, src) => {
      console.log("current", current);
      console.log("src", src);
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
        console.log(`connected ${src.handedness} device`);
        second_active_inputsource = src;
      }
    }
  );

  const lineFunc = createLine(scene);
  const lineFunc2 = createLine(scene);
  let grabbedObject1, grabbedObject2;
  let initialGrabbed1, initialGrabbed2;
  let hitObject1, hitObject2;
  let initialCursorPos1, initialCursorPos2;

  function updateRay() {
    direction1.set(0, 0, -1);
    direction2.set(0, 0, -1);
    if (first_active_controller) {
      cursor.matrix.copy(first_active_controller.matrix);
      first_grabbed = controller1.controller.userData.isSelecting;
      first_squeezed = controller1.controller.userData.isSqueezeing;
    } else {
      cursor.updateMatrix();
    }
    if (second_active_controller) {
      second_cursor.matrix.copy(second_active_controller.matrix);
      second_grabbed = controller2.controller.userData.isSelecting;
      second_squeezed = controller2.controller.userData.isSqueezeing;
    } else {
      second_cursor.updateMatrix();
    }

    [grabbedObject1, hitObject1, initialGrabbed1, initialCursorPos1] =
      renderRay(
        cursor,
        first_squeezed,
        first_grabbed,
        lineFunc,
        direction1,
        grabbedObject1,
        hitObject1,
        initialGrabbed1,
        initialCursorPos1,
        (first_grabbed || second_grabbed) && !(first_grabbed && second_grabbed)
      );
    [grabbedObject2, hitObject2, initialGrabbed2, initialCursorPos2] =
      renderRay(
        second_cursor,
        second_squeezed,
        second_grabbed,
        lineFunc2,
        direction2,
        grabbedObject2,
        hitObject2,
        initialGrabbed2,
        initialCursorPos2,
        (first_grabbed || second_grabbed) && !(first_grabbed && second_grabbed)
      );

    if (!grabbedObject1 && !grabbedObject2) {
      if (worldPosition.y < 0) {
        let deltaPos = new THREE.Vector3();
        deltaPos.x = 0;
        deltaPos.z = 0;
        deltaPos.y = 0.03;
        console.log("deltaPos", deltaPos);

        world.matrix.decompose(worldPosition, worldRotation, worldScale);
        worldPosition.add(deltaPos);
        world.matrix.compose(worldPosition, worldRotation, worldScale);
      }
    }
  }

  function renderRay(
    cursor,
    squeezed,
    grabbed,
    linefunc,
    direction,
    grabbedObject,
    hitObject,
    initialGrabbed,
    initalCursorPos,
    isOnlyOneGrabbedactive
  ) {
    let distance, inverseHand, inverseWorld;
    let position = new THREE.Vector3();
    let rotation = new THREE.Quaternion();
    let scale = new THREE.Vector3();
    let endRay = new THREE.Vector3();

    cursor.matrix.decompose(position, rotation, scale);
    //console.log("position, rotation, scale", position, rotation, scale);
    // Anwendung der CursorRotation auf Richtung
    direction1.applyQuaternion(rotation);
    direction2.applyQuaternion(rotation);

    // Startpunkt des "Laserstrahls" im Cursor
    linefunc(0, position);

    if (grabbedObject === undefined) {
      raycaster.set(position, direction);
      const intersects = raycaster.intersectObjects(objects);

      if (intersects.length && intersects[0].distance < 0.3) {
        linefunc(1, intersects[0].point);
        hitObject = intersects[0].object;
        distance = intersects[0].distance;
      } else {
        // Endpunkt des "Laserstrahls": Startpunkt ist Cursor-Position,
        // Endpunkt berechnet aus Richtung und Startpunkt
        endRay.addVectors(position, direction.multiplyScalar(0.3)); //0.3
        linefunc(1, endRay);
        hitObject = undefined;
      }
    }

    if (grabbed && squeezed) {
      console.log("grabbed");
      if (grabbedObject !== undefined) {
        console.log("im in");
        endRay.addVectors(position, direction.multiplyScalar(distance));
        linefunc(1, endRay);
        let deltaPos = new THREE.Vector3();
        deltaPos.subVectors(initalCursorPos, position);
        deltaPos.x *= -0.01;
        deltaPos.z = 0; //0;
        deltaPos.y *= -0.01;
        console.log("deltaPos", deltaPos);

        if (isOnlyOneGrabbedactive) {
          world.matrix.decompose(worldPosition, worldRotation, worldScale);
          worldPosition.add(deltaPos);
          world.matrix.compose(worldPosition, worldRotation, worldScale);
        }
      } else if (hitObject) {
        grabbedObject = hitObject;
        console.log("grabbedObject", grabbedObject);
        console.log("hitObject", hitObject);
        inverseWorld = world.matrix.clone().invert();
        initialGrabbed = cursor.matrix.clone().invert().multiply(world.matrix);
        initalCursorPos = position.clone();
      }
    } else {
      grabbedObject = undefined;
      initalCursorPos = undefined;
    }
    // console.log("hitObject", hitObject);
    // console.log("distance", distance);

    return [grabbedObject, hitObject, initialGrabbed, initalCursorPos];
  }

  return { updateRay };
}
