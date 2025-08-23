let currentANIM = null;

// placeholder  as default demo
currentANIM = ObjectAnimationSystem_INS.main({
  defaultGredientMap: new THREE.DataTexture(
    new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255]),
    3,
    1,
    THREE.RGBFormat
  ),
  scenes: [
    {
      stayTimeInit: 1000,
      stayTimeEnd: 1000,
      lerpTime: 500,
      backgroundColor: 0x000000,
      PropsDef: [
        new ObjectAnimationSystem_INS.CORE_3d_PROPSsceneSYS.exampleProps.RotatingCubeProp(
          0x00ff00,
          1
        ),
      ],
      actions: [
        {
          stayTime: 2000,
          lerpTime: 500,
          action: (PropsArr) => {
            // u can also call any method and hence do default stuff too
            // if (PropsArr[0].doAction) {
            //   PropsArr[0].doAction(); // after this commit are supported
            // }
            return PropsArr.map(
              (prop) => (mesh, totalTime, lerpProgress, step) => {
                mesh.position.x = Math.sin(totalTime);
                mesh.position.y = Math.cos(totalTime);
                return mesh;
              }
            );
          },
        },
      ],
    },
  ],
}).init(60, true);

async function refreshPreview(fileSYS = null) {
  var fileSystem =
    fileSYS ||
    (await (async function () {
      const iframeTextEditer = document.getElementById("textEditer");
      if (!iframeTextEditer) {
        console.error("iframe with id 'textEditer' not found.");
        return;
      }

      // Helper to wait for the iframe to load if needed
      if (!iframeTextEditer.contentWindow) {
        await new Promise((resolve) => {
          iframeTextEditer.addEventListener("load", resolve, { once: true });
        });
      }

      // Send the message and wait for the reply
      const payload = await new Promise((resolve) => {
        function handleMessage(event) {
          if (
            event.source === iframeTextEditer.contentWindow &&
            event.data &&
            event.data.type === "fileSystem"
          ) {
            window.removeEventListener("message", handleMessage);
            resolve(event.data.payload);
          }
        }
        window.addEventListener("message", handleMessage);
        iframeTextEditer.contentWindow.postMessage(
          { type: "getFileSystem" },
          "*"
        );
      });

      return payload;
    })()) ||
    {};
  return updateRenderer(await transpileCDRCA(fileSystem));
}
function updateRenderer(newJScode) {
  if (currentANIM) {
    currentANIM.instantHault();
  }

  try {
    const previousAnimKey = Math.random();
    currentANIM.checkAnimKey = previousAnimKey;
    // Evaluate new code
    eval(newJScode);

    if (currentANIM.checkAnimKey === previousAnimKey) {
      console.error("Animation was not updated by the new code");
      return;
    }

    // Initialize new animation
    currentANIM = currentANIM.init(60, true);
    console.log("Successfully re-rendered");
  } catch (err) {
    console.error("Error updating renderer:", err);
  }
}
