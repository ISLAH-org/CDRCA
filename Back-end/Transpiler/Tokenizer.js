// Define the Utilities module
function createUtilities(logs) {
  return {
    log: function (data, type) {
      if (type == "all") {
        if (!Array.isArray(logs.all)) {
          logs.all = [];
        }
        logs.all.push(data);
        return data;
      }
      if (!Array.isArray(logs[type])) {
        logs[type] = [];
      }
      logs[type].push(data);
      if (!Array.isArray(logs.all)) {
        logs.all = [];
      }
      logs.all.push(data);
      return data;
    },
    buildTrie: function (hardcodedList) {
      const root = {};
      for (const item of hardcodedList) {
        const val = typeof item === "string" ? item : item.value;
        const type = typeof item === "string" ? "token" : item.type || "token";
        let node = root;
        for (let char of val) {
          if (!node[char]) node[char] = {};
          node = node[char];
        }
        node._end = { value: val, type: type };
      }
      return root;
    },
    matchFromTrie: function (trie, str, index) {
      let node = trie;
      let lastMatch = null;
      for (let i = index; i < str.length; i++) {
        const char = str[i];
        if (!node[char]) break;
        node = node[char];
        if (node._end) {
          lastMatch = node._end;
        }
      }
      return lastMatch;
    },
  };
}

let Logs = {};
let Utilities = createUtilities(Logs);

const GlobalCache = (function () {
  let cache = new Map();
  Utilities.log("GlobalCache initialized", "info");

  return {
    get: (key) => {
      const result = cache.get(key);
      Utilities.log(
        `Cache GET: ${key} -> ${result ? "HIT" : "MISS"}`,
        "verbose"
      );
      return result;
    },
    set: (key, value) => {
      Utilities.log(`Cache SET: ${key}`, "verbose");
      return cache.set(key, value);
    },
    has: (key) => {
      const result = cache.has(key);
      Utilities.log(`Cache HAS: ${key} -> ${result}`, "verbose");
      return result;
    },
    clear: () => {
      Utilities.log("Cache cleared", "info");
      return cache.clear();
    },
  };
})();

// Rule functions for dynamic token matching
function whitespaceRule(str, index) {
  const char = str[index];
  if (char !== " " && char !== "\t" && char !== "\r") return null;
  let len = 0;
  while (
    index + len < str.length &&
    (str[index + len] === " " ||
      str[index + len] === "\t" ||
      str[index + len] === "\r")
  ) {
    len++;
  }
  return { skip: true, length: len };
}

function commentRule(str, index) {
  if (str.substr(index, 2) !== "//") return null;
  let len = 2;
  while (index + len < str.length && str[index + len] !== "\n") {
    len++;
  }
  return { skip: true, length: len };
}

function stringRule(str, index) {
  const quote = str[index];
  if (quote !== '"' && quote !== "'") return null;
  let len = 1;
  let value = quote;
  while (index + len < str.length) {
    const char = str[index + len];
    if (char === quote) {
      value += char;
      len++;
      break;
    }
    if (char === "\\" && index + len + 1 < str.length) {
      value += char + str[index + len + 1];
      len += 2;
    } else {
      value += char;
      len++;
    }
  }
  if (len > 1 && str[index + len - 1] === quote) {
    return { type: "string", value, length: len };
  }
  return null; // Unclosed string
}

function identifierRule(str, index) {
  const char = str[index];
  if (
    !(
      (char >= "A" && char <= "Z") ||
      (char >= "a" && char <= "z") ||
      char === "_"
    )
  )
    return null;
  let len = 1;
  while (
    index + len < str.length &&
    ((str[index + len] >= "A" && str[index + len] <= "Z") ||
      (str[index + len] >= "a" && str[index + len] <= "z") ||
      (str[index + len] >= "0" && str[index + len] <= "9") ||
      str[index + len] === "_")
  ) {
    len++;
  }
  const value = str.substr(index, len);
  return { type: "identifier", value, length: len };
}

function numberRule(str, index) {
  const char = str[index];
  if (!(char >= "0" && char <= "9")) return null;
  let len = 0;
  let hasDot = false;
  while (
    index + len < str.length &&
    ((str[index + len] >= "0" && str[index + len] <= "9") ||
      str[index + len] === ".")
  ) {
    if (str[index + len] === ".") {
      if (hasDot) return null; // More than one dot is invalid
      hasDot = true;
    }
    len++;
  }
  const value = str.substr(index, len);
  return { type: "number", value, length: len };
}

var create_Tokenizer = function () {
  Utilities.log("Creating tokenizer", "info");

  function CacheTokenOBJ(tokenOBJ) {
    Utilities.log("Caching token object", "info");
    const cacheKey = JSON.stringify(tokenOBJ);

    if (GlobalCache.has(cacheKey)) {
      Utilities.log("Using cached token object", "info");
      return GlobalCache.get(cacheKey);
    }

    Utilities.log("Building new cached token object", "info");
    let Cached = {
      rules: [],
      trie: Utilities.buildTrie(tokenOBJ.hardcoded || []),
      hardcoded: {},
    };

    for (const item of tokenOBJ.hardcoded || []) {
      const val = typeof item === "string" ? item : item.value;
      const type = typeof item === "string" ? "token" : item.type || "token";
      Cached.hardcoded[val] = type;
    }

    for (const rule of tokenOBJ.rules || []) {
      if (typeof rule === "function") {
        Cached.rules.push({ fn: rule, priority: 0 });
        Utilities.log(`Added rule function with priority 0`, "verbose");
      } else if (rule && typeof rule.fn === "function") {
        Cached.rules.push(rule);
        Utilities.log(
          `Added rule function with priority ${rule.priority || 0}`,
          "verbose"
        );
      }
    }

    Cached.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    Utilities.log(`Sorted ${Cached.rules.length} rules by priority`, "info");

    GlobalCache.set(cacheKey, Cached);
    return Cached;
  }

  const HARDCODED_PRIORITY = 1000;

  function tokenize(str, tokensOBJ) {
    Utilities.log(`Starting tokenization of string: "${str}"`, "info");
    let Cache = CacheTokenOBJ(tokensOBJ);
    let tokens = [];
    let STRindex = 0;
    let LOGs = [];

    while (STRindex < str.length) {
      Utilities.log(
        `Tokenizing at index ${STRindex}: "${str[STRindex]}"`,
        "verbose"
      );

      let bestMatch = null;
      let bestPri = -Infinity;

      // Check trie match
      const trieMatch = Utilities.matchFromTrie(Cache.trie, str, STRindex);
      if (trieMatch) {
        const match = {
          type: trieMatch.type,
          value: trieMatch.value,
          length: trieMatch.value.length,
          priority: HARDCODED_PRIORITY,
        };
        if (match.priority > bestPri) {
          bestMatch = match;
          bestPri = match.priority;
        }
      }

      // Check rules
      for (let rule of Cache.rules) {
        const result = rule.fn(str, STRindex);
        if (result) {
          let pri = rule.priority || 0;
          if (tokensOBJ.easeFN) {
            pri = tokensOBJ.easeFN(
              str,
              STRindex,
              STRindex + result.length,
              result.length,
              pri
            );
          }
          if (pri > bestPri) {
            bestMatch = { ...result, priority: pri };
            bestPri = pri;
          }
        }
      }

      if (bestMatch) {
        if (bestMatch.skip) {
          STRindex += bestMatch.length;
          continue;
        } else {
          const token = { type: bestMatch.type, value: bestMatch.value };
          tokens.push(token);
          Utilities.log(`Token created: ${JSON.stringify(token)}`, "info");
          STRindex += bestMatch.length;
          continue;
        }
      }

      // If no match, treat as unknown
      let chunk = str[STRindex];
      const unknownToken = { type: "unknown", value: chunk };
      tokens.push(unknownToken);
      const warning = "Unrecognized character: " + chunk;
      LOGs.push({ warn: warning });
      Utilities.log(warning, "warn");
      Utilities.log(
        `Unknown token created: ${JSON.stringify(unknownToken)}`,
        "warn"
      );
      STRindex++;
    }

    LOGs.push({ info: "tokenization completed" });
    Utilities.log(
      `Tokenization completed. Generated ${tokens.length} tokens`,
      "info"
    );
    return { tokens, logs: LOGs };
  }

  return { tokenize };
};

let tokenizer = create_Tokenizer();

let OAS_TOKobj = {
  hardcoded: [
    { value: "\n", type: "newline" },
    "!",
    "@",
    "#",
    "$",
    "%",
    "^",
    "&",
    "*",
    "(",
    ")",
    "-",
    "_",
    "=",
    "+",
    "{",
    "}",
    "[",
    "]",
    "|",
    "\\",
    ";",
    "'",
    '"',
    "<",
    ">",
    ",",
    ".",
    "/",
    "?",
    "`",
    "~",
    ":",
    "::",
    "def",
    "use",
    "as",
    "plugin",
    "abstracts",
    "PROP",
    "ACTION",
    "JS",
    "END",
    "IMPORT",
    "AddImport",
    "@IMPORT",
    "@AddImport",
    "@requires",
    "@syntaxPlugin",
    "STAY_TIME",
    "LERP_TIME",
    "BGcolor",
    "gredientMap",
    "SCENE",
    "SUB",
    "HEADER",
    "CODE",
    "PRAMS",
  ],
  rules: [
    { fn: whitespaceRule, priority: 1100 },
    { fn: commentRule, priority: 1100 },
    { fn: stringRule, priority: 1100 },
    { fn: identifierRule, priority: 1100 },
    { fn: numberRule, priority: 1100 },
  ],
};

function cleanTheTokens(tokens) {
  let cleanedTokens = [];
  let currentValue = "";

  function determineType(token) {
    return token.type;
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.value === " ") {
      if (currentValue !== "") {
        cleanedTokens.push({
          type: determineType(token),
          value: currentValue,
        });
        currentValue = "";
      }
      continue;
    } else if (token.value.length > 1) {
      if (currentValue !== "") {
        cleanedTokens.push({
          type: determineType(token),
          value: currentValue,
        });
        currentValue = "";
      }
      cleanedTokens.push(token);
    } else if (
      token.value.length === 1 &&
      /[a-zA-Z0-9_"'`]/.test(token.value)
    ) {
      currentValue += token.value;
    } else {
      if (currentValue !== "") {
        cleanedTokens.push({
          type: determineType(token),
          value: currentValue,
        });
        currentValue = "";
      }
      cleanedTokens.push(token);
    }
  }

  if (currentValue !== "") {
    cleanedTokens.push({
      type: determineType(tokens[tokens.length - 1]),
      value: currentValue,
    });
  }

  return cleanedTokens;
}

function defaultTokenizer(code) {
  let tokens = cleanTheTokens(tokenizer.tokenize(code, OAS_TOKobj).tokens);
  // console.log("TOKENS", JSON.stringify(tokens, null, 2));
  return tokens;
}

module.exports = { defaultTokenizer };
