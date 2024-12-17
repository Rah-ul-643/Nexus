const server = require('http').createServer();
const { Server } = require('socket.io');

const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL;

const io = new Server(server, {
    cors: {
        origin: CLIENT_URL, // Allow requests from your frontend
        methods: ["GET", "POST"],       // Allow these methods
        credentials: true               // Allow credentials (if needed)
    }
});


io.on('connection', (socket) => {
    console.log(`Client connected with socket id: ${socket.id}`);

    socket.on('cancelCall', (id) => {
        console.log("cancel call request received");        
        socket.to(id).emit('cancelCall');
    })
});

server.listen(PORT, () => {
    console.log(`server listening on port: ${PORT}`);
})