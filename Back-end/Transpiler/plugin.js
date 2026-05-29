const fs = require("fs");
const path = require("path");
const vm = require("vm");

let hooks = {};
let pluginsRegistry = {};
let embeddedPluginCounter = 0;

function register(priority, type, process, callback, pluginName = "global") {
  if (typeof callback !== "function") return;
  const hookKey = `${type}_${process}`;
  if (!hooks[hookKey]) {
    hooks[hookKey] = [];
  }
  hooks[hookKey].push({ callback, priority, pluginName });
  hooks[hookKey].sort((a, b) => b.priority - a.priority);
}

function isHookAllowedForMeta(hook, meta) {
  if (!meta) return true;
  if (!meta.pluginNames || meta.pluginNames.length === 0) return true;
  if (meta.pluginNames.includes(hook.pluginName)) return true;
  // also allow matching by declared plugin base name before embedded suffix
  const baseName = String(hook.pluginName).split("#embedded_")[0];
  return meta.pluginNames.includes(baseName);
}

function run(type, process, initialValue, ...args) {
  let currentValue = initialValue;
  const hookKey = `${type}_${process}`;
  const list = hooks[hookKey];
  let meta = null;
  if (args.length > 0) {
    const lastArg = args[args.length - 1];
    if (lastArg && typeof lastArg === "object" && lastArg.__pluginMeta === true) {
      meta = lastArg;
      args = args.slice(0, -1);
    }
  }
  if (list) {
    for (const item of list) {
      if (!isHookAllowedForMeta(item, meta)) continue;
      const plugin = pluginsRegistry[item.pluginName];
      if (!plugin || plugin.state === "ACTIVE") {
        const result = item.callback(currentValue, ...args);
        if (result !== undefined) {
          currentValue = result;
        }
      }
    }
  }
  return currentValue;
}

function clear() {
  hooks = {};
}

function parseEmbeddedHookSpec(body) {
  // v1 embedded plugin mini-language:
  // on <priority> <type> <process> => return <js-expression>;
  // on <type> <process> => return <js-expression>;
  // on syntax rule <ruleName> => return <js-expression>;
  const hooks = [];
  if (typeof body !== "string") return hooks;
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//"));

  for (const line of lines) {
    if (!line.startsWith("on ")) continue;
    const exprIndex = line.indexOf("=>");
    if (exprIndex === -1) continue;
    const left = line.slice(3, exprIndex).trim();
    let right = line.slice(exprIndex + 2).trim();
    if (right.endsWith(";")) right = right.slice(0, -1).trim();
    if (right.startsWith("return ")) right = right.slice(7).trim();

    const parts = left.split(/\s+/).filter(Boolean);
    let priority = 0;
    let startIdx = 0;
    if (!Number.isNaN(Number(parts[0]))) {
      priority = Number(parts[0]);
      startIdx = 1;
    }
    const tail = parts.slice(startIdx);
    if (tail.length >= 3 && tail[0] === "syntax" && tail[1] === "rule") {
      hooks.push({
        priority,
        type: "syntax",
        process: "customRule",
        ruleName: tail[2],
        expression: right,
      });
      continue;
    }
    if (tail.length >= 2) {
      hooks.push({
        priority,
        type: tail[0],
        process: tail[1],
        expression: right,
      });
    }
  }
  return hooks;
}

function createExpressionCallback(expression, extra = {}) {
  return function (currentValue, ...args) {
    const ctx = {
      value: currentValue,
      args,
      ...extra,
    };
    try {
      const fn = new Function("ctx", `return (${expression});`);
      return fn(ctx);
    } catch (error) {
      throw new Error(`Embedded plugin expression failed: ${error.message}`);
    }
  };
}

function addEmbeddedPlugin(def, options = {}) {
  if (!def || !def.name) {
    throw new Error("Embedded plugin definition is invalid");
  }
  const name = `${def.name}#embedded_${embeddedPluginCounter++}`;
  pluginsRegistry[name] = {
    name,
    path: "embedded",
    fullPath: "embedded",
    uses: [["*", "*"]],
    permissions: ["trusted", "embedded"],
    state: "ACTIVE",
    origin: "cdrca-embedded",
    scope: def.scope || "file",
    trusted: def.trusted !== false,
    source: def,
  };

  const parsedHooks = parseEmbeddedHookSpec(def.body || "");
  for (const hook of parsedHooks) {
    const cb = createExpressionCallback(hook.expression, {
      pluginName: def.name,
      ruleName: hook.ruleName || null,
      filePath: options.filePath || null,
    });
    register(hook.priority || 0, hook.type, hook.process, cb, name);
  }

  return { runtimeName: name, parsedHooks };
}

function getHookMap() {
  return hooks;
}

function seizePlugin(name) {
  if (pluginsRegistry[name]) {
    pluginsRegistry[name].state = "SEIZED";
    for (const hookKey of Object.keys(hooks)) {
      hooks[hookKey] = hooks[hookKey].filter(h => h.pluginName !== name);
    }
    console.error(`[Security] Plugin ${name} has been SEIZED and disabled.`);
  }
}

function getPluginsList() {
  return Object.keys(pluginsRegistry).map(name => ({
    name,
    state: pluginsRegistry[name].state,
    permissions: pluginsRegistry[name].permissions,
    uses: pluginsRegistry[name].uses
  }));
}

function stopPlugin(name) {
  const p = pluginsRegistry[name];
  if (!p) throw new Error(`Plugin ${name} not found`);
  if (p.state === "SEIZED") throw new Error(`Plugin ${name} is SEIZED and cannot be modified`);
  p.state = "HALTED";
}

function pausePlugin(name) {
  const p = pluginsRegistry[name];
  if (!p) throw new Error(`Plugin ${name} not found`);
  if (p.state === "SEIZED") throw new Error(`Plugin ${name} is SEIZED and cannot be modified`);
  p.state = "PAUSED";
}

function resumePlugin(name) {
  const p = pluginsRegistry[name];
  if (!p) throw new Error(`Plugin ${name} not found`);
  if (p.state === "SEIZED") throw new Error(`Plugin ${name} is SEIZED and cannot be modified`);
  p.state = "ACTIVE";
}

function restartPlugin(name) {
  const p = pluginsRegistry[name];
  if (!p) throw new Error(`Plugin ${name} not found`);
  if (p.state === "SEIZED") throw new Error(`Plugin ${name} is SEIZED and cannot be modified`);
  p.state = "ACTIVE";
  initializePlugin(p);
}

function addPlugin(config) {
  if (!config || !config.name || !config.path) {
    throw new Error("Invalid plugin configuration");
  }
  const pluginsDir = path.resolve(__dirname, "Plugins");
  const configPath = path.join(pluginsDir, "plugins.json");

  let list = [];
  if (fs.existsSync(configPath)) {
    try {
      list = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch (e) {
      list = [];
    }
  }

  list = list.filter(item => item.name !== config.name);
  list.push(config);

  fs.writeFileSync(configPath, JSON.stringify(list, null, 4));

  const fullPath = path.resolve(pluginsDir, config.path);
  pluginsRegistry[config.name] = {
    name: config.name,
    path: config.path,
    fullPath,
    uses: config.uses || [],
    permissions: config.permissions || [],
    state: "ACTIVE"
  };

  initializePlugin(pluginsRegistry[config.name]);
  console.log(`Plugin "${config.name}" added and loaded.`);
}

function initializePlugin(p) {
  for (const hookKey of Object.keys(hooks)) {
    hooks[hookKey] = hooks[hookKey].filter(h => h.pluginName !== p.name);
  }

  const sandboxedPlugin = {
    register: (priority, type, process, callback) => {
      if (p.state === "SEIZED") {
        throw new Error("Plugin is seized and cannot register hooks");
      }
      const isAllowed = p.uses.some(u => u[0] === type && u[1] === process);
      if (!isAllowed) {
        seizePlugin(p.name);
        throw new Error(`Security Violation: Hook registration for ${type}_${process} is not allowed. Plugin ${p.name} seized.`);
      }
      register(priority, type, process, callback, p.name);
    }
  };

  if (p.permissions.includes("trusted_sys")) {
    try {
      const pluginModule = require(p.fullPath);
      const hostAPI = { fs: require("fs"), child_process: require("child_process") };
      if (typeof pluginModule === "function") {
        pluginModule(sandboxedPlugin, hostAPI);
      } else if (pluginModule && typeof pluginModule.init === "function") {
        pluginModule.init(sandboxedPlugin, hostAPI);
      }
      return;
    } catch (err) {
      console.error(`Error loading trusted_sys plugin ${p.name}:`, err);
      throw err;
    }
  }

  const sandboxFs = {
    readFileSync: (filePath, options) => {
      const resolvedPath = path.resolve(filePath);
      const mpdDir = path.resolve(__dirname, "Plugins", "mutualPluginData");
      const isUnderMpd = resolvedPath.startsWith(mpdDir);

      if (isUnderMpd) {
        if (!p.permissions.includes("mpdRead") && !p.permissions.includes("fileRead")) {
          throw new Error("Permission Denied: mpdRead or fileRead required");
        }
      } else {
        if (!p.permissions.includes("fileRead")) {
          throw new Error("Permission Denied: fileRead required");
        }
      }
      return fs.readFileSync(resolvedPath, options);
    },
    writeFileSync: (filePath, data, options) => {
      const resolvedPath = path.resolve(filePath);
      const mpdDir = path.resolve(__dirname, "Plugins", "mutualPluginData");
      const isUnderMpd = resolvedPath.startsWith(mpdDir);

      if (isUnderMpd) {
        if (!p.permissions.includes("mpdWrite") && !p.permissions.includes("fileWrite")) {
          throw new Error("Permission Denied: mpdWrite or fileWrite required");
        }
      } else {
        if (!p.permissions.includes("fileWrite")) {
          throw new Error("Permission Denied: fileWrite required");
        }
      }
      if (isUnderMpd) {
        const parent = path.dirname(resolvedPath);
        fs.mkdirSync(parent, { recursive: true });
      }
      return fs.writeFileSync(resolvedPath, data, options);
    }
  };

  const sandboxChildProcess = {
    spawn: (command, args, options) => {
      if (!p.permissions.includes("spawnProcess")) {
        throw new Error("Permission Denied: spawnProcess required");
      }
      return require("child_process").spawn(command, args, options);
    },
    exec: (command, options, callback) => {
      if (!p.permissions.includes("spawnProcess")) {
        throw new Error("Permission Denied: spawnProcess required");
      }
      return require("child_process").exec(command, options, callback);
    },
    execSync: (command, options) => {
      if (!p.permissions.includes("spawnProcess")) {
        throw new Error("Permission Denied: spawnProcess required");
      }
      return require("child_process").execSync(command, options);
    }
  };

  const moduleObj = { exports: {} };
  const sandbox = {
    module: moduleObj,
    exports: moduleObj.exports,
    console: console,
    Buffer: Buffer,
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval
  };

  const context = vm.createContext(sandbox);
  try {
    const code = fs.readFileSync(p.fullPath, "utf-8");
    vm.runInContext(code, context, { filename: p.name + ".js" });

    const exposedAPI = {};
    if (p.permissions.includes("trusted")) {
      exposedAPI.fs = fs;
      exposedAPI.child_process = require("child_process");
    } else {
      exposedAPI.fs = sandboxFs;
      exposedAPI.child_process = sandboxChildProcess;
    }

    const exported = moduleObj.exports;
    if (typeof exported === "function") {
      exported(sandboxedPlugin, exposedAPI);
    } else if (exported && typeof exported.init === "function") {
      exported.init(sandboxedPlugin, exposedAPI);
    } else {
      throw new Error("Plugin does not export a function or an init() method on module.exports");
    }
  } catch (err) {
    console.error(`Error running plugin ${p.name}:`, err);
    throw err;
  }
}

function initPlugins() {
  const pluginsDir = path.resolve(__dirname, "Plugins");
  const configPath = path.join(pluginsDir, "plugins.json");
  const mpdDir = path.join(pluginsDir, "mutualPluginData");

  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
  }
  if (!fs.existsSync(mpdDir)) {
    fs.mkdirSync(mpdDir, { recursive: true });
  }
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify([], null, 4));
  }

  let list = [];
  try {
    list = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (err) {
    list = [];
  }

  pluginsRegistry = {};
  hooks = {};

  for (const item of list) {
    if (!item.name || !item.path) continue;
    const fullPath = path.resolve(pluginsDir, item.path);
    if (!fs.existsSync(fullPath)) continue;

    pluginsRegistry[item.name] = {
      name: item.name,
      path: item.path,
      fullPath,
      uses: item.uses || [],
      permissions: item.permissions || [],
      state: "ACTIVE"
    };

    try {
      initializePlugin(pluginsRegistry[item.name]);
    } catch (err) {
      console.error(`Failed to load plugin ${item.name}:`, err);
    }
  }
}

initPlugins();

module.exports = {
  register,
  run,
  clear,
  getHookMap,
  addEmbeddedPlugin,
  getPluginsList,
  stopPlugin,
  pausePlugin,
  resumePlugin,
  restartPlugin,
  addPlugin,
  initPlugins
};
