# Advanced Networking Features Blueprint

This document outlines an architectural roadmap for transforming Drop from a functional local P2P application into an enterprise-grade Distributed Systems protocol.

## 1. Swarm / Torrent-Style Mesh Seeding (BitTorrent Protocol)
**The Challenge:** Currently, broadcasting to N peers means the original sender's upload bandwidth is blindly divided by N, causing massive bottlenecks on the host network.
**The Implementation:** Build a *Swarm Protocol*. When the Host sends Chunk #1 to Peer A, Peer A caches it and immediately forwards Chunk #1 to Peer B over their explicit 1:1 `RTCDataChannel`. 
**Concepts Demonstrated:** Distributed Hash Tables (DHT), Gossip Protocols, Bandwidth multiplexing, Sub-mesh routing calculations.

## 2. File Resumption via Merkle Trees
**The Challenge:** If a 5GB file transfer breaks at 95% due to a sudden Wi-Fi drop, the receiving user is forced to restart the entire stream from 0%.
**The Implementation:** Pre-chunk files into 1MB static blobs and calculate a SHA-256 hash for every boundary, actively generating a Merkle Tree. On reconnection, peers instantly exchange binary "Bitmaps" of successfully saved chunks and exclusively request missing payload indices over the control channel. 
**Concepts Demonstrated:** Data structural hashing, Fault tolerance, Network state recovery, Checksum integrity.

## 3. Application-Layer End-to-End Encryption (E2EE)
**The Challenge:** While strictly true that WebRTC streams are DTLS encrypted natively by the browser, true privacy advocates require Application-Layer zero-trust so that not even an injected browser extension or compromised Signaling Server could theoretically spoof or read packets.
**The Implementation:** Implement the *Signal Protocol* (or the Double Ratchet algorithm). Generate Elliptic Curve (ECDH) keypairs mathematically via the Web Crypto API *before* users join the room. Exchange public keys via the Node.js server, derive a local AES-GCM shared secret, and perform zero-knowledge symmetric chunk encryption before raw bytes are ever passed into the WebRTC stack.
**Concepts Demonstrated:** Applied Cryptography, Asymmetric Key Exchange (Diffie-Hellman), Zero-Trust Systems Architecture.

## 4. Custom Coturn/TURN Server Deployment (Symmetric NAT Traversal)
**The Challenge:** The current iteration delegates signaling correctly, but relies on Google's free STUN servers. If two peers attempt to pair across strict corporate firewalls, university WiFis, or certain 5G telecom towers (Symmetric NATs), direct peer-to-peer UDP punch-through will irreversibly fail.
**The Implementation:** Deploy a custom Linux Coturn wrapper. Program the React application layer to detect deep `iceConnectionState === 'failed'` lifecycle events dynamically, cleanly capture the failure exception without user involvement, and securely restructure the underlying data streams to route entirely over your dedicated TCP/Relayed Coturn fallback instance.
**Concepts Demonstrated:** Network Address Translation (NAT) Routing, STUN/TURN/ICE architecture, TCP vs UDP fallbacks, Application-Layer Gateway engineering.

## 5. Seamless "No-Code" Discovery (Local IP Sweeping / mDNS)
**The Challenge:** Users currently have to vocalize or text a 6-digit room code to initiate the handshake, breaking the fluidity of Apple's AirDrop workflow.
**The Implementation:** Execute a local network broadcast ping mechanism or construct a lightweight Go/Rust background daemon dynamically bound to local WebSockets. When the user navigates to the app, transparently broadcast mDNS (Multicast DNS) discovery packets on the subnet mask so devices on the exact same internal Wi-Fi node instantly pair without any manual code handshake entry.
**Concepts Demonstrated:** OSI Layer subnet masking, mDNS/Bonjour protocols, WebSockets interception, Zero-Configuration Networking (ZeroConf).
