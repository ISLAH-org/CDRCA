// bassically a template engine and nothing more,  kinda verbose not complex though  as needing to reshape ast partial transpiled code chunks into compaitble strs

function create() {
  function renderTemplate(template, input, context = {}) {
    let result = "";
    for (const element of template) {
      if ("str" in element) {
        result += element.str;
      } else if ("placeholder" in element) {
        const key = JSON.stringify(element.placeholder);
        if (key in input) {
          let values = input[key];
          if (element.preProcessor) {
            values = values.map(element.preProcessor);
          }
          let string = element.toString(values, context);
          if (element.postProcessor) {
            string = element.postProcessor(string);
          }
          result += string;
        } else {
          result += "/*[missing while PST translation at render template]*/";
        }
      } else if ("conditional" in element) {
        const conditionResult = element.conditional.condition(context);
        if (conditionResult && element.template) {
          result += renderTemplate(element.template, input, context);
        }
      }
    }
    return result;
  }
  /*
let ObjectAnimationSystem_INS = ObjectAnimationSystem();
 defining actions props stuff here
 let defaultGredientMap = [new THREE.DataTexture(
    new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255]),
    3,
    1,
    THREE.RGBFormat
  )]
let OAS_OBJ = {
  defaultGredientMap: defaultGredientMap[0],
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
}

// push to the anim (renderer) pipeline
currentANIM = ObjectAnimationSystem_INS.main(OAS_OBJ).init(60, true);
  */

  function general3DastToSTRplaceholder(placeholder, stringifyFN) {
    if (typeof stringifyFN !== "function") {
      stringifyFN = function (placeholder, x, y, z) {
        return placeholder[x][y][z].value + "\n\n";
      };
    }

    if (!placeholder)
      return "/*Placeholder was invelid during transpilation (CDRCA full transpiler -> general 3d ast for placeholders module*/";
    // console.log(placeholder[1][0][0].value);
    // 3 - d loop
    let str = "";
    for (let x = 0; x < placeholder.length; x++) {
      for (let y = 0; y < placeholder[x].length; y++) {
        for (let z = 0; z < placeholder[x][y].length; z++) {
          str += stringifyFN(placeholder, x, y, z);
        }
      }
    }
    // console.log(str);
    return str;
  }

  // by    gpt 4o
  function FNfactory(defaultParamsMap, fn, rejectionType, removeDefPram) {
    const defaultIndices = defaultParamsMap
      .map((val, idx) => (val !== rejectionType ? idx : -1))
      .filter((idx) => idx !== -1);

    const requiredIndices = defaultParamsMap
      .map((val, idx) => (val === rejectionType ? idx : -1))
      .filter((idx) => idx !== -1);

    return function (...inputArgs) {
      const finalArgs = [];

      let inputIdx = 0;

      for (let i = 0; i < defaultParamsMap.length; i++) {
        if (defaultParamsMap[i] === rejectionType) {
          if (inputArgs[inputIdx] === undefined) {
            throw new Error(`Missing required argument at position ${i}`);
          }
          finalArgs[i] = inputArgs[inputIdx];
          inputIdx++;
        } else {
          // default value
          finalArgs[i] = defaultParamsMap[i];
          if (!removeDefPram) {
            // Only consume arg if we are not removing default params
            if (inputArgs[inputIdx] !== undefined) {
              finalArgs[i] = inputArgs[inputIdx];
            }
            inputIdx++;
          }
        }
      }

      return fn(...finalArgs);
    };
  }
  let defaultSceneTemplate = [
    {
      placeholder: [
        "stayTimeInit",
        "stayTimeEnd",
        "lerpTime",
        "backgroundColor",
      ],
      toString: general3DastToSTRplaceholder,
    },
    {
      str: "PropsDef: [",
    },
    {
      placeholder: ["prop_use"],
      toString: FNfactory(
        [
          0,
          function (p, x, y, z) {
            return p[x][y][z].usageValue;
          },
        ],
        general3DastToSTRplaceholder,
        0,
        true
      ),
    },
    {
      str: `  ],
      actions: [`,
    },
    {
      placeholder: ["action_use"],
      toString: FNfactory(
        [
          0,
          function (p, x, y, z) {
            return p[x][y][z].usageValue;
          },
        ],
        general3DastToSTRplaceholder,
        0,
        true
      ),
    },
    {
      str: "]",
    },
  ];
  let defaultTemplateRenderer_OBJs = [
    {
      placeholder: ["ACTION_DEF", "PROP_DEF", "PROP_USE", "ACTION_USE"],
      toString: general3DastToSTRplaceholder,
    },

    {
      str: `var defaultGredientMap = [(function(){
  const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBFormat);
  tex.needsUpdate = true;
  return tex;
})()];`,
    },
    {
      placeholder: ["defaultGredientMap"],
      toString: general3DastToSTRplaceholder,
    },
    {
      str: `
var OAS_OBJ = {
  defaultGredientMap: defaultGredientMap[0],
  scenes: [ `,
    },

    {
      placeholder: ["scenes"],
      toString: transpileScenes,
    },
    {
      str: ` ],
    };
  
// push to the anim (renderer) pipeline
currentANIM = ObjectAnimationSystem_INS.main(OAS_OBJ).init(60, true);`,
    },
  ];
  function defaultTemplateRenderer(inps) {
    return renderTemplate(defaultTemplateRenderer_OBJs, inps, {});
  }
  function singleArtificialHeaderReshaper(stat, sessionContext) {
    let aht = stat.statements.prams.ArtificialHeader_TYPE;
    if (!aht) return { sessionContext: sessionContext };
    if (stat.statements.prams.gate === "opening") {
      switch (aht) {
        case "PROP_DEF":
        case "ACTION_DEF":
          sessionContext[aht].started = true;
          break;
        default:
          break;
      }
      return { sessionContext: sessionContext };
    } else if (stat.statements.prams.gate === "closing") {
      switch (aht) {
        case "PROP_DEF":
        case "ACTION_DEF":
          sessionContext[aht].ended = true;
          break;
        default:
          break;
      }
      return { sessionContext: sessionContext };
    } else {
      console.warn(
        " UNKNOWN Artificial Header, some bug in core transpiler Or plugins"
      );
      return { sessionContext: sessionContext };
    }
  }
  function singleReshape(stat, sessionContext = {}) {
    if (Object.keys(sessionContext).length == 0) {
      sessionContext = {
        // these need to be hoisted so we need to track them
        ACTION_DEF: {
          started: false,
          ended: false,
        },
        PROP_DEF: {
          started: false,
          ended: false,
        },

        // header / scene system
        Header: {
          lastGate: null,
        },

        Scene: {
          newSceneLastTime: false,
        },
      };
    }
    // console.log(stat.type);
    switch (stat.type) {
      case "Header":
        // console.log(stat.prams);
        // what we need to do is check if last time header was closed and this time opened then we just register a new scene started
        if (!sessionContext.Header.lastGate) {
          sessionContext.Header.lastGate = stat.prams.gate;
          // sessionContext.Header.lastGate = "closing";
          return [{ sessionContext: sessionContext, ignorePUSH: true }];
        }
        if (
          sessionContext.Header.lastGate === "closing" &&
          stat.prams.gate === "opening" &&
          !sessionContext.Scene.newSceneLastTime // this is only to prevent spamming like if subheader and header closes at same time etc
        ) {
          // console.log("newScene");
          sessionContext.Scene.newSceneLastTime = true;
          sessionContext.Header.lastGate = stat.prams.gate;
          return [
            {
              sessionContext: sessionContext,
              type: "scene",
              data: {
                scene: "new",
                header: stat,
                derivedFromHeader: true,
              },
            },
          ];
        }
        sessionContext.Scene.newSceneLastTime = false;
        sessionContext.Header.lastGate = stat.prams.gate;
        break;
      case "ArtificialHeader":
        // Always update sessionContext
        const reshaperResult = singleArtificialHeaderReshaper(
          stat,
          sessionContext
        );
        sessionContext = reshaperResult.sessionContext;
        return [{ sessionContext: sessionContext, ignorePUSH: true }];

      // statments for hoisting
      case "ACTION_DEF":
      case "PROP_DEF":
        // console.log(stat.type);
        if (
          !(
            sessionContext[stat.type].started &&
            !sessionContext[stat.type].ended
          ) &&
          !stat.metaData.formationHistory.embeeded.embeeded // this is to handel the import statments (intentionally different hositing if using import instead of addImport)
        ) {
          console.log(
            "bug in hoisting eaither core post semantic analyizer OR some plugin",
            sessionContext,
            stat,
            "ignoring this warning , and continuing the item though pipeline, may cause weird behaviour"
          );
        }
        return [
          {
            type: stat.type,
            data: stat,
            sessionContext: sessionContext,
          },
        ];

        // console.log(stat);
        break;

      // statments with conservation of order
      // mainly the used and USED types (define use / register use)
      case "ACTION_USE":
      case "PROP_USE":
        // console.log(stat);
        return [
          {
            type: stat.type,
            data: stat,
            sessionContext: sessionContext,
          },
          {
            type: String(stat.type).toLowerCase(),
            data: stat,
            sessionContext: sessionContext,
          },
        ];
        break;
      default:
        return [
          {
            type: stat.type,
            data: stat,
            sessionContext: sessionContext,
          },
        ];
        break;
    }
  }
  function reshapeToInps(PST) {
    let sessionContext = {};
    let inputs = {
      // defs
      ACTION_DEF: [],
      PROP_DEF: [],
      // used (define use)
      PROP_USE: [],
      ACTION_USE: [],
      // defaults
      defaultGredientMap: [],
      stayTimeInit: [],
      stayTimeEnd: [],
      lerpTime: [],
      backgroundColor: [],
      // used (register use)
      prop_use: [],
      action_use: [],
      // system, logs
      errorsLOGS: [],
      scenes: [],
    };

    let scenesSpecificInputs = [
      "prop_use",
      "action_use",
      "stayTimeInit",
      "stayTimeEnd",
      "lerpTime",
      "backgroundColor",
    ];

    // console.log(PST.length);

    for (let i = 0; i < PST.length; i++) {
      // console.log(PST[i]);
      let r = singleReshape(PST[i], sessionContext) || [];

      for (let j = 0; j < r.length; j++) {
        if (!r[j].ignorePUSH && Boolean(inputs[r[j].type || "errorsLOGS"])) {
          inputs[r[j].type || "errorsLOGS"].push(
            r[j].data ||
              "undefined data from result of PST translation " + i + ":" + j
          );
        }

        sessionContext = r[j].sessionContext;

        if (r[j].type === "scene" && r[j].data && r[j].data.scene === "new") {
          inputs.scenes.push({});
          for (let k = 0; k < scenesSpecificInputs.length; k++) {
            inputs.scenes[inputs.scenes.length - 1][scenesSpecificInputs[k]] =
              JSON.parse(JSON.stringify(inputs[scenesSpecificInputs[k]]));
            inputs[scenesSpecificInputs[k]] = [];
          }
        }
      }
    }
    if (sessionContext.Scene.newSceneLastTime) return inputs;

    // remaining unpushed data is added as final scene
    let hasLeftoverSceneData = scenesSpecificInputs.some(
      (key) => inputs[key].length > 0
    );
    if (hasLeftoverSceneData) {
      let finalScene = {};
      for (let k = 0; k < scenesSpecificInputs.length; k++) {
        finalScene[scenesSpecificInputs[k]] = inputs[scenesSpecificInputs[k]];
        inputs[scenesSpecificInputs[k]] = [];
      }
      inputs.scenes.push(finalScene);
    }

    return inputs;
  }

  // contains hardcoded logic TODO generlize stuff so its easier for future PLUGINS system or something
  function chunkInps(input, template = defaultTemplateRenderer_OBJs) {
    const placeholderArrays = template
      .filter((obj) => Array.isArray(obj.placeholder))
      .map((obj) => obj.placeholder);
    // .filter((arr) => arr.length > 1);
    const grouped = {};
    for (const arr of placeholderArrays) {
      const key = JSON.stringify(arr);
      grouped[key] = arr.map((name) => [input[name]]);
    }

    return {
      ...grouped,
      ...input,
    };
  }
  function transpileScenes(scenes) {
    let STRscenes = [];
    scenes = scenes.flat(Infinity);
    // console.log(JSON.stringify(scenes, null, 2));
    for (let i = 0; i < scenes.length; i++) {
      // console.log(scenes[i]);
      let input = scenes[i];
      input = chunkInps(input, defaultSceneTemplate);
      // console.log(input);
      let str = renderTemplate(defaultSceneTemplate, input);
      STRscenes.push(`{${str}}`);
    }
    return STRscenes.join(", \n\n");
  }
  //PST = Post semantic tree
  function transpile(PST) {
    // console.log(PST.length);
    let inps = reshapeToInps(PST) || {};
    // console.log(inps);
    inps = chunkInps(inps);
    let r = defaultTemplateRenderer(inps);
    return r || "PST err";
  }

  return { transpile };
}
module.exports = { create };
