const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

const app = express();

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hs9qs.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const courseCollection = client.db("onlineEdulogy").collection("courses");
    const bookingsCollection = client.db("onlineEdulogy").collection("bookings");
    const usersCollection = client.db("onlineEdulogy").collection("users");
    const teachersCollection = client.db("onlineEdulogy").collection("teachers");
    const paymentsCollection = client.db("onlineEdulogy").collection("payments");

    // Note: verifyAdmin  After verifyJWT
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    //==========================================================Courses API Convention===================================================================
    //
    // Get all course
    app.get("/courses", async (req, res) => {
      const query = {};
      const course = await courseCollection.find(query).toArray();
      res.send(course);
    });

    // Get a single Course
    app.get("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await courseCollection.findOne(query);
      res.send(result);
    });

    //Add a Course
    app.post("/courses", verifyJWT, verifyAdmin, async (req, res) => {
      const newCourse = req.body;
      const result = await courseCollection.insertOne(newCourse);
      res.send(result);
    });

    //update Course
    app.put("/courses/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const updatedCourse = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          heading: updatedCourse.heading,
          price: updatedCourse.price,
          weeks: updatedCourse.weeks,
          level: updatedCourse.level,
          lesson: updatedCourse.lesson,
          quiz: updatedCourse.quiz,
          student: updatedCourse.student,
        },
      };
      const result = await courseCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    //Delete a course
    app.delete("/courses/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await courseCollection.deleteOne(query);
      res.send(result);
    });

    // ------------------------------------------------Teachers API Convention----------------------------------------------------------
    //Get all Teachers
    app.get("/teachers", async (req, res) => {
      const query = {};
      const teachers = await teachersCollection.find(query).toArray();
      res.send(teachers);
    });

    // Get a single Course
    app.get("/teachers/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await teachersCollection.findOne(query);
      res.send(result);
    });

    //Insert a teacher
    app.post("/teachers", verifyJWT, verifyAdmin, async (req, res) => {
      const teacher = req.body;
      const result = await teachersCollection.insertOne(teacher);
      res.send(result);
    });

    //Delete a teacher
    app.delete("/teachers/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await teachersCollection.deleteOne(query);
      res.send(result);
    });

    //===============================================================Bookings API Convention==================================================
    /*
      API naming Convention
      app.get('bookings')
      app.get('/bookings/id')
      app.post('bookings')
      app.patch('/bookings/id')
      app.delete('/bookings/id')
    */

    app.get("/bookings", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    });

    // Get a single booking
    app.get("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.findOne(query);
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const query = {
        courseName: booking.courseName,
      };
      const alreadyBooked = await bookingsCollection.find(query).toArray();

      if (alreadyBooked.length) {
        const message = `You are already booked ${booking.courseName} Course`;
        return res.send({ acknowledged: false, message });
      }

      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    /*
=========================================================Payments=====================================================================
    */
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const updatedResult = await bookingsCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });

    // ========================================================JWT Token==================================================================

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "1h",
        });
        return res.send({ accessToken: token });
      }
      console.log(user);
      res.status(403).send({ accessToken: "" });
    });

    //========================================================= User API Convention==========================================================

    app.get("/users", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.put("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    //----------------------------------------temporary to update price field on booking------------------------------------------------------

    // app.get('/addPrice', async(req, res) => {
    //   const filter = {}
    //   const options = { upsert: true };
    //   const updatedDoc = {
    //     $set: {
    //       price: 89,
    //     },
    //   };
    //   const result = await bookingsCollection.updateMany(filter, updatedDoc, options);
    //   res.send(result);
    // })
  } finally {
  }
}
run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send("Welcome! Edulogy Server Site Is Running.");
});

app.listen(port, () =>
  console.log(`Welcome! Edulogy Server Site Is Running on ${port}`)
);
