// const defaultTokenizer = require("./Tokenizer").defaultTokenizer;

// because I need default tokenizer etc        since index.js is centeral i need a constructor, iife is easiest
const parserConstructor = function (defaultTokenizer, pluginAPI) {
  /*
   * DSL Parser for .cdrca Files (Node.js Only)
   * NOTE: Originally designed by a solo compiler project dev.
   *
   *
   * SYNTAX OVERVIEW:
   * Headers: !--- HEADER_TYPE :: Comment --- ... !---END---
   * Subheaders: :: SUB HEADER :: Comment ... :: END
   *
   * STATEMENTS:
   * - Imports: @IMPORT FilePath  /  @AddImport FilePath
   * - JS Blocks: JS { JavaScript code here }
   * - Prop Definition: def PROP PROP_NAME [abstracts OTHER_PROP] { JS code }
   * - Prop Use: use PROP_NAME(params) as ALIAS
   * - Action Definition: def ACTION ACTION_NAME PROP_NAME METHOD_NAME PARAMS [ PROP_NAME METHOD_NAME PARAMS ... ]    [] part is optional
   * - Action Use: add new action Name STAY_TIME LERP_TIME
   * - Defaults: gredientMap = value  /  BGcolor = color
   * - Comments: // Comment text
   *
   * EXAMPLE:
   * !--- PROP ABC :: Define properties ---
   * def PROP MyProp { console.log("hi"); }
   * :: SUB HEADER :: Usage
   * use MyProp(params) as Alias
   * :: END
   * !---END---
   */

  const OAS_PARSER = function () {
    function normalizePluginName(raw) {
      if (typeof raw !== "string") return null;
      const s = raw.trim();
      if (!s) return null;
      // allow `a,b,c` or `a, b` styles; strip trailing commas
      return s.replace(/,+$/, "");
    }

    function parseInlineList(words, startIndex) {
      // Parses: name1, name2 name3, ... until next keyword or end
      const items = [];
      let i = startIndex;
      for (; i < words.length; i++) {
        const w = String(words[i] ?? "").trim();
        if (!w) continue;
        if (w === "requires" || w === "syntaxPlugin") break;
        // split by commas if provided inline
        const parts = w.split(",").map((p) => normalizePluginName(p));
        for (const p of parts) {
          if (p) items.push(p);
        }
      }
      return { items, nextIndex: i };
    }

    function extractHeaderDirectives(usedTypes) {
      // usedTypes comes from splitting header declaration by whitespace.
      // We support: <headerTypes...> [requires <plugins...>] [syntaxPlugin <syntaxPlugins...>]
      const cleanUsed = [];
      const meta = { requires: [], syntaxPlugins: [] };

      for (let i = 0; i < usedTypes.length; i++) {
        const token = String(usedTypes[i] ?? "").trim();
        if (!token) continue;

        if (token === "requires") {
          const { items, nextIndex } = parseInlineList(usedTypes, i + 1);
          meta.requires.push(...items);
          i = nextIndex - 1;
          continue;
        }
        if (token === "syntaxPlugin") {
          const { items, nextIndex } = parseInlineList(usedTypes, i + 1);
          meta.syntaxPlugins.push(...items);
          i = nextIndex - 1;
          continue;
        }

        cleanUsed.push(token);
      }

      // de-dupe but preserve order
      meta.requires = Array.from(new Set(meta.requires));
      meta.syntaxPlugins = Array.from(new Set(meta.syntaxPlugins));

      return { usedTypes: cleanUsed, meta };
    }

    // --- Header Parsing Functions ---
    function findNextHeaderStart(string, position) {
      while (position < string.length) {
        if (string[position] === "!") {
          let startSeqPos = position + 1;
          while (
            startSeqPos < string.length &&
            /\s/.test(string[startSeqPos])
          ) {
            startSeqPos += 1;
          }
          if (startSeqPos >= string.length) {
            position += 1;
            continue;
          }
          const C = string[startSeqPos];
          let N = 1;
          while (
            startSeqPos + N < string.length &&
            string[startSeqPos + N] === C
          ) {
            N += 1;
          }
          const seq = C.repeat(N);
          const nextSeqPos = string.indexOf(seq, startSeqPos + N);
          if (nextSeqPos !== -1) {
            const headerContent = string.slice(startSeqPos + N, nextSeqPos);
            return [position, N, C, headerContent];
          }
        }
        position += 1;
      }
      return null;
    }

    function parseContent(string) {
      const contentList = [];
      let position = 0;
      while (position < string.length) {
        const nextSubheader = string.indexOf("::", position);
        if (nextSubheader === -1) {
          if (position < string.length) {
            const content = string.slice(position).trim();
            if (content) {
              contentList.push({ STR: content });
            }
          }
          break;
        }
        if (position < nextSubheader) {
          const content = string.slice(position, nextSubheader).trim();
          if (content) {
            contentList.push({ STR: content });
          }
        }
        const [subheaderNode, newPosition] = parseSubheader(
          string,
          nextSubheader
        );
        contentList.push({ "SUB-HEADER": [subheaderNode] });
        position = newPosition;
      }
      return contentList;
    }

    function parseSubheader(string, position) {
      // Find the end of the subheader declaration
      let declarationEnd = position + 2;
      let foundEnd = false;

      // Look for the next :: that ends the declaration
      while (declarationEnd < string.length - 1) {
        if (
          string[declarationEnd] === ":" &&
          string[declarationEnd + 1] === ":"
        ) {
          foundEnd = true;
          break;
        }
        declarationEnd++;
      }

      if (!foundEnd) {
        throw new Error(`Invalid subheader syntax at position ${position}`);
      }

      const subheaderHeader = string.slice(position + 2, declarationEnd).trim();

      // Parse the subheader declaration
      let usedTypes = [];
      let comment = "";

      if (subheaderHeader.includes("::")) {
        // Format: "SUB HEADER :: comment"
        const parts = subheaderHeader.split("::");
        usedTypes = parts[0]
          .trim()
          .split(/\s+/)
          .filter((part) => part.length > 0);
        comment = parts.length > 1 ? parts.slice(1).join("::").trim() : "";
      } else {
        // Format: "SUB HEADER" (no comment)
        usedTypes = subheaderHeader
          .split(/\s+/)
          .filter((part) => part.length > 0);
      }

      const extracted = extractHeaderDirectives(usedTypes);
      usedTypes = extracted.usedTypes;
      const meta = extracted.meta;

      const subContentStart = declarationEnd + 2;
      let nesting = 1;
      let subPosition = subContentStart;

      while (subPosition < string.length - 1) {
        const nextDoubleColon = string.indexOf("::", subPosition);
        if (nextDoubleColon === -1) {
          throw new Error(`Unclosed subheader at position ${position}`);
        }

        // Check what comes after the ::
        let afterColon = "";
        let checkPos = nextDoubleColon + 2;
        while (checkPos < string.length && /\s/.test(string[checkPos])) {
          checkPos++;
        }
        while (checkPos < string.length && /[A-Za-z]/.test(string[checkPos])) {
          afterColon += string[checkPos];
          checkPos++;
        }

        if (afterColon === "END") {
          nesting -= 1;
          if (nesting === 0) {
            const subContentEnd = nextDoubleColon;
            const subContentString = string.slice(
              subContentStart,
              subContentEnd
            );
            const parsedSubContent = parseContent(subContentString);

            // Find the end of "END" keyword
            let endPos = checkPos;
            return [
              {
                USED: usedTypes,
                COMMENT: comment,
                META: meta,
                CODE: parsedSubContent,
              },
              endPos,
            ];
          }
        } else if (usedTypes.length > 0) {
          // This is the start of another nested subheader
          nesting += 1;
        }
        subPosition = nextDoubleColon + 2;
      }
      throw new Error(`Unclosed subheader at position ${position}`);
    }

    function parseTopLevel(string) {
      const items = [];
      let position = 0;
      while (position < string.length) {
        const nextHeader = findNextHeaderStart(string, position);
        if (nextHeader) {
          const [startPos, N, C, headerContent] = nextHeader;
          const codeBefore = string.slice(position, startPos).trim();
          if (codeBefore) {
            items.push({ TYPE: "CODE", VALUE: codeBefore });
          }

          // Parse header content
          let usedTypes = [];
          let comment = "";

          if (headerContent.includes("::")) {
            const parts = headerContent.split("::");
            usedTypes = parts[0]
              .trim()
              .split(/\s+/)
              .filter((part) => part.length > 0);
            comment = parts.length > 1 ? parts.slice(1).join("::").trim() : "";
          } else {
            usedTypes = headerContent
              .trim()
              .split(/\s+/)
              .filter((part) => part.length > 0);
          }

          const extracted = extractHeaderDirectives(usedTypes);
          usedTypes = extracted.usedTypes;
          const meta = extracted.meta;

          const seq = C.repeat(N);
          const endTag = "!" + seq + "END" + seq;
          const headerLineEnd =
            string.indexOf("\n", startPos) === -1
              ? string.length
              : string.indexOf("\n", startPos);
          const contentStart = headerLineEnd + 1;
          const endPos = string.indexOf(endTag, contentStart);
          if (endPos === -1) {
            throw new Error(`Unclosed main header at position ${startPos}`);
          }
          const contentString = string.slice(contentStart, endPos);
          const parsedContent = parseContent(contentString);
          items.push({
            TYPE: "HEADER",
            VALUE: {
              USED: usedTypes,
              COMMENT: comment,
              META: meta,
              CODE: parsedContent,
            },
          });
          position = endPos + endTag.length;
        } else {
          const codeAfter = string.slice(position).trim();
          if (codeAfter) {
            items.push({ TYPE: "CODE", VALUE: codeAfter });
          }
          break;
        }
      }
      return items;
    }

    // --- Statement Parsing Functions ---
    function parseStatements(code, parseMeta = {}) {
      let source = code;
      if (pluginAPI && typeof pluginAPI.run === "function") {
        source = pluginAPI.run(
          "syntax",
          "beforeTokenize",
          source,
          parseMeta,
          { __pluginMeta: true, pluginNames: parseMeta.syntaxPlugins || [] }
        );
      }
      let tokens = defaultTokenizer(source);
      if (pluginAPI && typeof pluginAPI.run === "function") {
        tokens = pluginAPI.run(
          "syntax",
          "afterTokenize",
          tokens,
          parseMeta,
          { __pluginMeta: true, pluginNames: parseMeta.syntaxPlugins || [] }
        );
      }
      const statements = [];
      let pos = 0;
      while (pos < tokens.length) {
        while (pos < tokens.length && tokens[pos].type === "newline") pos++;
        if (pos >= tokens.length) break;
        const statement = parseStatement(tokens, pos, parseMeta);
        if (pluginAPI && typeof pluginAPI.run === "function") {
          const maybe = pluginAPI.run(
            "syntax",
            "afterParseNode",
            statement,
            parseMeta,
            { __pluginMeta: true, pluginNames: parseMeta.syntaxPlugins || [] }
          );
          statements.push(maybe);
        } else {
          statements.push(statement);
        }
        pos = statement.newPosition;
      }
      return statements;
    }

    function parseStatement(tokens, pos, parseMeta = {}) {
      // POS is inclusive like S1k1 S1k2 S2k1 S2k1 etc   here S = statment, k = keyword   the pos will always be at S1k1 or s2k2  inclusive for first token of statment (its helpful when writing parser)
      const token = tokens[pos];
      if (pluginAPI && typeof pluginAPI.run === "function") {
        const custom = pluginAPI.run(
          "syntax",
          "customRule",
          null,
          { tokens, pos, token, parseMeta },
          { __pluginMeta: true, pluginNames: parseMeta.syntaxPlugins || [] }
        );
        if (custom && custom.newPosition !== undefined) {
          return custom;
        }
      }
      switch (token.value) {
        case "@IMPORT":
          return parseImport(tokens, pos, "IMPORT");
        case "@AddImport":
          return parseImport(tokens, pos, "ADD_IMPORT");
        case "@requires":
          return parseDirectiveList(tokens, pos, "REQUIRES_PLUGINS");
        case "@syntaxPlugin":
          return parseDirectiveList(tokens, pos, "SYNTAX_PLUGINS");
        case "plugin":
          return parsePluginDef(tokens, pos);
        case "JS":
          return parseJSBlock(tokens, pos);
        case "def":
          return parseDefStatement(tokens, pos);
        case "use":
          return parsePropUse(tokens, pos);
        case "add":
          return parseActionUse(tokens, pos);
        case "gredientMap":
          return parseDefault(tokens, pos, "GREDIENT_MAP");
        case "BGcolor":
          return parseDefault(tokens, pos, "BGCOLOR");
        case "//":
          return parseComment(tokens, pos);
        default:
          throw new Error(
            `Unexpected token at position ${pos}: ${token.value}`
          );
      }
    }

    function parsePluginDef(tokens, pos) {
      // Syntax:
      // plugin <name> [scope <scopeValue>] [trusted <true|false>] {
      //   <raw hook spec/body as text>
      // }
      pos++;
      if (pos >= tokens.length || tokens[pos].type !== "identifier") {
        throw new Error("Expected plugin name after 'plugin'");
      }
      const name = tokens[pos].value;
      pos++;

      let scope = "file";
      let trusted = true;

      while (pos < tokens.length && tokens[pos].value !== "{") {
        const key = tokens[pos].value;
        pos++;
        if (key === "scope") {
          if (pos >= tokens.length)
            throw new Error("Expected scope value after 'scope'");
          scope = tokens[pos].value;
          pos++;
          continue;
        }
        if (key === "trusted") {
          if (pos >= tokens.length)
            throw new Error("Expected boolean value after 'trusted'");
          trusted = String(tokens[pos].value).toLowerCase() !== "false";
          pos++;
          continue;
        }
        // ignore unknown metadata keys for forward compatibility
        if (pos < tokens.length && tokens[pos].value !== "{") {
          pos++;
        }
      }

      if (pos >= tokens.length || tokens[pos].value !== "{") {
        throw new Error("Expected '{' in plugin definition");
      }
      pos++;

      let depth = 1;
      const bodyTokens = [];
      while (pos < tokens.length && depth > 0) {
        const token = tokens[pos];
        if (token.value === "{") depth++;
        else if (token.value === "}") depth--;
        if (depth > 0) bodyTokens.push(token);
        pos++;
      }

      if (depth !== 0) {
        throw new Error("Unclosed plugin definition block");
      }

      const body = bodyTokens.map((t) => t.value).join("");
      return {
        type: "PLUGIN_DEF",
        prams: {
          name,
          scope,
          trusted,
          body,
        },
        newPosition: pos,
      };
    }

    function parseDirectiveList(tokens, pos, type) {
      // Format: @requires "a" "b" OR @requires a b OR @requires a,b,c
      pos++;
      const values = [];
      while (pos < tokens.length && tokens[pos].type !== "newline") {
        const t = tokens[pos];
        const vRaw =
          t.type === "string" ? t.value.slice(1, -1) : String(t.value);
        const parts = vRaw.split(",").map((p) => normalizePluginName(p));
        for (const p of parts) {
          if (p) values.push(p);
        }
        pos++;
      }
      return { type, prams: { values: Array.from(new Set(values)) }, newPosition: pos };
    }

    function parseImport(tokens, pos, type) {
      // console.log(type);
      pos++;
      if (pos >= tokens.length) throw new Error(`${type} missing file path`);
      const path = tokens[pos].value.slice(1, -1);
      pos++;
      while (pos < tokens.length && tokens[pos].type !== "newline") pos++;
      return { type, prams: { path }, newPosition: pos };
    }

    function parseJSBlock(tokens, pos) {
      pos++;
      if (pos >= tokens.length || tokens[pos].value !== "{")
        throw new Error("Expected '{' after JS");
      pos++;
      let depth = 1;
      const codeTokens = [];
      while (pos < tokens.length && depth > 0) {
        const token = tokens[pos];
        if (token.value === "{") depth++;
        else if (token.value === "}") depth--;
        if (depth > 0) codeTokens.push(token);
        pos++;
      }
      if (depth !== 0) throw new Error("Unclosed JS block");
      const code = codeTokens.map((t) => t.value).join("");
      return { type: "JS_BLOCK", prams: { code }, newPosition: pos };
    }

    function parseDefStatement(tokens, pos) {
      pos++;
      if (pos >= tokens.length)
        throw new Error("Expected PROP or ACTION after 'def'");
      const type = tokens[pos].value;
      if (type === "PROP") return parsePropDef(tokens, pos);
      if (type === "ACTION") return parseActionDef(tokens, pos);
      throw new Error(`Unexpected definition type: ${type}`);
    }

    function parsePropDef(tokens, pos) {
      pos++; // Skip "PROP"
      if (pos >= tokens.length || tokens[pos].type !== "identifier")
        throw new Error("Expected prop name after 'PROP'");
      const name = tokens[pos].value;
      pos++;
      let abstracts = false;
      let optionOtherPROP = null;
      if (pos < tokens.length && tokens[pos].value === "abstracts") {
        abstracts = true;
        pos++;
        if (pos >= tokens.length || tokens[pos].type !== "identifier")
          throw new Error("Expected other PROP name after 'abstracts'");
        // Handle dotted namespaced prop names like A.B.C
        optionOtherPROP = tokens[pos].value;
        pos++;
        while (pos < tokens.length && tokens[pos].value === ".") {
          pos++;
          if (pos >= tokens.length || tokens[pos].type !== "identifier")
            throw new Error("Expected identifier after '.' in abstracts clause");
          optionOtherPROP += "." + tokens[pos].value;
          pos++;
        }
      }
      if (pos >= tokens.length || tokens[pos].value !== "{")
        throw new Error("Expected '{' in prop definition");
      pos++;
      let depth = 1;
      const codeTokens = [];
      while (pos < tokens.length && depth > 0) {
        const token = tokens[pos];
        if (token.value === "{") depth++;
        else if (token.value === "}") depth--;
        if (depth > 0) codeTokens.push(token);
        pos++;
      }
      if (depth !== 0) throw new Error("Unclosed prop definition");
      const code = codeTokens.map((t) => t.value).join("");
      return {
        type: "PROP_DEF",
        prams: { name, abstracts, optionOtherPROP, code },
        newPosition: pos,
      };
    }

    function parseActionDef(tokens, pos) {
      pos++; // Skip "ACTION"
      if (pos >= tokens.length || tokens[pos].type !== "identifier")
        throw new Error("Expected action name after 'ACTION'");
      const name = tokens[pos].value;
      pos++;
      const parts = [];
      while (pos < tokens.length && tokens[pos].type !== "newline") {
        if (tokens[pos].type !== "identifier")
          throw new Error("Expected prop name in action definition");
        // Handle dotted namespaced prop names like A.B.C
        let propName = tokens[pos].value;
        pos++;
        while (pos < tokens.length && tokens[pos].value === ".") {
          pos++;
          if (pos >= tokens.length || tokens[pos].type !== "identifier")
            throw new Error("Expected identifier after '.' in action definition");
          propName += "." + tokens[pos].value;
          pos++;
        }
        if (pos >= tokens.length || tokens[pos].type !== "identifier")
          throw new Error("Expected method name in action definition");
        const methodName = tokens[pos].value;
        pos++;
        if (pos >= tokens.length)
          throw new Error("Expected parameters in action definition");
        const prams = tokens[pos].value; // Parameters can be any token
        pos++;
        // if (pos >= tokens.length || tokens[pos].type !== "identifier")
        //   throw new Error("Expected stay time in action definition");
        // const stayTime = tokens[pos].value;
        // pos++;
        // if (pos >= tokens.length || tokens[pos].type !== "identifier")
        //   throw new Error("Expected lerp time in action definition");
        // const lerpTime = tokens[pos].value;
        // pos++;
        parts.push({ propName, methodName, prams /*stayTime, lerpTime */ });
      }
      return { type: "ACTION_DEF", prams: { name, parts }, newPosition: pos };
    }

    function parsePropUse(tokens, pos) {
      pos++;
      if (pos >= tokens.length || tokens[pos].type !== "identifier")
        throw new Error("Expected prop name after 'use'");
      // Handle dotted namespaced identifiers like A.B.C
      let name = tokens[pos].value;
      pos++;
      while (pos < tokens.length && tokens[pos].value === ".") {
        pos++;
        if (pos >= tokens.length || tokens[pos].type !== "identifier")
          throw new Error("Expected identifier after '.' in prop use");
        name += "." + tokens[pos].value;
        pos++;
      }
      if (pos >= tokens.length || tokens[pos].value !== "(")
        throw new Error("Expected '(' in prop use");
      pos++;
      let depth = 1;
      const pramsTokens = [];
      while (pos < tokens.length && depth > 0) {
        const token = tokens[pos];
        if (token.value === "(") depth++;
        else if (token.value === ")") depth--;
        if (depth > 0) pramsTokens.push(token);
        pos++;
      }
      if (depth !== 0) throw new Error("Unclosed parameters in prop use");
      const prams = pramsTokens.map((t) => t.value).join("");

      // Handle optional "as" clause
      let alias = null;
      if (pos < tokens.length && tokens[pos].value === "as") {
        pos++;
        if (pos >= tokens.length || tokens[pos].type !== "identifier")
          throw new Error("Expected alias name after 'as'");
        alias = tokens[pos].value;
        pos++;
      }

      return {
        type: "PROP_USE",
        prams: { name, prams, as: alias },
        newPosition: pos,
      };
    }

    function parseActionUse(tokens, pos) {
      pos++;
      if (pos >= tokens.length || tokens[pos].value !== "new")
        throw new Error("Expected 'new' in action use");
      pos++;
      if (pos >= tokens.length || tokens[pos].value !== "action")
        throw new Error("Expected 'action' in action use");
      pos++;
      if (pos >= tokens.length)
        throw new Error("Expected stay time in action use");
      const actionName = tokens[pos].value;
      pos++;
      if (pos >= tokens.length)
        throw new Error("Expected stay time in action use");
      const stayTime = tokens[pos].value;
      pos++;
      if (pos >= tokens.length)
        throw new Error("Expected lerp time in action use");
      const lerpTime = tokens[pos].value;
      pos++;
      let actionUseName;
      if (pos >= tokens.length || tokens[pos].type === "newline" || tokens[pos].value === "\n") {
        // actionUseName is optional per the DSL syntax: add new action Name STAY_TIME LERP_TIME
        // Auto-generate a unique name when not provided
        actionUseName =
          actionName + "_Use" + String(Math.random()).replace("0.", "");
      } else {
        actionUseName = tokens[pos].value;
      }

      pos++;
      return {
        type: "ACTION_USE",
        prams: { actionUseName, actionName, stayTime, lerpTime },
        newPosition: pos,
      };
    }

    function parseDefault(tokens, pos, type) {
      const keyword = tokens[pos].value;
      pos++;
      if (pos >= tokens.length || tokens[pos].value !== "=")
        throw new Error(`Expected '=' after ${keyword}`);
      pos++;
      const valueTokens = [];
      while (pos < tokens.length && tokens[pos].type !== "newline") {
        valueTokens.push(tokens[pos]);
        pos++;
      }
      const value = valueTokens.map((t) => t.value).join("");
      return { type, prams: { value }, newPosition: pos };
    }

    function parseComment(tokens, pos) {
      pos++;
      const commentTokens = [];
      while (pos < tokens.length && tokens[pos].type !== "newline") {
        commentTokens.push(tokens[pos]);
        pos++;
      }
      const value = commentTokens.map((t) => t.value).join("");
      return { type: "COMMENT", value, newPosition: pos };
    }

    // --- AST Processing ---
    function processCodeList(codeList, inheritedMeta = {}) {
      const result = [];
      let currentCode = "";
      for (const item of codeList) {
        if (item.STR) {
          currentCode += item.STR + "\n";
        } else if (item["SUB-HEADER"]) {
          if (currentCode.trim()) {
            result.push({
              TYPE: "STATEMENTS",
              META: inheritedMeta,
              VALUE: parseStatements(currentCode, {
                syntaxPlugins: inheritedMeta.activeSyntaxPlugins || [],
              }),
            });
            currentCode = "";
          }
          const subheader = item["SUB-HEADER"][0];
          const activeSyntaxPlugins = Array.from(
            new Set([
              ...((inheritedMeta && inheritedMeta.activeSyntaxPlugins) || []),
              ...(((subheader.META || {}).syntaxPlugins) || []),
            ])
          );
          subheader.ACTIVE_SYNTAX_PLUGINS = activeSyntaxPlugins;
          subheader.CODE = processCodeList(subheader.CODE, {
            activeSyntaxPlugins,
          });
          result.push({ "SUB-HEADER": [subheader] });
        }
      }
      if (currentCode.trim()) {
        result.push({
          TYPE: "STATEMENTS",
          META: inheritedMeta,
          VALUE: parseStatements(currentCode, {
            syntaxPlugins: inheritedMeta.activeSyntaxPlugins || [],
          }),
        });
      }
      return result;
    }

    function parse(code) {
      const topLevelItems = parseTopLevel(code);
      return topLevelItems
        .map((item) => {
          if (item.TYPE === "CODE") {
            return {
              TYPE: "STATEMENTS",
              META: { activeSyntaxPlugins: [] },
              VALUE: parseStatements(item.VALUE, { syntaxPlugins: [] }),
            };
          } else if (item.TYPE === "HEADER") {
            const activeSyntaxPlugins = Array.from(
              new Set([...(item.VALUE.META.syntaxPlugins || [])])
            );
            item.VALUE.ACTIVE_SYNTAX_PLUGINS = activeSyntaxPlugins;
            item.VALUE.CODE = processCodeList(item.VALUE.CODE, {
              activeSyntaxPlugins,
            });
            return item;
          }
          return item;
        })
        .filter((item) => item !== undefined);
    }

    // --- Traversal Functions ---
    function traverseIn(ast, callback) {
      function traverse(node, depth = 0) {
        if (Array.isArray(node)) {
          node.forEach((item) => traverse(item, depth));
        } else if (node.TYPE === "HEADER") {
          callback(node.VALUE, true, depth);
          node.VALUE.CODE.forEach((child) => {
            if (child["SUB-HEADER"]) {
              traverse(child["SUB-HEADER"], depth + 1);
            }
          });
        }
      }
      traverse(ast);
    }

    function traverseOut(ast, callback) {
      function traverse(node, depth = 0) {
        if (Array.isArray(node)) {
          node.forEach((item) => traverse(item, depth));
        } else if (node.TYPE === "HEADER") {
          node.VALUE.CODE.forEach((child) => {
            if (child["SUB-HEADER"]) {
              traverse(child["SUB-HEADER"], depth + 1);
            }
          });
          callback(node.VALUE, false, depth);
        }
      }
      traverse(ast);
    }

    return {
      parse,
      traverseIn,
      traverseOut,
    };
  };

  // Initialize parser instance
  let OAS_PARSER_INS = OAS_PARSER();

  // // Test cases
  // console.log("=== Test 1: Simple Import ===");
  // console.log(JSON.stringify(OAS_PARSER_INS.parse(`@IMPORT abc`), null, 2));

  // console.log("\n=== Test 2: Header with Sub-header ===");
  // console.log(
  //   JSON.stringify(
  //     OAS_PARSER_INS.parse(`
  // !--- PROP ABC :: comment ---
  // def PROP MyProp { console.log("hi"); }
  // :: SUB HEADER ::
  // use MyProp(params) as Alias
  // add new action STAY_TIME LERP_TIME
  // :: END
  // !---END---
  // `),
  //     null,
  //     2
  //   )
  // );

  // console.log("\n=== Test 3: Prop Use without 'as' ===");
  // console.log(
  //   JSON.stringify(OAS_PARSER_INS.parse(`use MyProp(params)`), null, 2)
  // );
  return OAS_PARSER_INS;
};

module.exports = { create: parserConstructor };
