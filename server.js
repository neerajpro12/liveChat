const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {origin: '*'}
}); //attach socket.io to http server

//Serve a sample html file later
app.use(express.static(path.join(__dirname, 'public')));

let adminAssigned = false;
let adminId = null;
let maxConnections = 2;

// const readline = require("readline");

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on PORT ${PORT}`);
});


// let rl2;
// menuReadline();

const users = {};
let currentConnections = 0;

//Listen for socket connection
io.on("connection", (socket) => {

    if (currentConnections >= maxConnections) { // Close the connection if the limit is reached
        socket.emit('serverAlert', 'Server is at full capacity. Please try again later.');
        socket.disconnect();
        // console.log('Connection rejected: Server is at full capacity.');
    } else {

        //Username, Userlist and Welcome
        socket.on("setUsername", (username) => {

            currentConnections++;
            socket.userName = username;
            // if (!username.trim()) {
            //     return socket.emit("error", "Username cannot be empty.");
            // }

            if (Object.values(users).includes(username)) {
                socket.emit("serverAlert", "Username already taken. Refresh to try again.");
                return socket.disconnect();
            }


            // console.log(`Active: ${currentConnections}`);
            // console.log("User Connected");
            socket.isAdmin = false;
            users[socket.id] = username;

            if (!adminAssigned) { // Only assign a new admin if one doesn't exist
                assignNewAdmin();
            }

            io.to(socket.id).emit("displayUserName", {
                id: socket.id,
                name: username,
                isAdmin: socket.isAdmin
            });

            io.emit("userList", users);
            socket.emit("serverMessage", `Welcome to the chat, ${username}!`);
            socket.broadcast.emit("serverMessage", `User '${username}' joined.`);

            // if (socket.isAdmin) {
            //     socket.emit("serverMessage", "You are the admin of this session.");
            // }

            if (!adminAssigned) {
                assignNewAdmin();
            }
        });

        socket.on("adminCommand", ({ command, targetIds, message, value }) => {
            if (socket.id === adminId) {


                switch (command) {
                    case "kick":
                        targetIds.forEach(id => removeUser(id));
                        break;

                    case "setMaxConnections":
                        const parsed = parseInt(value);
                        if (!isNaN(parsed) && parsed > 0) {
                            maxConnections = parsed;
                            io.emit("serverMessage", `New Connection limit: ${maxConnections}`);
                            // console.log(`New maxConnections: ${maxConnections}`);
                        } else {
                            socket.emit("serverMessage", "❌ Invalid number for max connections.");
                        }
                        break;

                    case "closeServer":
                        io.emit("serverAlert", "Server is closed by the admin.");
                        io.emit("serverMessage", `Server is closed by the admin.`);
                        setTimeout(() => {
                            process.exit(0);
                        }, 500);
                        break;
                }
            }
        });

        //Listen from a client and print
        socket.on("message", (msg) => {
            // console.log(`${socket.userName} -> all: ${msg}`);
            socket.broadcast.emit("message", { from: socket.userName, msg });
        });

        //Receive and send Private Message
        socket.on("privateMessage", ({ to, message }) => {
            io.to(to).emit("privateMessage", { from: socket.id, name: socket.userName, message });
        });

        // Disconnect
        socket.on("disconnect", () => {
            if (currentConnections > 0) currentConnections--;
            // console.log(`${users[socket.id]} Disconnected`);
            delete users[socket.id];
            io.emit("userList", users);

            if (socket.id === adminId) {
                adminAssigned = false;
                adminId = null;
                io.emit("serverMessage", "⚠️ Admin has left the server.");
                assignNewAdmin();
            }
        });


    }
});

function assignNewAdmin() {
    const remainingUserIds = Object.keys(users);
    if (remainingUserIds.length > 0) {
        const newAdminId = remainingUserIds[0];
        const newAdminSocket = io.sockets.sockets.get(newAdminId);

        if (newAdminSocket) {
            adminId = newAdminId;
            adminAssigned = true;
            newAdminSocket.isAdmin = true;
            newAdminSocket.emit("serverMessage", "You are now the admin.");
            newAdminSocket.emit("displayUserName", {
                id: newAdminSocket.id,
                name: newAdminSocket.userName,
                isAdmin: true
            });
            // console.log(`Admin to ${users[newAdminId]} (${newAdminId})`);
        }
    } else {
        adminId = null;
        adminAssigned = false;
        // console.log("Server is Empty!");
    }
}

function removeUser(userId) {
    if (users[userId]) {
        const us = io.sockets.sockets.get(userId);
        if (us) {
            us.disconnect();
        }
    } else {
        for (const id in users) {
            if (users[id] === userId) {
                const us = io.sockets.sockets.get(id);
                if (us) {
                    us.disconnect();
                    io.emit("serverMessage", `${userId} was removed from this chat.`);
                }
            }
        }
    }
    delete users[userId];
    currentConnections--;
}

//// Uncomment all code below this to input commands from terminal. Also uncomment required console.log statements.
//// Also uncomment const readline(line 17), let rl2;(line 25) and menuReadline();(line 26)

// function menuReadline() {
//     rl2 = readline.createInterface({
//         input: process.stdin,
//         output: process.stdout
//     });
//     showMainMenu();
// }

// function showMainMenu() {
//     rl2.question("", handleMainMenu);
// }

// function handleMainMenu(option) {
//     switch (option.trim().toLowerCase()) {
//         case "help":
//             showHelp();
//             break;

//         case "close":
//             console.log("Server closed!");
//             rl2.close();
//             process.exit(0);
//             break;

//         case "list":
//             if (Object.keys(users).length === 0) {
//                 console.log("⚠️ No users connected.");
//             } else {
//                 console.log("👥 Connected Users:");
//                 for (const [id, name] of Object.entries(users)) {
//                     console.log(`- ${name} (${id})`);
//                 }
//             }
//             break;

//         case "listcount":
//             const count = io.sockets.sockets.size;
//             console.log(`Number of Active Users: ${count}`);
//             break;

//         case "send":
//             return promptSendMessage();

//         case "kick":
//             return kickUser();

//         case "refreshall":
//             return refreshAll(rl2, io, showMainMenu);

//         case "refresh":
//             return refreshEach(rl2, showMainMenu);
//     }

//     showMainMenu();
// }

// function promptSendMessage() {
//     // Collect IDs (all/socket IDs)
//     askForIds(rl2, (ids) => {
//         // If 'all' - send to all clients
//         if (ids.length === 1 && ids[0] === 'all') {
//             rl2.question("Message: ", (message) => {
//                 io.emit("serverMessage", `[Admin] ${message}`);
//                 console.log("✅ Message sent to all clients.");
//                 showMainMenu();
//             });
//         } else {
//             // send to the specific socket IDs
//             rl2.question("Message: ", (message) => {
//                 const validIds = ids.filter(id => users[id]);

//                 if (validIds.length === 0) {
//                     console.log("❌ No valid socket IDs found.");
//                 } else {
//                     validIds.forEach(id => {
//                         io.to(id).emit("serverMessage", `[Admin] ${message}`);
//                         console.log(`✅ Message sent to ${users[id]} (${id})`);
//                     });
//                 }

//                 showMainMenu();
//             });
//         }
//     });
// }

// function kickUser() {
//     askForIds(rl2, (ids) => {
//         if (ids.length === 1 && ids[0] === 'all') {
//             rl2.question("Type 'CONFIRM' to confirm kicking all users: ", (confirmation) => {
//                 if (confirmation === 'CONFIRM') {
//                     io.sockets.sockets.forEach(socket => {
//                         removeUser(socket.id);
//                     });
//                     console.log("All users have been kicked.");
//                 } else {
//                     console.log("Confirmation failed. No users were kicked.");
//                 }
//                 showMainMenu();
//             });
//         } else {
//             ids.forEach(id => {
//                 removeUser(id);
//                 console.log(`Kicked user ${id}`);
//             });
//             showMainMenu();
//         }
//     });
// }

// function showHelp() {
//     console.log(`
// === Available Commands ===
// help       - Show this help menu
// list       - Show connected users
// send       - Send message to a user or all
// close      - Shut down the server
// listactive - Show active users count
// ==========================
// `);
// }

// function refreshAll(r1, io, callback) {
//     r1.question("Are you sure (y/n): ", (answer) => {
//         if (answer.toLowerCase() === 'y') {
//             io.emit("refresh");
//             console.log("All Clients Refreshed!");
//             currentConnections = 0;
//             if (callback) callback();
//         }
//     });
// }

// function refreshEach(r1, callback) {
//     askForIds(r1, (ids) => {
//         if (ids.length === 1 && ids[0] === 'all') {
//             rl2.question("Type 'CONFIRM' to confirm: ", (confirmation) => {
//                 if (confirmation === 'CONFIRM') {
//                     io.emit("refresh");
//                     console.log("✅ Refresh sent to all clients.");
//                     currentConnections = 0;
//                 }
//                 if (callback) callback();
//             });
//         } else {
//             ids.forEach(id => {
//                 const socket = io.sockets.sockets.get(id);
//                 if (socket) {
//                     socket.emit("refresh");
//                     console.log(`✅ Refresh sent to socket ID ${id}`);
//                     currentConnections--;
//                 }
//             });

//             if (callback) callback();
//         }
//     });
// }

// function askForIds(r1, callback) {
//     r1.question("Enter id(s) [use , to separate ids]: ", (answer) => {
//         const ids = answer
//             .split(',')
//             .map(id => id.trim())
//             .filter(id => id.length > 0);

//         let count = 0;

//         if (ids.length === 1 && ids[0].toLowerCase() === 'all') {
//             count = 3; // Special marker for 'all'
//         } else {
//             count = ids.length;
//         }

//         // callback(ids, count);
//         callback(ids);
//     });
// }

