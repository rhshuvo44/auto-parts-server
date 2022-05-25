const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const { param } = require("express/lib/request");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
    const usersCollection = client.db("auto-parts").collection("users");

    app.get("/parts", async (req, res) => {
      const result = await partsCollection.find().toArray();
      res.send(result)
    });
    app.get("/purchase/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await partsCollection.findOne(query);
      res.send(result);
    });
    app.post("/order", async (req, res) => {
      const order=req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Auto Parts");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
