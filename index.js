const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

//MiddleWare
app.use(cors());

//MiddleWare
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.USER_SECRET}:${process.env.PASSWORD_SECRET}@cluster0.luy9u.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server
    await client.connect();

    //Database and Collection
    const menuCollection = client.db("hungryDb").collection("menu");
    const reviewsCollection = client.db("hungryDb").collection("reviews");

    //!Get all Menu--> Read : (CRUD) (Default all get)
    app.get("/menu", async (req, res) => {
      const cursor = menuCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    //!Get all Reviews--> Read : (CRUD) (Default all get)
    app.get("/reviews", async (req, res) => {
      const cursor = reviewsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment successfully ");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hungry Place Server Runing !");
});

app.listen(port, () => {
  console.log(`Hungry Server listening on port ${port}`);
});
