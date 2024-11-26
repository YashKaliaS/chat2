const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");

const userRoutes = require("./Routes/userRoutes");
const chatRoutes = require("./Routes/chatRoutes");
const messageRoutes = require("./Routes/messageRoutes");

dotenv.config();
const app = express();

// Database Connection
const connect_db = async () => {
  try {
    await mongoose.connect(process.env.DATABASE);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to database:", error.message);
  }
};
connect_db();

// Middleware
app.use(express.json());

// CORS Configuration
const allowedOrigins = [
  "https://chat2-fidd.vercel.app", // Production frontend
  "http://localhost:3000", // Development frontend
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without an origin (e.g., curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// Routes
app.get("/", (req, res) => {
  res.send("Welcome to Chat Now 2023");
});
app.use("/user", userRoutes);
app.use("/chats", chatRoutes);
app.use("/message", messageRoutes);

// Start Server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Socket.io Configuration
const io = require("socket.io")(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
});

const onlineUsers = {};

// Socket Events
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // User setup
  socket.on("setup", (userId) => {
    onlineUsers[userId] = socket.id;
    socket.join(userId);
    socket.emit("connected");
    io.emit("user online", userId);
  });

  // User disconnect
  socket.on("disconnect", () => {
    const userId = Object.keys(onlineUsers).find(
      (key) => onlineUsers[key] === socket.id
    );
    if (userId) {
      delete onlineUsers[userId];
      io.emit("user offline", userId);
    }
    console.log("Client disconnected:", socket.id);
  });

  // Join chat
  socket.on("join chat", (room) => {
    socket.join(room);
  });

  // Typing indicators
  socket.on("typing", (room) => {
    socket.to(room).emit("typing");
  });
  socket.on("stop typing", (room) => {
    socket.to(room).emit("stop typing");
  });

  // New message
  socket.on("new message", (newMessageStatus) => {
    const { chat, sender } = newMessageStatus;

    if (!chat?.users) {
      return console.error("Chat users not found");
    }

    chat.users.forEach((user) => {
      if (user._id === sender._id) return;
      socket.to(user._id).emit("message received", newMessageStatus);
    });
  });
});
