const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/chatapp', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
const db = mongoose.connection;

// Handle MongoDB connection errors
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Define a schema for chat messages
const messageSchema = new mongoose.Schema({
    message: String,
    screenName: String,
    timestamp: { type: Date, default: Date.now }
});

// Create a model based on the schema
const Message = mongoose.model('Message', messageSchema);

// Serve static files
app.use(express.static('public'));

// Handle Socket.IO connections
io.on('connection', (socket) => {
    let userIP = socket.request.connection.remoteAddress;

    if (socket.handshake.headers['x-forwarded-for']) {
        userIP = socket.handshake.headers['x-forwarded-for'].split(',')[0];
    }

    console.log(`New user connected from ${userIP}`);

    // Load chat history from MongoDB and send to the user
    const loadChatHistory = async () => {
        try {
            const messages = await Message.find().sort({ timestamp: 1 }).exec();
            socket.emit('chatHistory', messages);
        } catch (err) {
            console.error(err);
        }
    };

    loadChatHistory();

    // Handle incoming messages
    socket.on('message', async (data) => {
        const { message, screenName } = data;
        const newMessage = new Message({ message, screenName });

        try {
            await newMessage.save();
            io.emit('message', newMessage);

            // Check if message count exceeds 500
            const messageCount = await Message.countDocuments();
            if (messageCount > 500) {
                // Find and delete the oldest message(s)
                const oldestMessages = await Message.find().sort({ timestamp: 1 }).limit(messageCount - 500);
                for (let msg of oldestMessages) {
                    await msg.remove();
                }
            }
        } catch (err) {
            console.error(err);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
