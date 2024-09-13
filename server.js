const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI);
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));

const messageSchema = new mongoose.Schema({
    message: String,
    screenName: String,
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

app.use(express.static('public'));

// Define protected screen names and their passwords using environment variables
const protectedNames = {
    'sunnyrain': process.env.COOLKID_PASSWORD,
};

let onlineUsers = 0;

io.on('connection', (socket) => {
    onlineUsers++;
    io.emit('onlineUsers', onlineUsers);

    console.log(`A user connected. Total online users: ${onlineUsers}`);

    socket.on('message', async (data) => {
        const { message, screenName, password } = data;
    
        const normalizedScreenName = screenName.toLowerCase();
    
        if (protectedNames[normalizedScreenName]) {
            if (password !== protectedNames[normalizedScreenName]) {
                socket.emit('messageError', 'Incorrect password for this screen name.');
                return;
            }
        }

        const newMessage = new Message({ message, screenName });

        try {
            await newMessage.save();
            io.emit('message', newMessage);
    
            const messageCount = await Message.countDocuments();
            if (messageCount > 500) {
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
        onlineUsers--;
        io.emit('onlineUsers', onlineUsers);
        console.log(`A user disconnected. Total online users: ${onlineUsers}`);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
