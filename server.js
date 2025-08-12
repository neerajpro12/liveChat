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

const readline = require("readline");
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

server.listen(3000, '0.0.0.0', () => {
    console.log("Server running on PORT 3000");
});

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
        io.to(socket.id).emit("displayUserName", { id: socket.id, name: username });
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
    socket.on("privateMessage", ({ to, message }) => {
        io.to(to).emit("privateMessage", { from: socket.id, name: userNameGlobal, message });
    });


    //socket.emit("message", `Current Count: ${counter}`);
    // const interval = setInterval(() => {
    //     counter++;
    //     io.emit("message", `Current Count: ${counter}`);
    // }, 5000);

    //Remove User
    // removeUser(id);

    //Disconnect
    socket.on("disconnect", () => {
        delete users[socket.id];
        io.emit("userList", users);
        console.log("User Disconnected");
    });
});

function showMainMenu() {
    rl.question("", handleMainMenu);
}

function handleMainMenu(option) {
    switch (option.trim().toLowerCase()) {
        case "help":
            showHelp();
            break;

        case "close":
            console.log("🛑 Shutting down server...");
            rl.close();
            process.exit(0);
            break;

        case "list":
            if (Object.keys(users).length === 0) {
                console.log("⚠️ No users connected.");
            } else {
                console.log("👥 Connected Users:");
                for (const [id, name] of Object.entries(users)) {
                    console.log(`- ${name} (${id})`);
                }
            }
            break;

        case "send":
            return promptSendMessage(); // Don't call showMainMenu here — it's handled inside

        case "kick":
            return kickUser();

        case "refreshall":
            return refreshAll(rl, io, showMainMenu); // pass everything

        case "refresh":
            return refreshEach(rl, showMainMenu); // fixed typo and args


        default:
            console.log("❌ Unknown command. Type 'help' for available commands.");
            break;
    }

    // Always return to main menu unless promptSendMessage() took over
    showMainMenu();
}

function promptSendMessage() {
    rl.question("Send to (all or socket ID): ", (target) => {
        rl.question("Message: ", (message) => {
            if (target === "all") {
                io.emit("serverMessage", `[Admin] ${message}`);
                console.log("✅ Message sent to all clients.");
            } else if (users[target]) {
                io.to(target).emit("serverMessage", `[Admin] ${message}`);
                console.log(`✅ Message sent to ${users[target]} (${target})`);
            } else {
                console.log("❌ Invalid socket ID.");
            }

            // After sending, return to menu
            showMainMenu();
        });
    });
}

function kickUser() {
    askForIds(rl, (ids) => {
        ids.forEach(id => {
            removeUser(id);
        });
        showMainMenu(); // Return to menu after kicking
    });
}

function removeUser(userId) {
    const us = io.sockets.sockets.get(userId);
    if (us) {
        us.disconnect();
    }
    delete users[userId];
}

function showHelp() {
    console.log(`
=== Available Commands ===
help   - Show this help menu
list   - Show connected users
send   - Send message to a user or all
close  - Shut down the server
==========================
`);
}

function refreshAll(r1, io, callback) {
    r1.question("Are you sure (y/n): ", (answer) => {
        if (answer.toLowerCase() === 'y') {
            io.emit("refresh");
            console.log("All Clients Refreshed!");
            if (callback) callback();
        }
    });
}

function refreshIds(ids) {
    ids.forEach(id => {
        const socket = io.sockets.sockets.get(id.trim());
        if (socket) {
            socket.emit("refresh");
        }
    });
}

function refreshEach(r1, callback) {
    askForIds(r1, (ids) => {
        ids.forEach(id => {
            const socket = io.sockets.sockets.get(id);
            if (socket) {
                socket.emit("refresh");
            }
        });
        if (callback) callback();
    });
}

function askForIds(r1, callback) {
    r1.question("Enter id(s) [use , to separate ids]: ", (answer) => {
        const ids = answer
            .split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0);
        callback(ids);
    });
}


showMainMenu();
