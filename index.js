const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_PAYMENT_SECRET);
const app = express();
const port = process.env.PORT || 5000;

//MiddleWare
app.use(cors());
app.use(express.json());

// const uri = `mongodb+srv://${process.env.USER_SECRET}:${process.env.PASSWORD_SECRET}@cluster0.luy9u.mongodb.net/?retryWrites=true&w=majority`;

const uri = `mongodb://${process.env.USER_SECRET}:${process.env.PASSWORD_SECRET}@cluster0-shard-00-00.luy9u.mongodb.net:27017,cluster0-shard-00-01.luy9u.mongodb.net:27017,cluster0-shard-00-02.luy9u.mongodb.net:27017/?ssl=true&replicaSet=atlas-9im02q-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;

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
    const cartCollection = client.db("hungryDb").collection("carts");
    const userCollection = client.db("hungryDb").collection("users");
    const paymentCollection = client.db("hungryDb").collection("payments");

    //*JWT Token generate function
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });
    //!JWT verify Middleware
    const verifyJWT = (req, res, next) => {
      const authorization = req.headers.authorization;
      console.log(authorization);
      if (!authorization) {
        return res
          .status(401)
          .send({ error: true, message: "unauthorized access" });
      }

      //bearer token
      const token = authorization.split(" ")[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res
            .status(401)
            .send({ error: true, message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    //* Menu related APIs
    //!Get all Menu--> Read : (CRUD) (Default all get)
    app.get("/menu", async (req, res) => {
      const cursor = menuCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    //! Get Menu data by specific ID
    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });

    //!Update with Patch
    app.patch("/menu/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image,
        },
      };
      const result = await menuCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //! Post Data in Menu Collection
    app.post("/menu", async (req, res) => {
      const menuItem = req.body;
      const result = await menuCollection.insertOne(menuItem);
      res.send(result);
    });

    //! Delete data from Menu Collection
    app.delete("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    //!Get all Reviews--> Read : (CRUD) (Default all get)
    app.get("/reviews", async (req, res) => {
      const cursor = reviewsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    //* Order Cart  related APIs
    //! Cart Collection where stored all users order
    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    //! CART: use put method for single update
    app.put("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const { quantity, price } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          quantity: quantity,
          price: price,
        },
      };
      const result = await cartCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //! Get cart order data for specific user via email
    app.get("/carts", async (req, res) => {
      const email = req.query.email;

      if (!email) {
        res.send([]);
      }

      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    //! Delete order from Cart by specific ID
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    //*-------PAYMENT RELATED ROUTE START-------*//

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, "From Payment Intent");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      // carefully delete each item from cart
      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };

      const deleteResult = await cartCollection.deleteMany(query);

      res.send({ paymentResult, deleteResult });
    });

    //get payment based on email
    app.get("/payments/:email", async (req, res) => {
      const query = { email: req.params.email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    //State or Analytics
    app.get("/admin-stats", async (req, res) => {
      try {
        const users = await userCollection.estimatedDocumentCount();
        const menuItems = await menuCollection.estimatedDocumentCount();
        const orders = await paymentCollection.estimatedDocumentCount();

        const result = await paymentCollection
          .aggregate([
            {
              $group: {
                _id: null,
                totalRevenue: {
                  $sum: {
                    $toDouble: "$price", // Convert price from string to double
                  },
                },
              },
            },
          ])
          .toArray();

        const revenue = result.length > 0 ? result[0].totalRevenue : 0;

        res.send({
          users,
          menuItems,
          orders,
          revenue,
        });
      } catch (error) {
        console.error("Error calculating admin stats:", error);
        res.status(500).send({
          error: "An error occurred while calculating admin stats.",
        });
      }
    });

    // using aggregate pipeline
    app.get("/order-stats", async (req, res) => {
      const result = await paymentCollection
        .aggregate([
          {
            $unwind: "$foodItemIds",
          },
          {
            $lookup: {
              from: "menu",
              localField: "foodItemIds",
              foreignField: "_id",
              as: "menuItems",
            },
          },
          {
            $unwind: "$menuItems",
          },
          {
            $group: {
              _id: "$menuItems.category",
              quantity: { $sum: 1 },
              revenue: { $sum: "$menuItems.price" },
            },
          },
          {
            $project: {
              _id: 0,
              category: "$_id",
              quantity: "$quantity",
              revenue: "$revenue",
            },
          },
        ])
        .toArray();

      res.send(result);
    });

    //*-------PAYMENT RELATED ROUTE END-------*//

    //* User Related APIs
    //! Save user information in userCollection after login
    app.post("/users", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const query = { email: user.email };
      const isUserExist = await userCollection.findOne(query);

      if (isUserExist) {
        return res.send({ message: "user already exist in database" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //! Get all Users
    app.get("/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    //! Make Admin Role : use patch method for single update
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //* Get Admin
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.send({ admin: isAdmin });
    });

    //! Delete User from DB
    app.delete("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
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
