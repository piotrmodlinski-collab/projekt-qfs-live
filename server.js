const express = require("express");
const path = require("path");

const app = express();
const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);

app.use(express.static(rootDir));

app.get("*", (req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

app.listen(port, () => {
  console.log(`QFS server listening on port ${port}`);
});
