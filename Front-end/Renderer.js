let ObjectAnimationSystem = function () {
  // Core renderer dont edit
  function CORE_3dFramesRenderer(FPS, loopAtEnd, ObjectsOverTime, gradientMap) {
    const DeltaFrame = 1 / FPS;
    let totalFrames = 0;
    let currentOOT = 0;
    let currentStartTime = 0;

    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    const canvas = document.getElementById("THRREjsRender");
    const renderer = new THREE.WebGLRenderer({ canvas: canvas });
    renderer.setSize(window.innerWidth / 2, window.innerHeight / 2);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7.5);
    scene.add(light);
    scene.add(light.target);
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    camera.position.z = 5;

    function runmodifier(modifier, params, defaultReturn) {
      return new Function(
        `return function main(${params.join(
          ","
        )}) { ${modifier}; return ${defaultReturn} }`
      )();
    }

    function addOutlineToMesh(mesh, color, opacity) {
      const outlineMaterial = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.BackSide,
        transparent: opacity < 1,
        opacity: opacity,
        depthWrite: false,
      });
      const outlineMesh = new THREE.Mesh(
        mesh.geometry.clone(),
        outlineMaterial
      );
      outlineMesh.scale.multiplyScalar(1.05);
      mesh.add(outlineMesh);
      return mesh;
    }

    function getOBJmesh(obj, totalTime, lerpProgress, step) {
      let mesh;
      if (obj.createMesh) {
        let geometry = obj.Geometry;
        let material = obj.Material.clone();
        if (obj.modifier.geometry && obj.modifier.geometry !== "") {
          geometry = runmodifier(
            obj.modifier.geometry,
            ["geometry", "material", "totalTime", "lerpProgress", "step"],
            "geometry"
          )(geometry, material, totalTime, lerpProgress, step);
        }
        mesh = new THREE.Mesh(geometry, material);
      } else {
        mesh = obj.Mesh;
      }
      if (obj.modifier.mesh) {
        if (typeof obj.modifier.mesh === "function") {
          mesh = obj.modifier.mesh(mesh, totalTime, lerpProgress, step);
        } else if (obj.modifier.mesh !== "") {
          mesh = runmodifier(
            obj.modifier.mesh,
            ["mesh", "totalTime", "lerpProgress", "step"],
            "mesh"
          )(mesh, totalTime, lerpProgress, step);
        }
      }
      if (obj.outline && obj.outline.render) {
        mesh = addOutlineToMesh(
          mesh,
          obj.outline.color,
          obj.outline.opacity * lerpProgress
        );
      }
      if (mesh.material) {
        mesh.material.transparent = true;
        mesh.material.opacity = lerpProgress;
      }
      return mesh;
    }

    let trackedScene = [];
    let framesNum_tracker = 0;
    let isTracking = true;

    function getIsTracking() {
      return isTracking;
    }

    async function getTrackedResult(endTrackingFn = () => isTracking) {
      if (!endTrackingFn(framesNum_tracker)) {
        return trackedScene;
      }

      await new Promise((resolve) => {
        requestAnimationFrame(async function () {
          await getTrackedResult(endTrackingFn);
          resolve();
        });
      });
    }

    function trackManager(doTrackFn = () => true) {
      isTracking = doTrackFn(framesNum_tracker);
      return getTrackedResult;
    }

    function addToScene(sceneINS, item) {
      sceneINS.add(item);
      if (!isTracking) return;
      if (!trackedScene[framesNum_tracker])
        trackedScene[framesNum_tracker] = [];
      trackedScene[framesNum_tracker].push(item);
    }

    function clearScene(sceneINS) {
      sceneINS.clear();
      if (!isTracking) return;
      framesNum_tracker += 1;
    }

    function updateScene(totalTime, lerpProgress) {
      scene.clear();
      scene.add(light);
      scene.add(light.target);
      scene.add(ambientLight);
      renderer.setClearColor(ObjectsOverTime[currentOOT].backgroundColor);
      const objs = ObjectsOverTime[currentOOT].Objects;
      for (let i = 0; i < objs.length; i++) {
        scene.add(getOBJmesh(objs[i], totalTime, lerpProgress, 1));
      }
    }
    var ForcedHult = false;
    function instantHault() {
      ForcedHult = true;
    }
    function instantUnhault() {
      ForcedHult = false;
    }
    function animate(timestamp) {
      if (!ForcedHult) requestAnimationFrame(animate);
      totalFrames += 1;
      if (currentStartTime === 0) currentStartTime = timestamp;

      let elapsed = timestamp - currentStartTime;
      let currentEntry = ObjectsOverTime[currentOOT];

      while (elapsed >= currentEntry.lerpTime + currentEntry.stayTime) {
        if (loopAtEnd) {
          currentOOT = (currentOOT + 1) % ObjectsOverTime.length;
        } else if (currentOOT < ObjectsOverTime.length - 1) {
          currentOOT += 1;
        } else {
          break;
        }
        currentStartTime += currentEntry.lerpTime + currentEntry.stayTime;
        elapsed = timestamp - currentStartTime;
        currentEntry = ObjectsOverTime[currentOOT];
      }

      const totalTime = timestamp / 1000;
      let lerpProgress = 1;
      if (elapsed < currentEntry.lerpTime) {
        lerpProgress = THREE.MathUtils.lerp(
          0,
          1,
          elapsed / currentEntry.lerpTime
        );
      }
      updateScene(totalTime, lerpProgress);
      renderer.render(scene, camera);
    }

    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return {
      goToNextOOT: () => currentOOT++,
      init: () => animate(0),
      instantHault,
      instantUnhault,
      getHault: () => ForcedHult,
      getIsTracking,
      trackManager,
      getTrackedResult,
    };
  }

  const CORE_3d_PROPSsceneSYS = (function () {
    class Prop {
      constructor() {
        this.initPRE();
        // super();
        this.default = {
          namePrefix: "BASIC_PROP",
        };
        this.knownProps = {};
        this.propType = [["basicProp"]]; // its a 2d arr because you have context like  type 1 -> type 2     but also type N -> Type M     so letting having mutliple tags where each tag refers to TYPE abstraction   tells exact composition of props (maybe useful in animation tracking)
        this.initPOST();
      }
      addType(type, index) {
        this.propType[Math.min(this.propType.length, index)].push(type);
      }

      initPRE() {
        // console.warn("initPRE not defined for prop", this);
      }

      initPOST() {
        // console.warn("initPRE not defined for prop", this);
      }

      getObjectConfig() {
        throw new Error(
          "getObjectConfig must be implemented for the prop",
          this
        );
      }
      modifyMesh(mesh, totalTime, lerpProgress, step) {
        return mesh;
      }
      giveMessage(message) {
        if (!message.type || !message.value) return;
        this.onmessage(message);
      }
      onmessage(message) {
        console.warn("Message was given no, handling done", message, this);
      }
      sendMessage(message, propName) {
        if (!message.type || !message.value) {
          console.warn("message invelid, message");
          return;
        }
        try {
          this.knownProps[propName].giveMessage(message);
        } catch (error1) {
          try {
            propName.giveMessage(message);
          } catch (error2) {
            console.error(
              "tried " +
                propName +
                " as name got error, tried it as prop and also got err",
              error1,
              error2,
              this
            );
          }
        }
        return;
      }
    }

    class RotatingCubeProp extends Prop {
      initPRE() {
        this.name = "rotatingCube";
      }
      initPOST() {}
      constructor(color, rotationSpeed) {
        super();
        this.color = color;
        this.rotationSpeed = rotationSpeed;
      }

      modifyMesh(mesh, totalTime) {
        mesh.rotation.x = totalTime * this.rotationSpeed;
        mesh.rotation.y = totalTime * this.rotationSpeed;
        return mesh;
      }
      getObjectConfig() {
        return {
          Geometry: new THREE.BoxGeometry(),
          Material: (() => {
            const material = new THREE.MeshToonMaterial({ color: this.color });
            material.gradientMap = this.gradientMap;
            return material;
          })(),
          outline: { render: true, color: this.color, opacity: 0.5 },
          createMesh: true,
          modifier: { mesh: this.modifyMesh.bind(this) },
        };
      }
      sampleMovementAction(mesh, totalTime, lerpProgress, step) {
        mesh.position.x = Math.sin(totalTime);
        mesh.position.y = Math.cos(totalTime);
        return mesh;
      }
    }

    class BouncingSphereProp extends Prop {
      initPRE() {
        this.name = "BouncingSphereProp";
      }
      initPOST() {}
      modifyMesh(mesh, totalTime) {
        mesh.position.y = Math.sin(totalTime) * 1;
        mesh.rotation.z = totalTime * 1.5;
        return mesh;
      }

      getObjectConfig() {
        return {
          Geometry: new THREE.SphereGeometry(0.7, 32, 32),
          Material: (() => {
            const material = new THREE.MeshToonMaterial({ color: 0xff0000 });
            material.gradientMap = this.gradientMap;
            return material;
          })(),
          outline: { render: true, color: 0xffff00, opacity: 0.5 },
          createMesh: true,
          modifier: { mesh: this.modifyMesh.bind(this) },
        };
      }
    }
    // Deep clone with circular reference support for class instances
    function deepClone(obj, seen = new WeakMap()) {
      if (obj === null || typeof obj !== "object") return obj;

      if (seen.has(obj)) return seen.get(obj);

      let clone;
      if (Array.isArray(obj)) {
        clone = [];
        seen.set(obj, clone);
        obj.forEach((item, i) => {
          clone[i] = deepClone(item, seen);
        });
        return clone;
      }

      // Handle class instances
      clone = Object.create(Object.getPrototypeOf(obj));
      seen.set(obj, clone);

      for (let key of Reflect.ownKeys(obj)) {
        clone[key] = deepClone(obj[key], seen);
      }

      return clone;
    }

    class Scene {
      constructor(lerpTime, stayTime, backgroundColor, props) {
        this.lerpTime = lerpTime;
        this.stayTime = stayTime;
        this.backgroundColor = backgroundColor;

        let knownProps = {};
        for (let prop of props) {
          // whatever  it works
          knownProps[
            String(
              prop.name ||
                (() => {
                  prop.default = prop.default.namePrefix || "";
                  let r = prop.default + "#" + Math.random() * 10 ** 17; // for int
                  prop.name = r;
                  return r;
                })()
            )
          ] = prop;
        }
        for (let prop of props) {
          // prop.knownProps = structuredClone(knownProps);
          prop.knownProps = deepClone(knownProps);
        }
        this.props = props;
      }
      getConfig() {
        return {
          lerpTime: this.lerpTime,
          stayTime: this.stayTime,
          backgroundColor: this.backgroundColor,
          Objects: this.props.map((prop) => prop.getObjectConfig()),
        };
      }
    }

    // Public API
    return {
      Prop,
      exampleProps: {
        RotatingCubeProp,
        BouncingSphereProp,
      },
      Scene,
      init(FPS, loopAtEnd, scenes, gradientMap) {
        const objectsOverTime = scenes.map((scene) => scene.getConfig());
        const renderer = CORE_3dFramesRenderer(
          FPS,
          loopAtEnd,
          objectsOverTime,
          gradientMap
        );
        renderer.init();
        return renderer;
      },
    };
  })();

  class ActionProp extends CORE_3d_PROPSsceneSYS.Prop {
    constructor(baseProp, modifier) {
      super();
      this.baseProp = baseProp;
      this.modifier = modifier || {};
    }
    getObjectConfig() {
      const config = this.baseProp.getObjectConfig();
      config.modifier.mesh = this.modifier;
      return config;
    }
  }
  // PSA_SYS function abstracts prop system with actions system
  function PSA_SYS(PSA) {
    const scenes = [];
    for (const psaScene of PSA.scenes) {
      scenes.push(
        new CORE_3d_PROPSsceneSYS.Scene(
          psaScene.lerpTime,
          psaScene.stayTimeInit,
          psaScene.backgroundColor,
          psaScene.PropsDef
        )
      );
      for (const action of psaScene.actions) {
        const modifierFunctions = action.action(psaScene.PropsDef);
        const actionProps = psaScene.PropsDef.map(
          (prop, index) => new ActionProp(prop, modifierFunctions[index])
        );
        scenes.push(
          new CORE_3d_PROPSsceneSYS.Scene(
            action.lerpTime,
            action.stayTime,
            psaScene.backgroundColor,
            actionProps
          )
        );
      }
      scenes.push(
        new CORE_3d_PROPSsceneSYS.Scene(
          0,
          psaScene.stayTimeEnd,
          psaScene.backgroundColor,
          psaScene.PropsDef
        )
      );
    }
    let rendererInstance = null;
    function init(FPS, loopAtEnd) {
      const gradientMap = PSA.defaultGredientMap || PSA.defaultGradientMap;
      rendererInstance = CORE_3d_PROPSsceneSYS.init(
        FPS,
        loopAtEnd,
        scenes,
        gradientMap
      );
      // Expose renderer controls at the edge
      return {
        instantHault: rendererInstance.instantHault,
        goToNextOOT: rendererInstance.goToNextOOT,
        instantUnhault: rendererInstance.instantUnhault,
        rendererInstance: rendererInstance,
        haulted: rendererInstance.getHault,
        init: init,
      };
    }
    return {
      init,
      getRendererInstance: () => rendererInstance,
    };
  }

  return {
    main: PSA_SYS,
    baseProp: CORE_3d_PROPSsceneSYS.Prop,
    CORE_3dFramesRenderer: CORE_3dFramesRenderer,
    CORE_3d_PROPSsceneSYS: CORE_3d_PROPSsceneSYS,
  };
  // const PSA = {
  //   defaultGredientMap: new THREE.DataTexture(
  //     new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255]),
  //     3,
  //     1,
  //     THREE.RGBFormat
  //   ),
  //   scenes: [
  //     {
  //       stayTimeInit: 1000,
  //       stayTimeEnd: 1000,
  //       lerpTime: 500,
  //       backgroundColor: 0x000000,
  //       PropsDef: [
  //         new CORE_3d_PROPSsceneSYS.exampleProps.RotatingCubeProp(0x00ff00, 1),
  //       ],
  //       actions: [
  //         {
  //           stayTime: 2000,
  //           lerpTime: 500,
  //           action: (PropsArr) => {
  //             // u can also call any method and hence do default stuff too
  //             // if (PropsArr[0].doAction) {
  //             //   PropsArr[0].doAction(); // after this commit are supported
  //             // }
  //             return PropsArr.map(
  //               (prop) => (mesh, totalTime, lerpProgress, step) => {
  //                 mesh.position.x = Math.sin(totalTime);
  //                 return mesh;
  //               }
  //             );
  //           },
  //         },
  //       ],
  //     },
  //   ],
  // };

  // PSA_SYS(PSA).init(60, false);
};
let ObjectAnimationSystem_INS = ObjectAnimationSystem();
