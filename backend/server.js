const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // URL of your React app
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite database
const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err);
  } else {
    console.log("Connected to SQLite database at", dbPath);
  }
});

// Create notifications table
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    message TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
    (err) => {
      if (err) {
        console.error("Error creating table:", err);
      } else {
        console.log("Notifications table is ready.");
      }
    }
  );
});

// API Routes

// GET /api/notifications/:userId - Get notifications for a user
app.get("/api/notifications/:userId", (req, res) => {
  const userId = req.params.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  // First, get the notifications
  db.all(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      // Then, get the total count for pagination info (optional for POC)
      db.get(
        `SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?`,
        [userId],
        (countErr, countResult) => {
          if (countErr) {
            res.status(500).json({ error: countErr.message });
            return;
          }
          res.json({
            notifications: rows,
            pagination: {
              page,
              limit,
              total: countResult.total,
            },
          });
        }
      );
    }
  );
});

// POST /api/notifications - Create a new notification
app.post("/api/notifications", (req, res) => {
  const { userId, type, message } = req.body;

  // Basic validation
  if (!userId || !type || !message) {
    return res
      .status(400)
      .json({ error: "Missing required fields: userId, type, message" });
  }

  db.run(
    `INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)`,
    [userId, type, message],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Construct the new notification object
      const newNotification = {
        id: this.lastID,
        user_id: userId,
        type,
        message,
        is_read: 0,
        created_at: new Date().toISOString(),
      };

      // Emit the new notification via Socket.io to the specific user's room
      io.to(`user:${userId}`).emit("new-notification", newNotification);
      console.log(`Emitted notification to user:${userId}`, newNotification);

      res.status(201).json({
        message: "Notification created successfully",
        notification: newNotification,
      });
    }
  );
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Listen for a 'join' event from the client to join their user-specific room
  socket.on("join", (userId) => {
    socket.join(`user:${userId}`);
    console.log(`Socket ${socket.id} joined room: user:${userId}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
