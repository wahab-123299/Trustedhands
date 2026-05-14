const http = require('http');
require('dotenv').config();
require('./config/passport');

const app = require('./app');
const connectDB = require('./config/database');
const { init: initSocket, getIO } = require('./config/socket'); // ✅ Use config/socket
const chatSocket = require('./socket/chatSocket');
const notificationSocket = require('./socket/notificationSocket');
const mongoose = require('mongoose');

// ... (keep your existing env/logging code) ...

const startServer = async () => {
  try {
    await connectDB();
    console.log('Database connection established');

    const server = http.createServer(app);

    // ✅ Use config/socket.js to initialize
    const io = initSocket(server);
    app.set('io', io);

    // ✅ Initialize socket handlers
    chatSocket(io);
    notificationSocket(io);

    // ✅ Register notification routes
    const notificationRoutes = require('./routes/notificationRoutes');
    app.use('/api/notifications', notificationRoutes);

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // ... (keep your existing error handlers) ...

  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};


startServer();