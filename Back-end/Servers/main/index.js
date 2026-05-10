// excluding handleAPI  everything is by gpt 4.1  git copilot
const { error } = require("console");
const express = require("express");

// custom libs / modules
const transpiler = require("../../Transpiler/index");

const path = require("path");

function handleAPI(request, type) {
  let result = "";
  switch (type) {
    case "transpileCDRCA":
      console.log(request, type);
      result = transpiler.transpile(request.fileSystem);
      // console.log(result);
      break;

    default:
      break;
  }
  return result || {
    request: request,
    type: type,
    success: false,
    errors: ["unknown type"],
  };
}

function init() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.use(express.static(path.join(__dirname, "../../../Front-end")));

  // Serve Monaco editor files from textEditerWindow/monaco
  app.use("/monaco", express.static(path.join(__dirname, "../../../Front-end/textEditerWindow/monaco")));

  // API route: /api/:type
  app.post("/api/:type", (req, res) => {
    // console.log(req.body);
    const type = req.params.type;
    const requestJSON = req.body;
    const result = handleAPI(requestJSON, type);
    res.json(result);
  });

  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../../../Front-end/index.html"));
  });

  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

module.exports = { init };
