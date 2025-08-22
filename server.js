const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
}); //attach socket.io to http server

//Serve a sample html file later
app.use(express.static(path.join(__dirname, 'public')));

//Landing Page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

//Chat Page
app.get("/chat/:room", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "chat.html"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on PORT ${PORT}`);
});

const users = {};
const adminList = {};
const inRoom = {};

//Listen for socket connection
io.on("connection", (socket) => {
    socket.on("joinRoom", (roomname, callback) => {
        const room = io.sockets.adapter.rooms.get(roomname);
        const numClients = room ? room.size : 0;

        if (!inRoom[roomname]) {
            inRoom[roomname] = 10;
        }

        if (!users[roomname]) {
            users[roomname] = {};
        }

        if (numClients >= inRoom[roomname]) {
            callback({ success: false, message: "Room is full" });
            users[roomname][socket.id] = "temp";
            console.log(users);
            socket.disconnect();
            return;
        }

        socket.areaName = roomname;
        socket.join(roomname);
        // console.log(`User joined the room ${roomname}`);

        if (!Object.keys(adminList).includes(roomname)) {
            adminList[roomname] = socket.id;
            socket.emit("serverMessage", "You are the admin for this chat.");
        }
        // console.log("Admin List: ", adminList);
    });

    //Username, Userlist and Welcome
    socket.on("setUsername", ({ username, roomname }) => {

        socket.userName = username;
        // if (!username.trim()) {
        //     return socket.emit("error", "Username cannot be empty.");
        // }

        if (Object.values(users[roomname]).includes(username)) {
            socket.emit("serverAlert", "Username already taken. Refresh to try again.");
            return socket.disconnect();
        }

        if (Object.values(adminList).includes(socket.id)) {
            socket.isAdmin = true;
        } else {
            socket.isAdmin = false;
        }
        users[roomname][socket.id] = username;
        // console.log("Users List: ", users, "\n");

        io.to(socket.id).emit("displayUserName", {
            id: socket.id,
            name: username,
            isAdmin: socket.isAdmin,
            displayRoom: roomname
        });

        io.to(roomname).emit("userList", users[roomname]);
        socket.emit("serverMessage", `Welcome to the chat, ${username}!`);
        socket.broadcast.to(roomname).emit("serverMessage", `User '${username}' joined.`);
    });

    socket.on("adminCommand", ({ command, targetIds, message, value, roomname }) => {
        if (adminList[socket.areaName] === socket.id) {

            switch (command) {

                case "kick":
                    targetIds.forEach(id => removeUser({ userId: id, roomname }));
                    break;

                case "setMaxConnections":
                    const parsed = parseInt(value);
                    if (!isNaN(parsed) && parsed > 0) {
                        inRoom[roomname] = parsed;
                        io.emit("serverMessage", `New Connection limit: ${parsed}`);
                    } else {
                        socket.to(roomname).emit("serverMessage", "❌ Invalid number for max connections.");
                    }
                    break;

                case "closeServer":
                    io.emit("serverAlert", "Server is closed by the admin.");
                    io.emit("serverMessage", `Server is closed by the admin.`);
                    closeServer(roomname);
                    break;
            }
        }
    });

    //Listen from a client and print
    socket.on("message", ({ msg, roomname }) => {
        // console.log(`${socket.userName} -> all: ${msg}`);
        socket.broadcast.to(roomname).emit("message", { from: socket.userName, msg });
    });

    //Receive and send Private Message
    socket.on("privateMessage", ({ to, message, roomname }) => {
        console.log(to);
        io.to(to).emit("privateMessage", { from: socket.id, name: socket.userName, message });
    });

    // Disconnect
    socket.on("disconnect", () => {
        console.log("Socket to disconnect:", socket.id);
        console.log("Users: ", users);
        if (users[socket.areaName] && users[socket.areaName][socket.id]) {
            io.to(socket.areaName).emit("serverMessage", `${JSON.stringify(users[socket.areaName][socket.id])} left.`)
            delete users[socket.areaName][socket.id];
        }
        if (users[socket.areaName] && Object.keys(users[socket.areaName]).length === 0) {
            delete users[socket.areaName];
            delete adminList[socket.areaName];
        }
        io.to(socket.areaName).emit("userList", users[socket.areaName]);

        if (socket.isAdmin) {
            assignAdmin(socket.areaName);
        }

    });
}
);

function assignAdmin(areaName) {
    const roomTemp = io.sockets.adapter.rooms.get(areaName);
    const numClientsTemp = roomTemp ? roomTemp.size : 0;
    if (numClientsTemp > 0) {
        const first = Object.keys(users[areaName])[0];
        adminList[areaName] = first;
        // console.log(`Admin List: `, adminList);
        io.to(first).emit("displayUserName", {
            id: first,
            name: users[areaName][first],
            isAdmin: true,
            displayRoom: areaName
        });
    }

}

function removeUser({ userId, roomname }) {
    for (const id in users[roomname]) {
        if (users[roomname][id] === userId) {
            const us = io.sockets.sockets.get(id);
            if (us) {
                setTimeout(() => {
                    us.disconnect();
                }, 0);
                io.to(roomname).emit("serverMessage", `${userId} was removed from this chat.`);
            }
        }
    }
}

function closeServer(roomname) {
    for (const i in users[roomname]) {
        const us = io.sockets.sockets.get(i);
        if (us) {
            us.disconnect();
        }
    }
    delete users[roomname];
    delete adminList[roomname];
}
