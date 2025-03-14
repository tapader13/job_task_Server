const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

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
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Middleware for Admin Authentication
function authenticateAdmin(req, res, next) {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ message: 'Access Denied' });

  try {
    const verified = jwt.verify(token, 'secretkey');
    req.admin = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: 'Invalid Token' });
  }
}

// Routes

// Claim Coupon
app.post('/claim', async (req, res) => {
  const { ip, sessionId } = req.body;

  // Abuse Prevention: Check IP and Session
  const recentClaim = await db
    .collection('coupons')
    .findOne({ claimedBy: ip }, { sort: { _id: -1 } });
  if (
    recentClaim &&
    Date.now() - recentClaim._id.getTimestamp() < 24 * 60 * 60 * 1000
  ) {
    return res
      .status(400)
      .json({ message: 'You can only claim one coupon per day.' });
  }

  // Find the next available coupon
  const coupon = await db
    .collection('coupons')
    .findOne({ isClaimed: false, isActive: true });
  if (!coupon)
    return res.status(404).json({ message: 'No coupons available.' });

  // Assign coupon
  await db
    .collection('coupons')
    .updateOne(
      { _id: coupon._id },
      { $set: { claimedBy: ip, isClaimed: true } }
    );

  res.json({ message: 'Coupon claimed successfully!', coupon: coupon.code });
});

// Admin Login
// app.post('/admin/login', async (req, res) => {
//   const { username, password } = req.body;

//   const admin = await db.collection('admins').findOne({ username });
//   if (!admin) return res.status(400).json({ message: 'Admin not found.' });

//   const validPass = await bcrypt.compare(password, admin.password);
//   if (!validPass) return res.status(400).json({ message: 'Invalid password.' });

//   const token = jwt.sign({ _id: admin._id }, 'secretkey');
//   res.header('Authorization', token).json({ token });
// });

// Admin Routes (Protected)

// View Coupons
// app.get('/admin/coupons', authenticateAdmin, async (req, res) => {
//   const coupons = await db.collection('coupons').find().toArray();
//   res.json(coupons);
// });

// Add Coupon
// app.post('/admin/coupons', authenticateAdmin, async (req, res) => {
//   const { code } = req.body;
//   await db
//     .collection('coupons')
//     .insertOne({ code, isClaimed: false, isActive: true });
//   res.json({ message: 'Coupon added successfully!' });
// });

// Update Coupon
// app.put('/admin/coupons/:id', authenticateAdmin, async (req, res) => {
//   const { isActive } = req.body;
//   await db
//     .collection('coupons')
//     .updateOne({ _id: ObjectId(req.params.id) }, { $set: { isActive } });
//   res.json({ message: 'Coupon updated successfully!' });
// });

// Start Server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
