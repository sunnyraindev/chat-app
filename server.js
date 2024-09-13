const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');

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

let onlineUsers = 0;

io.on('connection', (socket) => {
    onlineUsers++;
    io.emit('onlineUsers', onlineUsers);

    console.log(`A user connected. Total online users: ${onlineUsers}`);

    const loadChatHistory = async () => {
        try {
            const messages = await Message.find().sort({ timestamp: 1 }).exec();
            socket.emit('chatHistory', messages);
        } catch (err) {
            console.error(err);
        }
    };

    loadChatHistory();

    socket.on('message', async (data) => {
        const { message, screenName } = data;
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
