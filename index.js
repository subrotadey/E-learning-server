const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hs9qs.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
async function run() {
  try {
    const courseCollection = client.db('onlineEdulogy').collection('courses');
    const bookingsCollection = client.db('onlineEdulogy').collection('bookings')

    app.get("/courses", async (req, res) => {
      const query = {};
      const course = await courseCollection.find(query).toArray();
      res.send(course);
    });

    /*
      API naming Convention
      app.get('bookings')
      app.get('/bookings/id')
      app.post('bookings')
      app.patch('/bookings/id')
      app.delete('/bookings/id')
    */


      app.post('/bookings', async(req, res) => {
        const booking = req.body;
        const query = {
          courseName:booking.courseName
        }
        const alreadyBooked = await bookingsCollection.find(query).toArray();

        if(alreadyBooked.length){
          const message = `You are already booked ${booking.courseName} Course`
          return res.send({acknowledged: false, message})
        }
        
        const result = await bookingsCollection.insertOne(booking);
        res.send(result);
      })
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
