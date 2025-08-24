import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import "./App.css";

// Configuration
const API_BASE = "http://localhost:5000"; // Your backend URL

function App() {
  const [notifications, setNotifications] = useState([]);
  const [socket, setSocket] = useState(null);
  const [currentUser, setCurrentUser] = useState(1); // Default user ID for testing
  const [newMessage, setNewMessage] = useState("");
  const [newType, setNewType] = useState("like");

  // Use ref to hold the latest state inside Socket.io callbacks
  const notificationsRef = useRef();
  notificationsRef.current = notifications;

  // Initialize Socket.io connection and fetch existing notifications
  useEffect(() => {
    // Establish Socket.io connection
    const newSocket = io(API_BASE);
    setSocket(newSocket);

    // Fetch existing notifications for the current user
    const fetchNotifications = async () => {
      try {
        const response = await axios.get(
          `${API_BASE}/api/notifications/${currentUser}`
        );
        setNotifications(response.data.notifications || []);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };
    fetchNotifications();

    // Listen for new notifications from the server
    newSocket.on("new-notification", (notification) => {
      console.log("Received new notification:", notification);
      // Use the ref to access the latest state and avoid stale closures
      setNotifications((prevNotes) => [notification, ...prevNotes]);
    });

    // Cleanup on component unmount
    return () => {
      newSocket.close();
    };
  }, [currentUser]); // Re-run if currentUser changes

  // Tell the server to join the room for the current user whenever it changes
  useEffect(() => {
    if (socket) {
      console.log(`Joining room for user: ${currentUser}`);
      socket.emit("join", currentUser);
    }
  }, [socket, currentUser]);

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await axios.post(`${API_BASE}/api/notifications`, {
        userId: currentUser,
        type: newType,
        message: newMessage,
      });
      setNewMessage(""); // Clear input on success
    } catch (error) {
      console.error("Error sending notification:", error);
      alert("Failed to send notification. Is the backend running?");
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="App">
      <header>
        <h1>Insyd Notifications PoC</h1>
        <p>User ID: {currentUser}</p>
        <button onClick={() => setCurrentUser((prev) => (prev === 1 ? 2 : 1))}>
          Switch User ({currentUser === 1 ? "Show User 2" : "Show User 1"})
        </button>
      </header>

      <div className="container">
        {/* Control Panel to Send Notifications */}
        <div className="control-panel">
          <h2>Simulate an Activity</h2>
          <form onSubmit={handleSendNotification}>
            <div className="form-group">
              <label>Type:</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              >
                <option value="like">👍 Like</option>
                <option value="comment">💬 Comment</option>
                <option value="follow">👤 Follow</option>
                <option value="message">✉️ Message</option>
                <option value="job">💼 Job</option>
              </select>
            </div>
            <div className="form-group">
              <label>Message:</label>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="E.g., 'Jashwanth Sai liked your post'"
              />
            </div>
            <button type="submit">Send Notification</button>
          </form>
        </div>

        {/* Display Notifications */}
        <div className="notifications-panel">
          <h2>Notifications for User {currentUser}</h2>
          <div className="notifications-list">
            {notifications.length === 0 ? (
              <p>No notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification ${notification.type}`}
                >
                  <div className="notification-content">
                    <p className="message">{notification.message}</p>
                    <div className="meta">
                      <span className="type-badge">{notification.type}</span>
                      <span className="timestamp">
                        {formatDate(notification.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
