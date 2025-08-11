const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);//attach socket.io to http server

//Serve a smple html file later
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
})

const users = {};
let userNameGlobal = "";
//Listen for socket connection
io.on("connection", (socket) => {
    console.log("User Connected");

    //Username, Userlist and Welcome
    socket.on("setUsername", (username) => {
        socket.username = username;
        users[socket.id] = username;
        userNameGlobal = username;
        // console.log(`Your ID: ${socket.id}, Username: ${username}`);
        io.to(socket.id).emit("displayUserName", {id: socket.id, name: username});
        io.emit("userList", users);
        // console.log(`User ${socket.id} is ${username}`);
        socket.emit("serverMessage", `Welcome to the Server, ${username}!`); //Message to new comer
        socket.broadcast.emit("serverMessage", `User with id '${username}' joined.`) //Broadcast to all
    });

    //Listen from a client and print
    socket.on("message", (msg) => {
        console.log(`${userNameGlobal}: ${msg}`);
    });

    //Listen for a "chatMessage" event from this client
    socket.on("chatMessage", (msg) => {
        console.log("Message form client: ", msg);
        io.emit("chatMessage", msg);
    });

    //Receice and send Private Message
    socket.on("privateMessage", ({to, message}) => {
        io.to(to).emit("privateMessage", {from: socket.id, name: userNameGlobal , message});
    });


    //socket.emit("message", `Current Count: ${counter}`);
    // const interval = setInterval(() => {
    //     counter++;
    //     io.emit("message", `Current Count: ${counter}`);
    // }, 5000);

    //Disconnect
    socket.on("disconnect", () => {
        delete users[socket.id];
        io.emit("userList", users);
        console.log("User Disconnected");
    });
});

server.listen(3000, () => {
    console.log("Server running on PORT 3000}");
});
