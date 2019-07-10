// it's easiest to share typedefs as an ambient declaration file
/// <reference path="./messages.d.ts" />

import * as express from "express";
import * as expressWs from "express-ws";
import * as WebSocket from "ws";
import { createServer } from "http";

interface User {
  socket: WebSocket;
  name: string;
}

// we'll keep a list of our connected users, as we need to send them messages later
let connectedUsers: User[] = [];

/**
 * Searches the currently connected users and returns the first one connected to the provided socket.
 * @param socket The socket to search for
 */
function findUserBySocket(socket: WebSocket): User | undefined {
  return connectedUsers.find((user) => user.socket === socket);
}

/**
 * Searches the currently connected users and returns the first one with the provided name.
 * @param name The name to search for
 */
function findUserByName(name: string): User | undefined {
  return connectedUsers.find((user) => user.name === name);
}

/**
 * Forwards this message to the person
 * @param sender The person originally sending this message
 * @param message The received message
 */
function forwardMessageToOtherPerson(sender: User, message: WebSocketCallMessage): void {
  const receiver = findUserByName(message.otherPerson);
  if (!receiver) {
    // in case this user doesn't exist, don't do anything
    return;
  }

  const json = JSON.stringify({
    ...message,
    otherPerson: sender.name,
  });

  receiver.socket.send(json);
}

/**
 * Processes the incoming message.
 * @param socket The socket that sent the message
 * @param message The message itself
 */
function handleMessage(socket: WebSocket, message: WebSocketMessage): void {
  const sender = findUserBySocket(socket) || {
    name: "[unknown]",
    socket,
  };

  switch (message.channel) {
    case "login":
      console.log(`${message.name} joined`);
      connectedUsers.push({ socket, name: message.name });
      break;

    case "start_call":
      console.log(`${sender.name} started a call with ${message.otherPerson}`);
      forwardMessageToOtherPerson(sender, message);
      break;

    case "webrtc_ice_candidate":
      console.log(`received ice candidate from ${sender.name}`);
      forwardMessageToOtherPerson(sender, message);
      break;

    case "webrtc_offer":
      console.log(`received offer from ${sender.name}`);
      forwardMessageToOtherPerson(sender, message);
      break;

    case "webrtc_answer":
      console.log(`received answer from ${sender.name}`);
      forwardMessageToOtherPerson(sender, message);
      break;

    default:
      console.log("unknown message", message);
      break;
  }
}

/**
 * Adds event listeners to the incoming socket.
 * @param socket The incoming WebSocket
 */
function handleSocketConnection(socket: WebSocket): void {
  socket.addEventListener("message", (event) => {
    // incoming messages are strings of buffers. we need to convert them
    // to objects first using JSON.parse()
    // it's safe to assume we'll only receive valid json here though
    const json = JSON.parse(event.data.toString());
    handleMessage(socket, json);
  });

  socket.addEventListener("close", () => {
    // remove the user from our user list
    connectedUsers = connectedUsers.filter((user) => {
      if (user.socket === socket) {
        console.log(`${user.name} disconnected`);
        return false;
      }

      return true;
    });
  });
}

// create an express app, using http `createServer`
const app = express();
const server = createServer(app);

// we'll serve our public directory under /
app.use("/", express.static("public"));

// add a websocket listener under /ws
const wsApp = expressWs(app, server).app;
wsApp.ws("/ws", handleSocketConnection);

// start the server
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`server started on http://localhost:${port}`);
});
