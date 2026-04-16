import * as THREE from "three";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

(function () {
  var root = document.getElementById("deploy-game");
  if (!root) {
    return;
  }

  var statusEl = document.getElementById("deploy-status");
  var steps = Array.prototype.slice.call(document.querySelectorAll("#deploy-steps li"));
  var stageEl = document.getElementById("deploy-stage");
  var sceneEl = document.getElementById("deploy-scene");
  var keyEl = document.getElementById("deploy-key");
  var lockTargetEl = document.getElementById("deploy-lock-target");
  var fallbackButton = document.getElementById("deploy-open-fallback");
  var letterEl = document.getElementById("deploy-letter");
  var formEl = root.querySelector(".deploy-form");

  if (
    !statusEl ||
    !steps.length ||
    !stageEl ||
    !sceneEl ||
    !keyEl ||
    !lockTargetEl ||
    !fallbackButton ||
    !letterEl
  ) {
    return;
  }

  var state = {
    unlocked: false,
    letterOpen: false,
    dragging: false,
    pointerId: null,
    keyX: 0,
    keyY: 0,
    startKeyX: 0,
    startKeyY: 0,
    startPointerX: 0,
    startPointerY: 0,
    keyHomeRect: null,
    keyRotation: 0,
  };

  var sceneApi = null;

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function setStep(currentIndex) {
    steps.forEach(function (item, itemIndex) {
      item.classList.toggle("is-active", itemIndex === currentIndex);
      item.classList.toggle("is-done", itemIndex < currentIndex);
    });
  }

  function applyKeyTransform() {
    keyEl.style.transform =
      "translate(" + state.keyX + "px, " + state.keyY + "px) rotate(" + state.keyRotation + "deg)";
  }

  function captureKeyHomeRect() {
    var previousTransform = keyEl.style.transform;
    var previousTransition = keyEl.style.transition;

    keyEl.style.transition = "none";
    keyEl.style.transform = "translate(0px, 0px)";
    state.keyHomeRect = keyEl.getBoundingClientRect();
    keyEl.style.transform = previousTransform || "";
    keyEl.style.transition = previousTransition || "";
  }

  function isKeyOverLock() {
    var keyRect = keyEl.getBoundingClientRect();
    var lockRect = lockTargetEl.getBoundingClientRect();

    var keyCenterX = keyRect.left + keyRect.width / 2;
    var keyCenterY = keyRect.top + keyRect.height / 2;

    var tolerance = 12;
    return (
      keyCenterX >= lockRect.left - tolerance &&
      keyCenterX <= lockRect.right + tolerance &&
      keyCenterY >= lockRect.top - tolerance &&
      keyCenterY <= lockRect.bottom + tolerance
    );
  }

  function resetKeyPosition(animate) {
    state.keyX = 0;
    state.keyY = 0;
    state.keyRotation = 0;
    keyEl.classList.remove("is-inserted", "is-used");

    if (animate) {
      keyEl.classList.add("is-returning");
      window.setTimeout(function () {
        keyEl.classList.remove("is-returning");
      }, 360);
    }

    applyKeyTransform();
    lockTargetEl.classList.remove("is-hot");
  }

  function moveKeyToLock() {
    if (!state.keyHomeRect) {
      captureKeyHomeRect();
    }

    var lockRect = lockTargetEl.getBoundingClientRect();
    var homeCenterX = state.keyHomeRect.left + state.keyHomeRect.width / 2;
    var homeCenterY = state.keyHomeRect.top + state.keyHomeRect.height / 2;
    var lockCenterX = lockRect.left + lockRect.width / 2;
    var lockCenterY = lockRect.top + lockRect.height / 2;

    state.keyX = lockCenterX - homeCenterX;
    state.keyY = lockCenterY - homeCenterY;
    state.keyRotation = 90;

    keyEl.classList.add("is-returning", "is-inserted");
    applyKeyTransform();

    window.setTimeout(function () {
      keyEl.classList.add("is-used");
    }, 140);

    window.setTimeout(function () {
      keyEl.classList.remove("is-returning");
    }, 360);
  }

  function openLetter() {
    if (state.letterOpen) {
      return;
    }

    state.letterOpen = true;
    root.classList.add("is-letter-open");
    letterEl.setAttribute("aria-hidden", "false");

    setStep(3);
    setStatus("");

    fallbackButton.disabled = true;
    fallbackButton.textContent = "Skrzynia otwarta";
  }

  function unlockSequence() {
    if (state.unlocked) {
      return;
    }

    state.unlocked = true;
    root.classList.add("is-unlocked");
    lockTargetEl.classList.add("is-hot");

    setStep(1);
    setStatus("");
    moveKeyToLock();

    if (sceneApi && typeof sceneApi.unlock === "function") {
      sceneApi.unlock({
        onChestOpened: function () {
          setStep(2);
          setStatus("");
        },
        onLetterReady: function () {
          openLetter();
        },
      });
      return;
    }

    setStep(2);
    setStatus("");
    window.setTimeout(openLetter, 1400);
  }

  function startDrag(event) {
    if (state.unlocked) {
      return;
    }

    state.dragging = true;
    state.pointerId = event.pointerId;
    state.startPointerX = event.clientX;
    state.startPointerY = event.clientY;
    state.startKeyX = state.keyX;
    state.startKeyY = state.keyY;
    state.keyRotation = 90;

    keyEl.classList.add("is-dragging");
    keyEl.classList.remove("is-returning");
    keyEl.setPointerCapture(event.pointerId);
  }

  function moveDrag(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) {
      return;
    }

    var deltaX = event.clientX - state.startPointerX;
    var deltaY = event.clientY - state.startPointerY;

    state.keyX = state.startKeyX + deltaX;
    state.keyY = state.startKeyY + deltaY;
    applyKeyTransform();

    lockTargetEl.classList.toggle("is-hot", isKeyOverLock());
  }

  function endDrag(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) {
      return;
    }

    state.dragging = false;
    keyEl.classList.remove("is-dragging");
    keyEl.releasePointerCapture(event.pointerId);
    state.pointerId = null;

    if (isKeyOverLock()) {
      unlockSequence();
    } else {
      setStatus("");
      setStep(0);
      resetKeyPosition(true);
    }
  }

  function loadObj(loader, fileName) {
    return new Promise(function (resolve, reject) {
      loader.load(fileName, resolve, undefined, reject);
    });
  }

  function setupObjectMaterials(object) {
    object.traverse(function (child) {
      if (!child.isMesh) {
        return;
      }
      child.castShadow = true;
      child.receiveShadow = true;
      if (Array.isArray(child.material)) {
        child.material.forEach(function (material) {
          material.side = THREE.FrontSide;
        });
      } else if (child.material) {
        child.material.side = THREE.FrontSide;
      }
    });
  }

  async function initScene3D() {
    try {
      var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;
      sceneEl.appendChild(renderer.domElement);

      var scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x08121d, 4, 9.5);

      var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20);
      camera.position.set(0, 1.45, 3.7);

      var hemi = new THREE.HemisphereLight(0x98b8d7, 0x0b1320, 0.95);
      scene.add(hemi);

      var keyLight = new THREE.DirectionalLight(0xffe8b6, 1.2);
      keyLight.position.set(2.8, 3.6, 2.4);
      scene.add(keyLight);

      var rimLight = new THREE.DirectionalLight(0x67b4df, 0.55);
      rimLight.position.set(-3.1, 1.8, -2.6);
      scene.add(rimLight);

      var ground = new THREE.Mesh(
        new THREE.CircleGeometry(2.5, 72),
        new THREE.MeshPhongMaterial({
          color: 0x152639,
          emissive: 0x0d1d2f,
          shininess: 12,
          opacity: 0.85,
          transparent: true,
        })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.88;
      scene.add(ground);

      var mtlLoader = new MTLLoader();
      mtlLoader.setPath("assets/deploy-kit/models/");
      var materials = await new Promise(function (resolve, reject) {
        mtlLoader.load("deploy_assets.mtl", resolve, undefined, reject);
      });
      materials.preload();

      var objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.setPath("assets/deploy-kit/models/");

      var loaded = await Promise.all([
        loadObj(objLoader, "chest_closed.obj"),
        loadObj(objLoader, "chest_open.obj"),
        loadObj(objLoader, "key.obj"),
        loadObj(objLoader, "scroll.obj"),
        loadObj(objLoader, "lock.obj"),
      ]);

      var chestClosed = loaded[0];
      var chestOpen = loaded[1];
      var keyProp = loaded[2];
      var scroll = loaded[3];
      var lock = loaded[4];

      [chestClosed, chestOpen, keyProp, scroll, lock].forEach(setupObjectMaterials);

      chestClosed.scale.setScalar(1.16);
      chestClosed.position.set(0, -0.88, 0);
      scene.add(chestClosed);

      chestOpen.scale.setScalar(1.16);
      chestOpen.position.set(0, -0.88, 0);
      chestOpen.visible = false;
      scene.add(chestOpen);

      lock.scale.setScalar(1.18);
      lock.position.set(0, -0.38, 0.62);
      scene.add(lock);

      keyProp.scale.setScalar(0.82);
      keyProp.position.set(-1.55, -0.26, 0.9);
      keyProp.rotation.set(0.18, -0.62, 0.86);
      scene.add(keyProp);

      scroll.scale.set(1.42, 0.01, 1.42);
      scroll.position.set(0, -0.58, 0.08);
      scroll.visible = false;
      scene.add(scroll);

      var modelState = {
        unlocked: false,
        chestSwitched: false,
        scrollProgress: 0,
        unlockTime: 0,
        letterSignaled: false,
        callbacks: null,
      };

      function resize() {
        var width = sceneEl.clientWidth;
        var height = sceneEl.clientHeight;
        if (!width || !height) {
          return;
        }
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      }

      resize();
      window.addEventListener("resize", resize);

      var clock = new THREE.Clock();

      function animate() {
        var delta = Math.min(clock.getDelta(), 0.033);
        var elapsed = clock.elapsedTime;

        chestClosed.rotation.y = Math.sin(elapsed * 0.5) * 0.045;
        chestOpen.rotation.y = chestClosed.rotation.y;
        keyProp.rotation.z = 0.86 + Math.sin(elapsed * 1.35) * 0.06;
        keyProp.position.y = -0.26 + Math.sin(elapsed * 1.15) * 0.03;

        if (modelState.unlocked) {
          modelState.unlockTime += delta;

          if (!modelState.chestSwitched && modelState.unlockTime > 0.34) {
            chestClosed.visible = false;
            chestOpen.visible = true;
            modelState.chestSwitched = true;
            if (modelState.callbacks && typeof modelState.callbacks.onChestOpened === "function") {
              modelState.callbacks.onChestOpened();
            }
          }

          if (modelState.unlockTime > 0.62) {
            scroll.visible = true;
            modelState.scrollProgress = Math.min(1, modelState.scrollProgress + delta * 0.88);
            scroll.scale.y = 0.01 + modelState.scrollProgress;
            scroll.position.y = -0.58 + modelState.scrollProgress * 0.95;
          }

          if (modelState.scrollProgress >= 0.98 && !modelState.letterSignaled) {
            modelState.letterSignaled = true;
            if (modelState.callbacks && typeof modelState.callbacks.onLetterReady === "function") {
              modelState.callbacks.onLetterReady();
            }
          }
        }

        renderer.render(scene, camera);
        window.requestAnimationFrame(animate);
      }

      window.requestAnimationFrame(animate);

      return {
        unlock: function (callbacks) {
          modelState.unlocked = true;
          modelState.unlockTime = 0;
          modelState.chestSwitched = false;
          modelState.letterSignaled = false;
          modelState.scrollProgress = 0;
          modelState.callbacks = callbacks || null;
        },
        dispose: function () {
          window.removeEventListener("resize", resize);
          renderer.dispose();
        },
      };
    } catch (error) {
      console.error("QFS deploy game 3D init error:", error);
      setStatus("");
      return null;
    }
  }

  keyEl.addEventListener("pointerdown", startDrag);
  keyEl.addEventListener("pointermove", moveDrag);
  keyEl.addEventListener("pointerup", endDrag);
  keyEl.addEventListener("pointercancel", endDrag);
  keyEl.addEventListener("lostpointercapture", function () {
    if (!state.dragging || state.unlocked) {
      return;
    }
    state.dragging = false;
    keyEl.classList.remove("is-dragging");
    resetKeyPosition(true);
  });

  fallbackButton.addEventListener("click", function () {
    if (!state.unlocked) {
      setStatus("");
      unlockSequence();
      return;
    }
    openLetter();
  });

  if (formEl) {
    formEl.addEventListener("submit", function () {
      setStatus("Brief gotowy do wysyĹ‚ki. DziÄ™ki, wracamy do Ciebie z planem wdroĹĽenia.");
    });
  }

  window.addEventListener("resize", function () {
    if (!state.unlocked) {
      captureKeyHomeRect();
      resetKeyPosition(false);
    }
  });

  captureKeyHomeRect();
  setStep(0);
  setStatus("");

  initScene3D().then(function (api) {
    sceneApi = api;
  });
})();

