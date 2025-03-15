const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);

// MongoDB Connection URL
const uri =
  'mongodb+srv://minhajtapader0:gPqGhQgHdoTjyayL@cluster0.aax42.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Connect to MongoDB
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
    const couponDB = client.db('couponDB');
    const couponCollection = couponDB.collection('coupons');
    const userCollection = couponDB.collection('users');

    // Claim Coupon
    app.post('/claim', async (req, res) => {
      const { ip } = req.body;
      console.log(ip, 'claim');
      const lastClaimTime = req.cookies.lastClaimTime;
      console.log(lastClaimTime);
      if (lastClaimTime) {
        const elapsedTime = Date.now() - parseInt(lastClaimTime, 10);
        if (elapsedTime < 24 * 60 * 60 * 1000) {
          return res
            .status(400)
            .json({ message: 'You can only claim one coupon per day.' });
        }
      }

      const recentClaim = await couponCollection.findOne(
        { claimedBy: ip, isClame: true },
        { sort: { _id: -1 } }
      );
      console.log('recentClaim', recentClaim);
      if (recentClaim) {
        const claimTime = new Date(recentClaim.claimTime);
        console.log('Previous claim time:', claimTime);

        const timeSinceClaim = Date.now() - claimTime.getTime();
        console.log('Time since last claim:', timeSinceClaim);

        if (timeSinceClaim < 24 * 60 * 60 * 1000) {
          return res
            .status(400)
            .json({ message: 'You can only claim one coupon per day.' });
        }
      }

      const coupon = await couponCollection.findOne({
        isClame: false,
        isActive: true,
      });

      if (!coupon) {
        return res.status(404).json({ message: 'No coupons available.' });
      }

      await couponCollection.updateOne(
        { _id: coupon._id },
        {
          $set: {
            claimedBy: ip,
            isClame: true,
            claimTime: new Date(),
          },
        }
      );

      console.log('Coupon successfully updated:', coupon);

      res
        .cookie('lastClaimTime', Date.now(), {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
        })
        .json({
          message: 'Coupon claimed successfully!',
          coupon: coupon.code,
        });
    });

    // Admin Login
    app.post('/admin/login', async (req, res) => {
      const { username, password } = req.body;
      console.log(username, password);
      const admin = await userCollection.findOne({ username });
      if (!admin) return res.status(400).json({ message: 'Admin not found.' });

      const validPass = await bcrypt.compare(password, admin.password);
      if (!validPass)
        return res.status(400).json({ message: 'Invalid password.' });

      const token = jwt.sign({ _id: admin._id }, 'secretkey');
      res.header('Authorization', token).json({ token });
    });

    // View Coupons
    app.get('/admin/coupons', async (req, res) => {
      const coupons = await couponCollection.find().toArray();
      res.json(coupons);
    });

    // View history
    app.get('/admin/history', async (req, res) => {
      const history = await couponCollection
        .aggregate([
          {
            $match: { claimedBy: { $ne: null } },
          },
          {
            $group: {
              _id: '$claimedBy',
              coupons: { $push: '$$ROOT' },
            },
          },
          {
            $project: {
              _id: 1,

              coupons: 1,
            },
          },
        ])
        .toArray();
      console.log(history);
      res.json(history);
    });

    // Add Coupon
    app.post('/admin/coupons', async (req, res) => {
      const { code, isClame, isActive } = req.body;
      await couponCollection.insertOne({
        code,
        isClame,
        isActive,
      });
      res.json({ message: 'Coupon added successfully!' });
    });

    // Update Coupon
    app.put('/admin/coupons/:id', async (req, res) => {
      const { isActive, isClame, code } = req.body;
      console.log(req.params.id, 123);
      await couponCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { isActive, isClame, code } }
      );
      res.json({ message: 'Coupon updated successfully!' });
    });

    // Update Available Coupons
    app.patch('/admin/coupons/:id', async (req, res) => {
      const { isActive } = req.body;
      console.log(req.params.id);
      await couponCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { isActive } }
      );
      res.json({ message: 'Coupon updated successfully!' });
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Start Server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
