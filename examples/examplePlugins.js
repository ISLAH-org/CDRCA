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

module.exports = {
  examplePlugin
};
