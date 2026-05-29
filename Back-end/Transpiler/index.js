// common systems
const COMMON = require("./commonUtility");

// processes
const tokenizer = require("./Tokenizer");
const parser = require("./Parser");
const Partial_transpiler = require("./Partial_transpiler");
const postSemanticAnalyzier = require("./postSemanticAnalyizer");
const fullTranspiler = require("./FullTranspiler");
const postOptionalParser = require("./PostOptionalParsing");
const pluginAPI = require("./plugin");

// system imports
const miniSYS = require("./MINI_SYS/index");

// creations
// common systems
let COMMON_INS = COMMON.create();

// system stuff

const sysPrams = { miniSYS };

// pipeline stuff
let parser_INS = parser.create(tokenizer.defaultTokenizer, pluginAPI);
let partial_transpiler_INS = Partial_transpiler.create(
  parser_INS,
  sysPrams,
  pluginAPI
);
let postSemanticAnalyizer_INS = postSemanticAnalyzier.create(sysPrams);
let fullTranspiler_INS = fullTranspiler.create(sysPrams);
let postOptionalParser_INS = postOptionalParser.create(sysPrams);

// uses basic but linux type paths  idk if windows dont have ~ etc
function getVFScontentUnitpath(vfs, path) {
  if (typeof path !== "string") {
    throw new Error("Path must be a string");
  }

  let parts = path.trim().split("/");

  let stack = [];

  if (path.startsWith("/") || path.startsWith("~") || path.startsWith("./")) {
    stack = [];
  }

  for (let part of parts) {
    if (part === "" || part === "." || part === "~") {
      continue;
    } else if (part === "..") {
      if (stack.length > 0) {
        stack.pop();
      }
    } else {
      stack.push(part);
    }
  }

  let current = vfs;
  for (let segment of stack) {
    if (typeof current !== "object" || !(segment in current)) {
      throw new Error(`Path not found: ${path}`);
    }
    current = current[segment];
  }

  return current;
}

function getVFScontent(vfs, path) {
  if (!Array.isArray(path)) {
    return getVFScontentUnitpath(vfs, String(path));
  }
  let r;
  for (let i = 0; i < path.length; i++) {
    try {
      r = getVFScontentUnitpath(vfs, String(path[i]));
      break;
    } catch (error) {
      continue;
    }
  }
  return r;
}

function loadPluginsFromOptions(options) {
  if (options && options.plugins && !options._pluginsLoaded) {
    pluginAPI.clear();
    for (const plugin of options.plugins) {
      if (typeof plugin === "function") {
        plugin(pluginAPI);
      }
    }
    options._pluginsLoaded = true;
  }
}

function collectPluginStatements(ast, result = []) {
  if (!Array.isArray(ast)) return result;
  for (const node of ast) {
    if (!node) continue;
    if (node.TYPE === "STATEMENTS" && Array.isArray(node.VALUE)) {
      for (const st of node.VALUE) {
        if (st && st.type === "PLUGIN_DEF") {
          result.push(st);
        }
      }
    }
    if (node.TYPE === "HEADER" && node.VALUE && Array.isArray(node.VALUE.CODE)) {
      collectPluginStatements(node.VALUE.CODE, result);
    } else if (node["SUB-HEADER"] && Array.isArray(node["SUB-HEADER"])) {
      const sh = node["SUB-HEADER"][0];
      if (sh && Array.isArray(sh.CODE)) collectPluginStatements(sh.CODE, result);
    }
  }
  return result;
}

function compileEmbeddedPluginsFromAst(ast, options = {}) {
  const pluginDefs = collectPluginStatements(ast, []);
  const compiled = [];
  for (const defNode of pluginDefs) {
    const out = pluginAPI.addEmbeddedPlugin(defNode.prams, options);
    compiled.push({
      declaredName: defNode.prams.name,
      runtimeName: out.runtimeName,
      hooks: out.parsedHooks,
      scope: defNode.prams.scope,
      trusted: defNode.prams.trusted,
    });
  }
  return compiled;
}

function derivePluginSelectionFromAst(ast) {
  const fileRequires = new Set();
  const fileSyntaxPlugins = new Set();
  const headerMeta = [];

  function walk(nodes, path = []) {
    if (!Array.isArray(nodes)) return;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node) continue;
      if (node.TYPE === "STATEMENTS" && Array.isArray(node.VALUE)) {
        for (const st of node.VALUE) {
          if (!st || !st.type || !st.prams) continue;
          if (st.type === "REQUIRES_PLUGINS") {
            (st.prams.values || []).forEach((v) => fileRequires.add(v));
          } else if (st.type === "SYNTAX_PLUGINS") {
            (st.prams.values || []).forEach((v) => fileSyntaxPlugins.add(v));
          }
        }
      } else if (node.TYPE === "HEADER" && node.VALUE) {
        const p = path.concat(`H${i}`);
        const meta = (node.VALUE && node.VALUE.META) || {};
        headerMeta.push({
          path: p,
          requires: Array.isArray(meta.requires) ? meta.requires : [],
          syntaxPlugins: Array.isArray(meta.syntaxPlugins) ? meta.syntaxPlugins : [],
        });
        walk(node.VALUE.CODE, p);
      } else if (node["SUB-HEADER"] && Array.isArray(node["SUB-HEADER"])) {
        const sh = node["SUB-HEADER"][0];
        if (!sh) continue;
        const p = path.concat(`S${i}`);
        const meta = sh.META || {};
        headerMeta.push({
          path: p,
          requires: Array.isArray(meta.requires) ? meta.requires : [],
          syntaxPlugins: Array.isArray(meta.syntaxPlugins) ? meta.syntaxPlugins : [],
        });
        walk(sh.CODE, p);
      }
    }
  }

  walk(ast);
  return {
    fileRequires: Array.from(fileRequires),
    fileSyntaxPlugins: Array.from(fileSyntaxPlugins),
    headerMeta,
  };
}

function buildPluginMeta(options = {}, extras = {}) {
  const names = new Set();
  const selected = options.pluginSelection || {};
  (selected.fileRequires || []).forEach((n) => names.add(n));
  (selected.fileSyntaxPlugins || []).forEach((n) => names.add(n));
  if (Array.isArray(options.embeddedPlugins)) {
    options.embeddedPlugins.forEach((p) => {
      if (p && p.declaredName) names.add(p.declaredName);
      if (p && p.runtimeName) names.add(p.runtimeName);
    });
  }
  if (Array.isArray(extras.pluginNames)) extras.pluginNames.forEach((n) => names.add(n));
  return {
    __pluginMeta: true,
    pluginNames: Array.from(names),
    ...extras,
  };
}

function tillPartialTranspilationTranspiler_UniFile(cdrcaCode, options) {
  loadPluginsFromOptions(options);
  let code = pluginAPI.run(
    "before",
    "parse",
    cdrcaCode,
    options,
    buildPluginMeta(options, { stage: "before_parse" })
  );

  // tokenization to parsing
  let ast = parser_INS.parse(code);
  options.pluginSelection = derivePluginSelectionFromAst(ast);
  options.embeddedPlugins = compileEmbeddedPluginsFromAst(ast, options);
  ast = pluginAPI.run(
    "after",
    "parse",
    ast,
    options,
    buildPluginMeta(options, { stage: "after_parse", astMeta: options.pluginSelection })
  );
  ast = pluginAPI.run(
    "before",
    "partialTranspile",
    ast,
    options,
    buildPluginMeta(options, { stage: "before_partialTranspile" })
  );

  // parses induvidual statments and chunks
  let partialTranspiled = partial_transpiler_INS.transpile(
    ast,
    options,
    mainUniFile,
    mainMultiFile,
  );
  partialTranspiled = pluginAPI.run(
    "after",
    "partialTranspile",
    partialTranspiled,
    options,
    buildPluginMeta(options, { stage: "after_partialTranspile" })
  );

  return partialTranspiled;
}

//VFS = virtual file system
function mainMultiFile(
  VFS,
  options = {},
  mainPath = ["index.cdrca", "main.cdrca"],
  uniFN = mainUniFile,
) {
  loadPluginsFromOptions(options);
  let hookedVFS = pluginAPI.run("before", "multiFile", VFS, options);

  // console.log(hookedVFS);
  let mainFile = getVFScontent(hookedVFS, mainPath);
  let transpiled = uniFN(mainFile, {
    VFS: {
      ...hookedVFS,
      ...(options.VFS || {}),
    },
    // this is for system fns idk but users can edit it for super customization since its in options
    sysProcessFNs: {
      tillPartialTranspilationTranspiler_UniFile,
      mainMultiFile,
    },
    ...(options || {}),
  });

  let finalTranspiled = pluginAPI.run(
    "after",
    "multiFile",
    transpiled,
    hookedVFS,
    options,
  );
  // console.log(finalTranspiled);
  return finalTranspiled;
}

function mainUniFile(cdrcaCode, options) {
  loadPluginsFromOptions(options);
  let code = pluginAPI.run(
    "before",
    "parse",
    cdrcaCode,
    options,
    buildPluginMeta(options, { stage: "before_parse" })
  );

  // tokenization to parsing
  let ast = parser_INS.parse(code);
  options.pluginSelection = derivePluginSelectionFromAst(ast);
  options.embeddedPlugins = compileEmbeddedPluginsFromAst(ast, options);
  ast = pluginAPI.run(
    "after",
    "parse",
    ast,
    options,
    buildPluginMeta(options, { stage: "after_parse", astMeta: options.pluginSelection })
  );
  ast = pluginAPI.run(
    "before",
    "partialTranspile",
    ast,
    options,
    buildPluginMeta(options, { stage: "before_partialTranspile" })
  );

  // parses induvidual statments and chunks
  let partialTranspiled = partial_transpiler_INS.transpile(
    ast,
    options,
    mainUniFile,
    mainMultiFile,
  );
  partialTranspiled = pluginAPI.run(
    "after",
    "partialTranspile",
    partialTranspiled,
    options,
    buildPluginMeta(options, { stage: "after_partialTranspile" })
  );
  partialTranspiled = pluginAPI.run(
    "before",
    "semanticAnalyze",
    partialTranspiled,
    ast,
    options,
    buildPluginMeta(options, { stage: "before_semanticAnalyze" })
  );

  // orders those chunks (hoists etc) and adds automatic comments (options)
  let postSemanticAnalyzed = postSemanticAnalyizer_INS.analyze(
    partialTranspiled,
    ast,
    options,
  );
  postSemanticAnalyzed = pluginAPI.run(
    "after",
    "semanticAnalyze",
    postSemanticAnalyzed,
    options,
    buildPluginMeta(options, { stage: "after_semanticAnalyze" })
  );
  postSemanticAnalyzed = pluginAPI.run(
    "before",
    "fullTranspile",
    postSemanticAnalyzed,
    options,
    buildPluginMeta(options, { stage: "before_fullTranspile" })
  );

  // fully combines the code and  template fills the chunks based on Renderer api
  let fullyTranspiled = fullTranspiler_INS.transpile(postSemanticAnalyzed);
  fullyTranspiled = pluginAPI.run(
    "after",
    "fullTranspile",
    fullyTranspiled,
    options,
    buildPluginMeta(options, { stage: "after_fullTranspile" })
  );
  fullyTranspiled = pluginAPI.run(
    "before",
    "postOptionalParse",
    fullyTranspiled,
    options,
    buildPluginMeta(options, { stage: "before_postOptionalParse" })
  );

  // pretifies code and other options (options)
  let postOptionalParsed = postOptionalParser_INS.update(
    fullyTranspiled,
    options,
  );
  let finalResult = postOptionalParsed || fullyTranspiled;
  finalResult = pluginAPI.run(
    "after",
    "postOptionalParse",
    finalResult,
    options,
    buildPluginMeta(options, { stage: "after_postOptionalParse" })
  );

  return (
    finalResult ||
    'console.error("An error occured during backend parsing, contact the devlopers and create a new issue with the error at github if your unsure at https://github.com/Muhammad-Ayyan-no1/CDRCA-animation-dsl/issues" + " error : for some unknown reason final transpiled JAVASCRIPT code was undefined")'
  );
}

// let ast = parser_INS.parse(`
// !--- PROP ABC :: comment ---
// def PROP MyProp { console.log("hello world"); }
// :: SUB HEADER ::
// use MyProp(params) as Alias
// add new action abc STAY_TIME LERP_TIME
// :: END
// !---END---
//     `);

// console.log(JSON.stringify(ast, null, 2));

// let Parttranspiled = partial_transpiler_INS.transpile(ast);
// console.log(JSON.stringify(Parttranspiled, null, 2));

// console.log(
//   "\n\n result \n\n",
//   mainMultiFile(
//     {
//       "index.cdrca": `
//       @IMPORT "./a.cdrca"
// !--- PROP ABC :: comment ---

// use MyProp(params) as Alias
// //add new action abc STAY_TIME LERP_TIME MyActionInstance

// def PROP MyProp {
//  console.log("hello world");
//   }
//  def ACTION ACTION_NAME Alias METHOD_NAME PARAMS
//  //gredientMap = "value"
//  //BGcolor = "color"

// !---END---
// `,
//       "a.cdrca": `
// def PROP MyProp1 {
//  console.log("hello world");
//   }
// `,
//     },
//     {
//       addComments: true,
//     }
//   )
// );

module.exports = {
  transpile: mainMultiFile,
};
