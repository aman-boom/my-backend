const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

const app = express();
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// ================= CLOUDINARY CONFIG =================
cloudinary.config({
  cloud_name: "YOUR_CLOUD_NAME",
  api_key: "YOUR_API_KEY",
  api_secret: "YOUR_API_SECRET"
});

// ================= DATABASE =================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ================= DB SETUP =================
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      device_id TEXT UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS images (
      id SERIAL PRIMARY KEY,
      device_id TEXT,
      image_url TEXT
    );
  `);
}
initDB();

// ================= UPLOAD IMAGE =================
app.post("/upload-image", upload.single("image"), async (req, res) => {
  try {
    const device_id = req.body.device_id;

    if (!req.file) {
      return res.status(400).send("No file");
    }

    // Upload to Cloudinary
    const stream = cloudinary.uploader.upload_stream(
      { folder: "tic_tac_toe_app" },
      async (error, result) => {
        if (error) {
          console.error(error);
          return res.status(500).send("Upload error");
        }

        const imageUrl = result.secure_url;

        // Save user
        await pool.query(
          "INSERT INTO users (device_id) VALUES ($1) ON CONFLICT DO NOTHING",
          [device_id]
        );

        // Save image URL
        await pool.query(
          "INSERT INTO images (device_id, image_url) VALUES ($1, $2)",
          [device_id, imageUrl]
        );

        res.json({ url: imageUrl });
      }
    );

    stream.end(req.file.buffer);

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// ================= VIEW USERS =================
app.get("/users", async (req, res) => {
  const result = await pool.query("SELECT * FROM users ORDER BY id DESC");

  let html = `
  <html>
  <body style="background:#0f172a;color:white;padding:20px;">
  <h1>Users</h1>
  `;

  result.rows.forEach(user => {
    html += `
      <div style="margin:10px;">
        <a href="/user/${user.device_id}" style="color:#22c55e;">
          ${user.device_id}
        </a>
      </div>
    `;
  });

  html += "</body></html>";
  res.send(html);
});

// ================= USER IMAGES =================
app.get("/user/:device_id", async (req, res) => {
  try {
    const device_id = req.params.device_id;

    const images = await pool.query(
      "SELECT * FROM images WHERE device_id=$1",
      [device_id]
    );

    let html = `
    <html>
    <body style="background:#0f172a;color:white;padding:20px;">
    <h1>Device: ${device_id}</h1>
    `;

    images.rows.forEach(img => {
      html += `
        <div style="margin:10px;">
          <img src="${img.image_url}" width="200"/>
        </div>
      `;
    });

    html += "</body></html>";
    res.send(html);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading user data");
  }
});

// ================= HOME =================
app.get("/", (req, res) => {
  res.send(`
    <html>
    <body style="background:#0f172a;color:white;text-align:center;padding:50px;">
      <h1>Backend Running ✅</h1>
      <a href="/users" style="color:#22c55e;font-size:20px;">View Users</a>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running 🚀"));
