# Drop

Drop is a lightning-fast, privacy-first local file transfer and clipboard synchronization web application. It utilizes a **Full Mesh WebRTC Topology** to connect multiple devices (phones, laptops, tablets) without relying on a central database, local storage, or cloud hosting.

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)

## Features

* **Decentralized P2P Connections:** Files and clips are streamed directly from device to device using raw WebRTC `RTCDataChannel`. Your data never touches a server.
* **Multi-Peer Mesh Networking:** Unlimited users can join a room simultaneously using a secure 6-digit code.
* **Multiplexed File Transfers:** Send massive files flawlessly over the local network using chunked `ArrayBuffer` streaming, integrated with WebRTC's native backpressure handling to prevent browser memory crashes.
* **Live Shared Clipboard:** Seamlessly copy and paste text links, code snippets, or notes across all your active local devices in real-time natively bridging OS clipboards.
* **Glassmorphic UI:** A deeply responsive, animated React interface (via Framer Motion) modeled after premium native OS designs.

## Architecture

The project is cleanly separated into two distinct, lightweight components:

### 1. Signaling Server (`/signaling-server`)
Acts purely as an initial handshake relay. Built on Node.js and Socket.io, its only purpose is to exchange Session Description Protocol (SDP) routing keys and ICE candidates between peers to build the mesh. Once the direct WebRTC peer-to-peer pipes are established, this server exits the data loop entirely.

### 2. Frontend Application (`/frontend`)
A Vite/React SPA driving a custom multi-channel WebRTC protocol. It orchestrates the complex `ArrayBuffer` byte streams, manages dynamic file chunking via `FileReader`, coordinates dynamic UUID queuing across nodes, and reconstructs binary `Blob` data entirely client-side.

---

## Getting Started

To run Drop locally on your network so your desktop and mobile phone can connect:

### 1. Run the Signaling Back-end
Open a terminal and navigate to the `signaling-server` directory:
```bash
cd signaling-server
npm install
npm start
```

### 2. Run the React Web App
Open a new terminal and navigate to the `frontend` directory:
```bash
cd frontend
npm install
npm run dev -- --host
```
*(The `--host` flag is crucial as it exposes the Vite development server to other devices on your local Wi-Fi network rather than locking it safely to `localhost`!)*

---

## Deployment Instructions

To release Drop to the public internet:

1. **Deploy Backend:** Host the `signaling-server` directory on Render, Railway, or Heroku. The build command is `npm install` and the start command is `node index.js`.
2. **Link Frontend:** Open `frontend/src/hooks/useWebRTC.js` and change `SIGNALING_URL` to point to your new live backend domain (e.g., `https://drop-signaling.onrender.com`).
3. **Deploy Frontend:** Connect the `frontend` directory to Vercel, Netlify, or Cloudflare Pages. The build command is `npm run build` targeting the `dist` folder.

**Important Note on Public Traversals:** WebRTC natively uses STUN servers (like Google's free servers configured in this project) to traverse basic firewalls. If deployed publicly, devices on heavily restricted corporate or cellular networks (Symmetric NATs) might fail to connect directly. In a production scenario, you would optionally provide a TURN server fallback inside the `ICE_SERVERS` config array.
