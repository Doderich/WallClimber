import * as THREE from "../99_Lib/three.module.min.js";
import { keyboard } from "./keyboard.mjs";
import { createVRcontrollers } from "./vr.mjs";
let initalCursorPos1, initalCursorPos2;

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

export function Ray(renderer, scene, world, cursor1, cursor2, objects) {
  let position1 = new THREE.Vector3(),
    position2 = new THREE.Vector3();

  let rotation1 = new THREE.Quaternion(),
    rotation2 = new THREE.Quaternion();
  let scale1 = new THREE.Vector3(),
    scale2 = new THREE.Vector3();
  let endRay1 = new THREE.Vector3(),
    endRay2 = new THREE.Vector3();
  let direction1 = new THREE.Vector3(),
    direction2 = new THREE.Vector3();

  const raycaster1 = new THREE.Raycaster(),
    raycaster2 = new THREE.Raycaster();

  let grabbed = false,
    squeezed = false;
  keyboard(" ", (state) => {
    console.log("grabbed", state);
    grabbed = state;
  });

  keyboard("s", (state) => {
    console.log("squeezed", state);
    squeezed = state;
  });

  let contrl1, info1, contrl2, info2;
  let { controller1, controller2 } = createVRcontrollers(
    scene,
    renderer,
    (current, src) => {
      console.log("current", current);
      console.log("src", src);
      // called if/when controllers connect
      if (src.handedness === "left") {
        cursor1.matrixAutoUpdate = false;
        cursor1.visible = false;
        contrl1 = current;
        info1 = src;
      } else {
        cursor2.matrixAutoUpdate = false;
        cursor2.visible = false;
        contrl2 = current;
        info2 = src;
      }

      console.log(`connected ${src.handedness} device`);
      renderer.xr.enabled = true;
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
    if (contrl1 || contrl2) {
      cursor1.matrix.copy(contrl1.matrix);
      cursor2.matrix.copy(contrl2.matrix);
      grabbed =
        controller1.controller.userData.isSelecting ||
        controller2.controller.userData.isSelecting;
      squeezed =
        controller1.controller.userData.isSqueezeing ||
        controller2.controller.userData.isSqueezeing;
      direction1.set(0, 0, -1);
      direction2.set(0, 0, -1);
    } else {
      cursor1.updateMatrix();
      cursor2.updateMatrix();
      direction1.set(0, 1, 0);
      direction2.set(0, 1, 0);
    }

    // Zerlegung der Matrix des Cursors in Translation, Rotation und Skalierung
    cursor1.matrix.decompose(position1, rotation1, scale1);
    cursor2.matrix.decompose(position2, rotation2, scale2);
    // Anwendung der CursorRotation auf Richtung
    direction1.applyQuaternion(rotation1);
    direction2.applyQuaternion(rotation2);

    // Startpunkt des "Laserstrahls" im Cursor
    lineFunc(0, position1);
    lineFunc(0, position2);

    if (grabbedObject === undefined) {
      raycaster1.set(position1, direction1);
      raycaster2.set(position2, direction2);
      const intersects1 = raycaster1.intersectObjects(objects);
      const intersects2 = raycaster2.intersectObjects(objects);

      if (intersects1.length) {
        lineFunc(1, intersects1[0].point);
        hitObject = intersects1[0].object;
        distance = intersects1[0].distance;
      } else {
        // Endpunkt des "Laserstrahls": Startpunkt ist Cursor-Position,
        // Endpunkt berechnet aus Richtung und Startpunkt
        endRay1.addVectors(position1, direction1.multiplyScalar(20));
        lineFunc(1, endRay1);
        hitObject = undefined;
      }
    }

    if (grabbed) {
      if (grabbedObject) {
        // grabbedObject.matrix.copy(cursor.matrix.clone().multiply(initialGrabbed));
        //grabbedObject.matrix.copy(inverseWorld.clone().multiply(cursor.matrix).multiply(initialGrabbed));
        endRay1.addVectors(position1, direction1.multiplyScalar(distance1));
        lineFunc(1, endRay1);
        let deltaPos = new THREE.Vector3();
        console.log(initalCursorPos1);
        deltaPos.subVectors(initalCursorPos1, position1);
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
        initialGrabbed = cursor1.matrix.clone().invert().multiply(world.matrix);
        initalCursorPos = position.clone();
      }
    } else {
      grabbedObject = undefined;
      initalCursorPos = undefined;
    }

    if (squeezed) {
      if (inverseHand !== undefined) {
        let differenceHand = cursor1.matrix.clone().multiply(inverseHand);
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
        inverseHand = cursor1.matrix.clone().invert();
      }
    } else {
      inverseHand = undefined;
    }
  }

  return { updateRay };
}
