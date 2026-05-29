/**
 * examplePlugins.js
 * 
 * Demonstrates how to write custom plugins using priority-based hooks for CDRCA transpilation processes.
 */

// A simple plugin defined as a function
function examplePlugin(plugin) {
  // Registers a callback for "before" "parse" hook with priority 10
  plugin.register(10, "before", "parse", (code, options) => {
    console.log("[Plugin] Intercepted raw code for parsing");
    return code;
  });

  // Registers a callback for "after" "fullTranspile" hook with priority 5
  plugin.register(5, "after", "fullTranspile", (fullyTranspiledCode, options) => {
    console.log("[Plugin] Injecting licensing info into transpiled code");
    return `/* Compiled with CDRCA Plugin Engine */\n${fullyTranspiledCode}`;
  });
}

// Syntax plugin example: parse-level token interception
function syntaxPluginExample(plugin) {
  plugin.register(50, "syntax", "beforeTokenize", (source, parseMeta) => {
    // Basic sugar rewrite example. Real syntax plugins can do more advanced edits.
    return String(source).replaceAll("@useFastImport", "@AddImport");
  });

  plugin.register(40, "syntax", "afterParseNode", (node, parseMeta) => {
    return node;
  });
}

/*
Embedded plugin block example (inside .cdrca):

plugin myInlinePlugin scope file trusted true {
  on 20 before parse => ctx.value;
  on 10 after fullTranspile => "/* from embedded plugin */\n" + ctx.value;
  on 15 syntax customRule => null;
}

File-level declaration examples:
@requires myInlinePlugin anotherPlugin
@syntaxPlugin syntaxPluginExample

Header-level declaration examples:
!--- SCENE Main requires myInlinePlugin syntaxPlugin syntaxPluginExample :: demo ---
...
!---END---
*/

module.exports = {
  examplePlugin,
  syntaxPluginExample,
};
