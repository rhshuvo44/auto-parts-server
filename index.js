const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_KEY);

const app = express();
const port = process.env.PORT || 5000;
const corsConfig = {
  origin: "*",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,HEADER",
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsConfig));
app.use(express.json());
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbideen access" });
    }
    req.decoded = decoded;
  });
  next();
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.u07m6.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const partsCollection = client.db("auto-parts").collection("parts");
    const ordersCollection = client.db("auto-parts").collection("orders");
    const reviewsCollection = client.db("auto-parts").collection("reviews");
    const userCollection = client.db("auto-parts").collection("users");
    const paymentCollection = client.db("auto-parts").collection("payment");
    const userProfileCollection = client
      .db("auto-parts")
      .collection("updateUser");

    app.get("/parts", async (req, res) => {
      const result = await partsCollection.find().toArray();
      res.send(result);
    });
    app.post("/parts", async (req, res) => {
      const part = req.body;
      const result = await partsCollection.insertOne(part);
      res.send(result);
    });
    //user update
    app.post("/updateUser", async (req, res) => {
      const userInfo = req.body;
      const result = await userProfileCollection.insertOne(userInfo);
      res.send(result);
    });
    app.get("/updateUser/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userProfileCollection.findOne({ email: email });
      res.send(result);
    });
    // parts delete
    app.delete("/parts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const deleted = await partsCollection.deleteOne(query);
      res.send(deleted);
    });

    app.get("/purchase/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await partsCollection.findOne(query);
      res.send(result);
      // review
    });
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    //order
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });
    app.get("/allOrders", async (req, res) => {
      const result = await ordersCollection.find().toArray();
      res.send(result);
    });
    app.get("/orders", verifyToken, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email === decodedEmail) {
        const query = { email: email };
        const result = await ordersCollection.find(query).toArray();
        return res.send(result);
      } else {
        return res.status(403).send({ message: "Forbidden access" });
      }
    });
    //payment product api
    app.get("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await ordersCollection.findOne(query);
      res.send(result);
    });
    app.patch("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const query = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          paid: true,
          transctionId: payment.transctionId,
        },
      };
      const result = await paymentCollection.insertOne(payment);
      const orderUpdate = await ordersCollection.updateOne(query, updateDoc);
      res.send(orderUpdate);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.delete("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const deleted = await ordersCollection.deleteOne(query);
      res.send(deleted);
    });
    //user
    app.get("/user", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });
    app.put("/user/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requestAccount = await userCollection.findOne({ email: requester });
      if (requestAccount.role === "admin") {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        res.status(403).send({ message: "Forbidden" });
      }
    });
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });
    app.delete("/user/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Auto Parts server");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
