// common systems
const COMMON = require("./commonUtility");

// processes
const tokenizer = require("./Tokenizer");
const parser = require("./Parser");
const Partial_transpiler = require("./Partial_transpiler");
const postSemanticAnalyzier = require("./postSemanticAnalyizer");
const fullTranspiler = require("./FullTranspiler");
const postOptionalParser = require("./PostOptionalParsing");

// system imports
const miniSYS = require("./MINI_SYS/index");

// creations
// common systems
let COMMON_INS = COMMON.create();

// system stuff

const sysPrams = { miniSYS };

// pipeline stuff
let parser_INS = parser.create(tokenizer.defaultTokenizer);
let partial_transpiler_INS = Partial_transpiler.create(parser_INS, sysPrams);
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

function tillPartialTranspilationTranspiler_UniFile(cdrcaCode, options) {
  // tokenization to parsing
  let ast = parser_INS.parse(cdrcaCode);
  // parses induvidual statments and chunks
  let partialTranspiled = partial_transpiler_INS.transpile(
    ast,
    options,
    mainUniFile,
    mainMultiFile
  );
  return partialTranspiled;
}

//VFS = virtual file system
function mainMultiFile(
  VFS,
  options = {},
  mainPath = ["index.cdrca", "main.cdrca"],
  uniFN = mainUniFile
) {
  // console.log(VFS);
  let mainFile = getVFScontent(VFS, mainPath);
  let transpiled = uniFN(mainFile, {
    VFS: {
      ...VFS,
      ...(options.VFS || {}),
    },
    // this is for system fns idk but users can edit it for super customization since its in options
    sysProcessFNs: {
      tillPartialTranspilationTranspiler_UniFile,
      mainMultiFile,
    },
    ...(options || {}),
  });
  // console.log(transpiled);
  return transpiled;
}

function mainUniFile(cdrcaCode, options) {
  // tokenization to parsing
  let ast = parser_INS.parse(cdrcaCode);
  // parses induvidual statments and chunks
  let partialTranspiled = partial_transpiler_INS.transpile(
    ast,
    options,
    mainUniFile,
    mainMultiFile
  );
  // console.log(partialTranspiled.length);
  // orders those chunks (hoists etc) and adds automatic comments (options)
  let postSemanticAnalyzed = postSemanticAnalyizer_INS.analyze(
    partialTranspiled,
    ast,
    options
  );
  // fully combines the code and  template fills the chunks based on Renderer api
  let fullyTranspiled = fullTranspiler_INS.transpile(postSemanticAnalyzed);

  // pretifies code and other options (options)
  let postOptionalParsed = postOptionalParser_INS.update(
    fullyTranspiled,
    options
  );

  return (
    postOptionalParsed ||
    fullyTranspiled ||
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

console.log(
  "\n\n result \n\n",
  mainMultiFile(
    {
      "index.cdrca": `
      @IMPORT "./a.cdrca"
!--- PROP ABC :: comment ---

use MyProp(params) as Alias
//add new action abc STAY_TIME LERP_TIME MyActionInstance

def PROP MyProp {
 console.log("hello world");
  }
 def ACTION ACTION_NAME Alias METHOD_NAME PARAMS
 //gredientMap = "value"  
 //BGcolor = "color"

!---END---
`,
      "a.cdrca": `
def PROP MyProp1 {
 console.log("hello world");
  }
`,
    },
    {
      addComments: true,
    }
  )
);

module.exports = {
  transpile: mainMultiFile,
};
