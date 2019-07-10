/// <reference path="../messages.d.ts" />

/**
 * Hides the given element by setting `display: none`.
 * @param {HTMLElement} element The element to hide
 */
function hideElement(element) {
  element.style.display = "none";
}

/**
 * Shows the given element by resetting the display CSS property.
 * @param {HTMLElement} element The element to show
 */
function showElement(element) {
  element.style.display = "";
}

const callButton = document.getElementById("call-button");
const videoContainer = document.getElementById("video-container");

/**
 * Hides both local and remote video, but shows the "call" button.
 */
function hideVideoCall() {
  hideElement(videoContainer);
  showElement(callButton);
}

/**
 * Shows both local and remote video, and hides the "call" button.
 */
function showVideoCall() {
  hideElement(callButton);
  showElement(videoContainer);
}

/** @type {string} */
let otherPerson;

const username = prompt("What's your name?", `user${Math.floor(Math.random() * 100)}`);
const socketUrl = `ws://${location.host}/ws`;
const socket = new WebSocket(socketUrl);

/**
 * Sends the message over the socket.
 * @param {WebSocketMessage} message The message to send
 */
function sendMessageToSignallingServer(message) {
  const json = JSON.stringify(message);
  socket.send(json);
}

// log in directly after the socket was opened
socket.addEventListener("open", () => {
  console.log("websocket connected");
  sendMessageToSignallingServer({
    channel: "login",
    name: username,
  });
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data.toString());
  handleMessage(message);
});

/**
 * Processes the incoming message.
 * @param {WebSocketMessage} message The incoming message
 */
async function handleMessage(message) {
  switch (message.channel) {
    case "start_call":
      console.log(`receiving call from ${message.with}`);
      otherPerson = message.otherPerson;
      showVideoCall();

      const offer = await webrtc.createOffer();
      await webrtc.setLocalDescription(offer);
      sendMessageToSignallingServer({
        channel: "webrtc_offer",
        offer,
        otherPerson,
      });
      break;

    case "webrtc_ice_candidate":
      console.log("received ice candidate");
      await webrtc.addIceCandidate(message.candidate);
      break;

    case "webrtc_offer":
      console.log("received webrtc offer");
      await webrtc.setRemoteDescription(message.offer);

      const answer = await webrtc.createAnswer();
      await webrtc.setLocalDescription(answer);

      sendMessageToSignallingServer({
        channel: "webrtc_answer",
        answer,
        otherPerson,
      });
      break;

    case "webrtc_answer":
      console.log("received webrtc answer");
      await webrtc.setRemoteDescription(message.answer);
      break;

    default:
      console.log("unknown message", message);
      break;
  }
}

const webrtc = new RTCPeerConnection({
  iceServers: [
    {
      urls: [
        "stun:stun.stunprotocol.org",
      ],
    },
  ],
});

webrtc.addEventListener("icecandidate", (event) => {
  if (!event.candidate) {
    return;
  }

  sendMessageToSignallingServer({
    channel: "webrtc_ice_candidate",
    candidate: event.candidate,
    otherPerson,
  });
});

webrtc.addEventListener("track", (event) => {
  /** @type {HTMLVideoElement} */
  const remoteVideo = document.getElementById("remote-video");
  remoteVideo.srcObject = event.streams[0];
});

navigator
  .mediaDevices
  .getUserMedia({ video: true })
  .then((localStream) => {
    /** @type {HTMLVideoElement} */
    const localVideo = document.getElementById("local-video");
    localVideo.srcObject = localStream;

    for (const track of localStream.getTracks()) {
      webrtc.addTrack(track, localStream);
    }
  });

callButton.addEventListener("click", async () => {
  otherPerson = prompt("Who you gonna call?");

  showVideoCall();
  sendMessageToSignallingServer({
    channel: "start_call",
    otherPerson,
  });
});

hideVideoCall();
