const http = require('http');
require('dotenv').config();
require('./config/passport');



const app = require('./app');
const connectDB = require('./config/database');
const { init: initSocket } = require('./config/socket');
const chatSocket = require('./socket/chatSocket');
const notificationSocket = require('./socket/notificationSocket');
const mongoose = require('mongoose');



const startServer = async () => {
  try {
    await connectDB();
    console.log('Database connection established');

    const server = http.createServer(app);


    const io = initSocket(server);
    app.set('io', io);


    chatSocket(io);
    notificationSocket(io);


    const notificationRoutes = require('./routes/notificationRoutes');
    app.use('/api/notifications', notificationRoutes);

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });



  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};


startServer();