const http = require('http');
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/database');
const { init: initSocket } = require('./config/socket');
const chatSocket = require('./socket/chatSocket');

const startServer = async () => {
  try {
    // ✅ Verify dotenv loaded properly
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not defined. Check that your .env file exists at:');
      console.error('   C:\\Users\\HP\\Documents\\GitHub\\Trustedhands\\backend\\.env');
      console.error('   And that it contains: MONGODB_URI=...');
      process.exit(1);
    }

    await connectDB();
    console.log('Database connection established');

    const server = http.createServer(app);
    const io = initSocket(server);
    app.set('io', io);
    chatSocket(io);

    // ❌ REMOVED: Route registration — belongs in app.js, not here

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