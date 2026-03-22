import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

// Automatically use the live Render backend when deployed online
const SIGNALING_URL = import.meta.env.PROD 
  ? 'https://p2p-webrtc-drop.onrender.com' 
  : `http://${window.location.hostname}:3001`;

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function useWebRTC() {
  const [roomId, setRoomId] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  
  // States
  const [connectedPeers, setConnectedPeers] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [clipboardItems, setClipboardItems] = useState([]);

  const socketRef = useRef(null);
  const peersRef = useRef({});
  const channelsRef = useRef({});
  const roomIdRef = useRef(null);
  
  const transfersRef = useRef([]);
  const receiveBufferRef = useRef({});
  const receivedSizeRef = useRef({});
  const activeSendingIdRef = useRef({});

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    transfersRef.current = transfers;
  }, [transfers]);

  const updateTransfer = useCallback((id, updates) => {
    setTransfers(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  useEffect(() => {
    socketRef.current = io(SIGNALING_URL);

    socketRef.current.on('room-created', ({ roomId }) => {
      setRoomId(roomId);
      setStatus('waiting');
    });

    socketRef.current.on('room-joined', ({ roomId }) => {
      setRoomId(roomId);
      setStatus('waiting');
    });

    socketRef.current.on('error', ({ message }) => {
      setStatus('idle');
      setError(message);
      setTimeout(() => setError(''), 5000);
    });

    socketRef.current.on('peer-joined', ({ peerId }) => {
      createPeer(peerId, true);
    });

    socketRef.current.on('signal', async ({ senderId, signalData }) => {
      try {
        if (!signalData) return;

        let peer = peersRef.current[senderId];
        if (!peer && signalData.type === 'offer') {
          peer = createPeer(senderId, false);
        }
        if (!peer) return;

        if (signalData.type === 'offer') {
          await peer.setRemoteDescription(new RTCSessionDescription(signalData));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socketRef.current.emit('signal', { targetId: senderId, signalData: peer.localDescription });
        } else if (signalData.type === 'answer') {
          await peer.setRemoteDescription(new RTCSessionDescription(signalData));
        } else if (signalData.candidate) {
          await peer.addIceCandidate(new RTCIceCandidate(signalData));
        }
      } catch (err) {
        console.error('Error handling signal from:', senderId, err);
      }
    });

    socketRef.current.on('peer-disconnected', ({ peerId }) => {
      if (peersRef.current[peerId]) peersRef.current[peerId].close();
      delete peersRef.current[peerId];
      delete channelsRef.current[peerId];
      
      setConnectedPeers(prev => {
        const next = prev.filter(id => id !== peerId);
        if (next.length === 0) setStatus('waiting');
        return next;
      });
    });

    return () => {
      socketRef.current.disconnect();
      Object.values(peersRef.current).forEach(p => p.close());
    };
  }, []);

  const createPeer = (targetPeerId, isInitiator) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[targetPeerId] = peer;

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('signal', { targetId: targetPeerId, signalData: event.candidate });
      }
    };

    if (isInitiator) {
      const channel = peer.createDataChannel('file-transfer', { ordered: true });
      setupDataChannel(channel, targetPeerId);

      peer.createOffer().then(async offer => {
        await peer.setLocalDescription(offer);
        socketRef.current.emit('signal', { targetId: targetPeerId, signalData: peer.localDescription });
      });
    } else {
      peer.ondatachannel = (event) => setupDataChannel(event.channel, targetPeerId);
    }
    return peer;
  };

  const resetAllTransferStates = () => {
    setTransfers([]);
    setClipboardItems([]);
    activeSendingIdRef.current = {};
    receiveBufferRef.current = {};
    receivedSizeRef.current = {};
  };

  const setupDataChannel = (channel, peerId) => {
    channel.binaryType = 'arraybuffer';
    
    channel.onopen = () => {
      channelsRef.current[peerId] = channel;
      setStatus('connected');
      setConnectedPeers(prev => [...new Set([...prev, peerId])]);
    };
    
    channel.onclose = () => {
      delete channelsRef.current[peerId];
      setConnectedPeers(prev => {
        const next = prev.filter(id => id !== peerId);
        if (next.length === 0) setStatus('waiting');
        return next;
      });
    };
    
    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const data = JSON.parse(event.data);
        const { id, type } = data;

        if (type === 'file-offer') {
          setTransfers(prev => {
             if (prev.some(t => t.id === id)) return prev;
             return [...prev, {
                id, isSender: false, senderId: peerId, name: data.name, size: data.size, mimeType: data.mimeType, progress: 0, status: 'waiting_accept'
             }];
          });
        } else if (type === 'file-accept') {
          updateTransfer(id, { status: 'sending' });
          startStreamingFile(id, peerId);
        } else if (type === 'file-reject') {
          updateTransfer(id, { status: 'rejected' });
        } else if (type === 'file-cancel') {
          const t = transfersRef.current.find(x => x.id === id);
          if (t && t.status === 'receiving') {
            delete receiveBufferRef.current[id];
            delete receivedSizeRef.current[id];
          }
          if (t && t.status === 'sending') {
             delete activeSendingIdRef.current[`${id}-${peerId}`];
          }
          updateTransfer(id, { status: 'cancelled' });
        } else if (type === 'clipboard-sync') {
          setClipboardItems(prev => [{ id: data.id, text: data.text, timestamp: data.timestamp, isMine: false, fromPeer: peerId }, ...prev]);
        }
      } else {
        const activeRecv = transfersRef.current.find(t => t.status === 'receiving' && t.senderId === peerId);
        if (activeRecv) {
          const tId = activeRecv.id;
          if (!receiveBufferRef.current[tId]) receiveBufferRef.current[tId] = [];
          if (!receivedSizeRef.current[tId]) receivedSizeRef.current[tId] = 0;

          receiveBufferRef.current[tId].push(event.data);
          receivedSizeRef.current[tId] += event.data.byteLength;
          
          updateTransfer(tId, { progress: (receivedSizeRef.current[tId] / activeRecv.size) * 100 });

          if (receivedSizeRef.current[tId] === activeRecv.size) {
            const blob = new Blob(receiveBufferRef.current[tId], { type: activeRecv.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = activeRecv.name;
            a.click();
            URL.revokeObjectURL(url);
            
            delete receiveBufferRef.current[tId];
            delete receivedSizeRef.current[tId];
            updateTransfer(tId, { status: 'completed' });
          }
        }
      }
    };
  };

  const createRoom = () => {
    setStatus('creating');
    setError('');
    socketRef.current.emit('create-room');
  };

  const joinRoom = (code) => {
    setStatus('joining');
    setError('');
    setRoomId(code);
    socketRef.current.emit('join-room', { roomId: code });
  };

  const addFiles = (files) => {
    if (Object.keys(channelsRef.current).length === 0) return;
    const newTransfers = Array.from(files).map(file => ({
      id: Math.random().toString(36).substring(2, 11),
      isSender: true, file, name: file.name, size: file.size, mimeType: file.type,
      progress: 0, status: 'pending'
    }));
    setTransfers(prev => [...prev, ...newTransfers]);
  };

  useEffect(() => {
    if (connectedPeers.length === 0) return;
    const isSending = transfers.some(t => t.isSender && ['offering', 'waiting_accept', 'sending'].includes(t.status));
    
    if (!isSending) {
      const nextSender = transfers.find(t => t.status === 'pending' && t.isSender);
      if (nextSender) {
        updateTransfer(nextSender.id, { status: 'offering' });
        const msg = JSON.stringify({
          type: 'file-offer', id: nextSender.id, name: nextSender.name, size: nextSender.size, mimeType: nextSender.mimeType
        });
        Object.values(channelsRef.current).forEach(c => {
           if (c.readyState === 'open') c.send(msg);
        });
      }
    }
  }, [transfers, connectedPeers, updateTransfer]);


  const acceptFile = (id) => {
    const t = transfersRef.current.find(x => x.id === id);
    if (!t) return;
    const channel = channelsRef.current[t.senderId];
    if (!channel) return;

    updateTransfer(id, { status: 'receiving', progress: 0 });
    receiveBufferRef.current[id] = [];
    receivedSizeRef.current[id] = 0;
    channel.send(JSON.stringify({ type: 'file-accept', id }));
  };

  const rejectFile = (id) => {
    const t = transfersRef.current.find(x => x.id === id);
    if (!t) return;
    updateTransfer(id, { status: 'rejected' });
    const channel = channelsRef.current[t.senderId];
    if (channel) channel.send(JSON.stringify({ type: 'file-reject', id }));
  };

  const cancelTransfer = (id) => {
    const t = transfersRef.current.find(x => x.id === id);
    if (!t) return;
    
    if (t.status === 'receiving') {
      delete receiveBufferRef.current[id];
      delete receivedSizeRef.current[id];
    }
    if (t.isSender) {
      Object.keys(activeSendingIdRef.current).forEach(key => {
         if (key.startsWith(`${id}-`)) delete activeSendingIdRef.current[key];
      });
    }
    
    updateTransfer(id, { status: 'cancelled' });

    const msg = JSON.stringify({ type: 'file-cancel', id });
    if (t.isSender) {
       Object.values(channelsRef.current).forEach(c => {
          if (c.readyState === 'open') c.send(msg);
       });
    } else if (channelsRef.current[t.senderId]) {
       channelsRef.current[t.senderId].send(msg);
    }
  };

  const startStreamingFile = (id, targetPeerId) => {
    const t = transfersRef.current.find(x => x.id === id);
    const channel = channelsRef.current[targetPeerId];
    if (!t || !t.file || !channel) return;

    updateTransfer(id, { progress: 0 });
    const streamId = `${id}-${targetPeerId}`;
    activeSendingIdRef.current[streamId] = true;

    const chunkSize = 64 * 1024;
    let offset = 0;

    channel.bufferedAmountLowThreshold = 1024 * 1024;

    const readLoop = () => {
      if (!activeSendingIdRef.current[streamId]) return; 
      
      if (offset >= t.size) {
        setTimeout(() => {
            if (activeSendingIdRef.current[streamId]) delete activeSendingIdRef.current[streamId];
            updateTransfer(id, { status: 'completed' });
        }, 1000); 
        return;
      }

      if (channel.bufferedAmount > 1024 * 1024 * 4) {
        channel.onbufferedamountlow = () => {
          channel.onbufferedamountlow = null;
          readLoop();
        };
        return;
      }

      const slice = t.file.slice(offset, offset + chunkSize);
      slice.arrayBuffer().then(buffer => {
        if (!activeSendingIdRef.current[streamId]) return;
        channel.send(buffer);
        offset += buffer.byteLength;
        updateTransfer(id, { progress: (offset / t.size) * 100 });
        readLoop();
      });
    };

    readLoop();
  };

  const sendClipboardText = (text) => {
    if (!text.trim()) return;
    const item = { id: Math.random().toString(36).substring(2, 9), text, timestamp: Date.now() };
    const msg = JSON.stringify({ type: 'clipboard-sync', ...item });
    
    Object.values(channelsRef.current).forEach(c => {
       if (c.readyState === 'open') c.send(msg);
    });
    setClipboardItems(prev => [{ ...item, isMine: true }, ...prev]);
  };

  const reset = () => {
    Object.values(peersRef.current).forEach(p => p.close());
    peersRef.current = {};
    channelsRef.current = {};
    socketRef.current.disconnect(); 
    socketRef.current.connect(); 
    setRoomId(null);
    setConnectedPeers([]);
    setStatus('idle');
    setError('');
    resetAllTransferStates();
  };

  // Handle Autojoin URL - Must be defined AFTER joinRoom
  useEffect(() => {
    // Only attempt autojoin if we are in idle state
    if (status !== 'idle') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');

    if (roomFromUrl && roomFromUrl.length === 6) {
       const joinWhenConnected = () => {
         if (socketRef.current?.connected) {
           joinRoom(roomFromUrl);
         } else {
           socketRef.current?.once('connect', () => joinRoom(roomFromUrl));
         }
       };
       joinWhenConnected();
    }
  }, [status]); // Only depend on status as joinRoom is stable

  return { 
    status, error, roomId, connectedPeers, transfers, clipboardItems,
    createRoom, joinRoom, addFiles, acceptFile, rejectFile, cancelTransfer, sendClipboardText, reset 
  };
}
