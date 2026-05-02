const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require('bcryptjs');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE
});

db.connect(err => {
  if (err) console.error("DB error:", err);
  else console.log("Connected to MySQL");
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  db.query(
    "INSERT INTO users (username,password) VALUES (?,?)",
    [username, hash],
    (err, result) => {
      if (err) { console.error(err); return res.status(500).send("Registration error"); }
      res.send("OK");
    }
  );
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  console.log("Login attempt:", username, "pass length:", password?.length);
  db.query(
    "SELECT id, password FROM users WHERE username=?",
    [username],
    async (err, results) => {
      if (err) { console.error(err); return res.status(500).send("Login error"); }
      if (results.length === 0) return res.status(401).send("Login failed");
      console.log("Found user, hash length:", results[0].password?.length);
      const match = await bcrypt.compare(password, results[0].password);
      console.log("Match result:", match);
      if (!match) return res.status(401).send("Login failed");
      res.json({ userId: results[0].id });
    }
  );
});

app.get("/days/all/:userId", (req, res) => {
  const { userId } = req.params;
  db.query(
    "SELECT DATE_FORMAT(date, '%Y-%m-%d') as date, type FROM days WHERE user_id=?",
    [userId],
    (err, result) => {
      if (err) { console.error(err); return res.status(500).send("Days error"); }
      res.json(result);
    }
  );
});

app.get("/days/:userId/:year/:month", (req, res) => {
  const { userId, year, month } = req.params;
  db.query(
    "SELECT DATE_FORMAT(date, '%Y-%m-%d') as date, type FROM days WHERE user_id=? AND YEAR(date)=? AND MONTH(date)=?",
    [userId, year, month],
    (err, result) => {
      if (err) { console.error(err); return res.status(500).send("Days error"); }
      res.json(result);
    }
  );
});

app.post("/save", (req, res) => {
  const { date, type, userId } = req.body;
  if (!userId || !date) return res.status(400).send("Missing data");
  if (type) {
    db.query(
      "INSERT INTO days (date,type,user_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE type = VALUES(type)",
      [date, type, userId],
      err => {
        if (err) { console.error(err); return res.status(500).send("Save error"); }
        res.send("Saved");
      }
    );
  } else {
    db.query(
      "DELETE FROM days WHERE date=? AND user_id=?",
      [date, userId],
      err => {
        if (err) { console.error(err); return res.status(500).send("Delete error"); }
        res.send("Deleted");
      }
    );
  }
});

app.get("/stats/:userId/:year/:month", (req, res) => {
  const { userId, year, month } = req.params;
  db.query(
    "SELECT type, COUNT(*) as count FROM days WHERE user_id=? AND YEAR(date)=? AND MONTH(date)=? GROUP BY type",
    [userId, year, month],
    (err, result) => {
      if (err) { console.error(err); return res.status(500).send("Stats error"); }
      res.json(result);
    }
  );
});

app.delete("/clear/:userId/:year/:month", (req, res) => {
  const { userId, year, month } = req.params;
  db.query(
    "DELETE FROM days WHERE user_id=? AND YEAR(date)=? AND MONTH(date)=?",
    [userId, year, month],
    err => {
      if (err) { console.error(err); return res.status(500).send("Clear error"); }
      res.send("Cleared");
    }
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
