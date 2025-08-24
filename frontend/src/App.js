import React, { useState, useEffect } from "react";
import axios from "axios";
import io from "socket.io-client";
import "./App.css";

const API_BASE = "http://localhost:5000";

function App() {
  const [notifications, setNotifications] = useState([]);
  const [socket, setSocket] = useState(null);
  const [userId, setUserId] = useState(1); // Default user for POC
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(API_BASE);
    setSocket(newSocket);

    // Join user room
    newSocket.emit("join", userId);

    // Listen for notifications
    newSocket.on(`notification:${userId}`, (notification) => {
      setNotifications((prev) => [notification, ...prev]);
    });

    // Cleanup on unmount
    return () => newSocket.close();
  }, [userId]);

  useEffect(() => {
    // Load existing notifications
    fetchNotifications();
  }, [userId]);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/notifications/${userId}`
      );
      setNotifications(response.data.notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const createNotification = async () => {
    if (!message) return;

    try {
      await axios.post(`${API_BASE}/api/notifications`, {
        userId,
        type,
        message,
      });
      setMessage("");
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Insyd Notifications</h1>
      </header>

      <div className="container">
        <div className="control-panel">
          <h2>Send Notification</h2>
          <div>
            <label>
              User ID:
              <input
                type="number"
                value={userId}
                onChange={(e) => setUserId(parseInt(e.target.value) || 1)}
                min="1"
              />
            </label>
          </div>
          <div>
            <label>
              Type:
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="info">Info</option>
                <option value="alert">Alert</option>
                <option value="message">Message</option>
                <option value="like">Like</option>
                <option value="comment">Comment</option>
                <option value="follow">Follow</option>
              </select>
            </label>
          </div>
          <div>
            <label>
              Message:
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter notification message"
              />
            </label>
          </div>
          <button onClick={createNotification}>Send Notification</button>
        </div>

        <div className="notifications-panel">
          <h2>Notifications for User {userId}</h2>
          <div className="notifications-list">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`notification ${notification.type}`}
              >
                <div className="notification-message">
                  {notification.message}
                </div>
                <div className="notification-meta">
                  <span className="notification-type">{notification.type}</span>
                  <span className="notification-time">
                    {formatDate(notification.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
