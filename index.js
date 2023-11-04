const express = require("express");
require("dotenv").config();
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

//MiddleWare
app.use(cors());

//MiddleWare
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hungry Place Server Runing !");
});

app.listen(port, () => {
  console.log(`Hungry Server listening on port ${port}`);
});
