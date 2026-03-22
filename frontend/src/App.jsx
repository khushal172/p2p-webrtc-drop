import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebRTC } from './hooks/useWebRTC';
import { 
  Send, Download, Users, File as FileIcon, ArrowLeft, Check, X, 
  FileCheck, FileX, Clipboard, Copy, QrCode, Shield, Zap, Globe 
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

function App() {
  const { 
    status, error, roomId, connectedPeers, transfers, clipboardItems,
    createRoom, joinRoom, addFiles, acceptFile, rejectFile, cancelTransfer, sendClipboardText, reset 
  } = useWebRTC();
  
  const [joinCode, setJoinCode] = useState('');
  const [activeTab, setActiveTab] = useState('files'); // 'files' | 'clipboard'
  const [clipInput, setClipInput] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrBaseOverride, setQrBaseOverride] = useState('');
  const [isEditingHost, setIsEditingHost] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  };

  const handleSendClip = () => {
    if (clipInput.trim()) {
      sendClipboardText(clipInput);
      setClipInput('');
    }
  };

  const handlePasteAndSend = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) sendClipboardText(text);
    } catch (err) {
      console.error('Failed to read clipboard', err);
      alert('Could not read local clipboard. Please paste manually into the input box.');
    }
  };

  const renderTransferItem = (t) => {
    const isReceiving = t.status === 'receiving';
    const isSending = t.status === 'sending';
    const isWaitingMe = !t.isSender && t.status === 'waiting_accept';
    const isWaitingPeer = t.isSender && t.status === 'offering';
    const isCompleted = t.status === 'completed';
    const isError = t.status === 'rejected' || t.status === 'cancelled';
    const isPending = t.status === 'pending';
    
    let bg = 'rgba(255,255,255,0.05)';
    let border = '1px solid var(--glass-border)';
    
    if (isReceiving) { bg = 'rgba(46,160,67,0.1)'; border = '1px solid rgba(46,160,67,0.3)'; }
    if (isSending) { bg = 'rgba(88,166,255,0.1)'; border = '1px solid rgba(88,166,255,0.3)'; }
    if (isError) { bg = 'rgba(248,81,73,0.1)'; border = '1px solid rgba(248,81,73,0.3)'; }

    return (
      <motion.div 
        key={t.id}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: bg, border: border, padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%', fontWeight: (isReceiving||isSending) ? 600 : 400 }}>
            <span style={{color: '#8b949e', fontSize: '0.8rem'}}>{t.isSender ? 'Sending: ' : 'Receiving: '}</span> {t.name}
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isWaitingPeer && <span style={{ fontSize: '0.8rem', color: '#8b949e' }}>Waiting...</span>}
            {isPending && <span style={{ fontSize: '0.8rem', color: '#8b949e' }}>Queued</span>}
            {(isReceiving || isSending) && <span style={{ fontSize: '0.85rem' }}>{Math.round(t.progress)}%</span>}
            {isCompleted && <FileCheck size={16} color="var(--success)" />}
            {isError && <FileX size={16} color="var(--error)" />}
            
            {(isReceiving || isSending || isPending || isWaitingPeer) && (
              <button onClick={() => cancelTransfer(t.id)} title="Cancel" style={{ background:'none', border:'none', cursor:'pointer', color: 'var(--error)' }}>
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {isWaitingMe && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button className="btn" style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', borderColor: 'var(--error)', color: 'var(--error)', background: 'transparent' }} onClick={() => rejectFile(t.id)}>Reject</button>
            <button className="btn primary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }} onClick={() => acceptFile(t.id)}>Accept</button>
          </div>
        )}

        {(isReceiving || isSending) && (
          <div style={{ width: '100%', background: 'rgba(0,0,0,0.5)', height: '4px', borderRadius: '2px', overflow: 'hidden', marginTop: '0.25rem' }}>
            <div style={{ height: '100%', background: isReceiving ? 'var(--success)' : 'var(--primary)', width: `${t.progress}%`, transition: 'width 0.1s' }} />
          </div>
        )}
        
        {isError && (
          <p style={{ color: 'var(--error)', fontSize: '0.8rem', margin: 0, marginTop: '0.25rem' }}>Transfer {t.status}</p>
        )}
      </motion.div>
    );
  };

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      {/* Header (Floating) */}
      <nav style={{ width: '100%', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={reset}>
          <div style={{ width: '32px', height: '32px', background: 'var(--primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={18} color="#0d1117" />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>P2P Drop</span>
        </div>
        
        {status !== 'idle' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {status === 'connected' && <div className="status-badge"><Users size={14} /> {connectedPeers.length} Live</div>}
            <button onClick={reset} className="btn" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <ArrowLeft size={16} /> Exit
            </button>
          </div>
        )}
      </nav>

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div 
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5rem', padding: '4rem 1rem' }}
          >
            {/* Hero Section */}
            <header style={{ textAlign: 'center', maxWidth: '800px' }}>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', fontWeight: 850, marginBottom: '1.5rem', lineHeight: 1, letterSpacing: '-0.04em', color: '#fff' }}>
                  Share files <span style={{ background: 'linear-gradient(90deg, #58a6ff, #A371F7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>privately</span>,<br/> without the cloud.
                </h1>
                <p style={{ fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', color: '#8b949e', lineHeight: 1.6, marginBottom: '3.5rem', maxWidth: '650px', margin: '0 auto 3.5rem' }}>
                  No servers. No tracking. Just direct, browser-to-browser 
                  transfer powered by WebRTC. Safe, instant, and free.
                </p>
              </motion.div>

              {/* Primary Call to Action Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', width: '100%', maxWidth: '900px', margin: '0 auto' }}>
                <motion.div 
                  initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                  whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(88,166,255,0.1)' }}
                  className="glass-card" 
                  style={{ textAlign: 'left', cursor: 'default', height: '100%', border: '1px solid rgba(88, 166, 255, 0.2)', padding: '2.5rem' }}
                >
                  <div style={{ width: '56px', height: '56px', background: 'rgba(88, 166, 255, 0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <Users size={28} color="var(--primary)" />
                  </div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Host a Transfer</h3>
                  <p style={{ color: '#8b949e', fontSize: '0.95rem', marginBottom: '2.5rem', lineHeight: 1.5 }}>
                    Open a temporary secure tunnel. Anyone with your 6-digit code or QR can connect instantly.
                  </p>
                  <button className="btn primary" onClick={createRoom} style={{ width: '100%', padding: '1.25rem' }}>
                    Create Secure Tunnel
                  </button>
                </motion.div>

                <motion.div 
                  initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.4 }}
                  whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(163,113,247,0.1)' }}
                  className="glass-card" 
                  style={{ textAlign: 'left', cursor: 'default', height: '100%', border: '1px solid rgba(163, 113, 247, 0.2)', padding: '2.5rem' }}
                >
                  <div style={{ width: '56px', height: '56px', background: 'rgba(163, 113, 247, 0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <QrCode size={28} color="#A371F7" />
                  </div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Join a Peer</h3>
                  <p style={{ color: '#8b949e', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.5 }}>
                    Received a code? Enter it below to establish a direct connection and start exchanging.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input 
                      type="text" 
                      placeholder="CODE" 
                      value={joinCode} 
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      style={{ letterSpacing: '0.4em', textAlign: 'center', fontSize: '1.1rem' }}
                    />
                    <button className="btn" onClick={() => joinRoom(joinCode)} disabled={joinCode.length !== 6} style={{ padding: '0 1.25rem' }}>
                      <ArrowLeft style={{ transform: 'rotate(180deg)' }} />
                    </button>
                  </div>
                </motion.div>
              </div>
            </header>

            {/* Feature Highlights Grid */}
            <section style={{ width: '100%', maxWidth: '1000px', padding: '0 1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '4rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ background: 'rgba(46,160,67,0.1)', color: 'var(--success)', padding: '1rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
                    <Shield size={24} />
                  </div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>E2E Encrypted</h4>
                  <p style={{ color: '#8b949e', fontSize: '0.9rem', lineHeight: 1.5 }}>Your hardware, your browser, your encryption keys. No central authority is involved.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ background: 'rgba(163,113,247,0.1)', color: '#A371F7', padding: '1rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
                    <Zap size={24} />
                  </div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Instant Velocity</h4>
                  <p style={{ color: '#8b949e', fontSize: '0.9rem', lineHeight: 1.5 }}>Powered by WebRTC, transfers happen at your maximum network speed without proxy bottlenecks.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ background: 'rgba(88,166,255,0.1)', color: 'var(--primary)', padding: '1rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
                    <Globe size={24} />
                  </div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Cross-Platform</h4>
                  <p style={{ color: '#8b949e', fontSize: '0.9rem', lineHeight: 1.5 }}>Works on phone, tablet, and desktop. If it runs a browser, it's a P2P node.</p>
                </div>
              </div>
            </section>

            <footer style={{ marginTop: '2rem', color: '#484f58', fontSize: '0.85rem' }}>
              Built with privacy-first principles. NO DATA IS STORED ON ANY SERVER.
            </footer>
          </motion.div>
        )}

        {(status === 'creating' || status === 'joining') && (
          <motion.div 
            key="loader"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card"
            style={{ marginTop: '15vh', maxWidth: '400px' }}
          >
            <div style={{ textAlign: 'center', padding: '2.5rem' }}>
              <div className="loader" style={{ width: '48px', height: '48px', margin: '0 auto 2rem', borderWidth: '4px' }}></div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                {status === 'creating' ? 'Creating Tunnel...' : 'Seeking Peer...'}
              </h2>
              <p style={{ color: '#8b949e', fontSize: '0.95rem' }}>Handshaking protocols and establishing P2P data channel.</p>
            </div>
          </motion.div>
        )}

        {status === 'waiting' && roomId && (
          <motion.div 
            key="waiting"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card"
            style={{ marginTop: '5vh', maxWidth: '480px', padding: '2.5rem' }}
          >
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#8b949e', marginBottom: '1.5rem', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.1em' }}>SEND THIS LINK TO PEER</p>
              
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', display: 'inline-block', marginBottom: '2rem', boxShadow: '0 12px 48px rgba(0,0,0,0.5)' }}>
                <QRCodeCanvas 
                  value={`${qrBaseOverride ? (qrBaseOverride.startsWith('http') ? qrBaseOverride : `http://${qrBaseOverride}`) : window.location.origin}${window.location.pathname}?room=${roomId}`}
                  size={200}
                  level="H"
                />
              </div>

              {window.location.hostname === 'localhost' && !qrBaseOverride && (
                <div style={{ background: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.2)', padding: '0.75rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                   <X size={16} color="#ff9800" style={{ transform: 'rotate(45deg)' }} />
                   <div style={{ textAlign: 'left' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ff9800', margin: 0 }}>On Localhost?</p>
                      <p style={{ fontSize: '0.7rem', color: '#ff9800', opacity: 0.8, margin: 0 }}>Use Network IP for mobile testing.</p>
                   </div>
                   <button onClick={() => setIsEditingHost(true)} style={{ marginLeft: 'auto', background: 'rgba(255,152,0,0.2)', color: '#ff9800', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>EDIT</button>
                </div>
              )}

              {isEditingHost && (
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                  <input 
                    value={qrBaseOverride} 
                    onChange={(e) => setQrBaseOverride(e.target.value)} 
                    placeholder="e.g. 192.168.1.5:5173" 
                    style={{ fontSize: '0.85rem', padding: '0.6rem', textAlign: 'left', letterSpacing: 'normal' }}
                  />
                  <button className="btn primary" style={{ padding: '0.6rem 1rem' }} onClick={() => setIsEditingHost(false)}>Save</button>
                </div>
              )}

              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '3rem', letterSpacing: '0.3em', margin: 0, fontWeight: 900, color: 'var(--primary)', fontFamily: 'monospace' }}>{roomId}</h2>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#8b949e', marginTop: '0.5rem' }}>
                  <div className="loader" style={{ width: 12, height: 12, borderWidth: 2 }} />
                  <span style={{ fontSize: '0.9rem' }}>Awaiting peer connection...</span>
                </div>
              </div>

              <button 
                className="btn" 
                style={{ width: '100%', gap: '0.75rem' }} 
                onClick={() => {
                  const base = qrBaseOverride ? (qrBaseOverride.startsWith('http') ? qrBaseOverride : `http://${qrBaseOverride}`) : window.location.origin;
                  navigator.clipboard.writeText(`${base}${window.location.pathname}?room=${roomId}`);
                  alert("Link copied!");
                }}
              >
                <Copy size={18} /> Copy Invite Link
              </button>
            </div>
          </motion.div>
        )}

        {status === 'connected' && (
          <motion.div 
            key="connected"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card"
            style={{ maxWidth: '600px', width: '100%', padding: '2rem', marginTop: '5vh' }}
          >
            <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.35rem', borderRadius: '16px', marginBottom: '1.5rem' }}>
              <button 
                className="btn" 
                style={{ flex: 1, background: activeTab === 'files' ? 'var(--primary)' : 'transparent', color: activeTab === 'files' ? '#0d1117' : 'white', border: 'none', borderRadius: '12px' }}
                onClick={() => setActiveTab('files')}
              >
                <FileIcon size={18} /> Files
              </button>
              <button 
                className="btn" 
                style={{ flex: 1, background: activeTab === 'clipboard' ? 'var(--primary)' : 'transparent', color: activeTab === 'clipboard' ? '#0d1117' : 'white', border: 'none', borderRadius: '12px' }}
                onClick={() => setActiveTab('clipboard')}
              >
                <Clipboard size={18} /> Clipboard
              </button>
              <button 
                className="btn" 
                onClick={() => setShowQRModal(true)} 
                style={{ width: '48px', padding: 0, background: 'rgba(255,255,255,0.05)', border: 'none', color: '#8b949e', borderRadius: '12px' }}
              >
                <QrCode size={18} />
              </button>
            </div>

            <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {activeTab === 'files' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <button className="btn primary" onClick={() => fileInputRef.current?.click()} style={{ padding: '1.25rem', width: '100%' }}>
                    <Download size={20} style={{ transform: 'rotate(180deg)' }} /> Select Files
                  </button>
                  <input type="file" multiple onChange={handleFileSelect} ref={fileInputRef} style={{ display: 'none' }} />
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {transfers.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--glass-border)', borderRadius: '16px' }}>
                        <p style={{ color: '#8b949e', fontSize: '0.95rem' }}>No files shared yet in this session.</p>
                      </div>
                    ) : (
                      transfers.map(renderTransferItem)
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <textarea 
                      placeholder="Share notes or links..." 
                      value={clipInput} 
                      onChange={(e) => setClipInput(e.target.value)}
                      style={{ minHeight: '100px', textAlign: 'left', letterSpacing: 'normal', fontWeight: 'normal', borderRadius: '12px' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn" onClick={handlePasteAndSend} style={{ flex: 1 }}><Clipboard size={18} /> Paste Local</button>
                      <button className="btn primary" onClick={handleSendClip} disabled={!clipInput.trim()} style={{ flex: 1.5 }}>Send Peer</button>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {clipboardItems.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--glass-border)', borderRadius: '16px' }}>
                        <p style={{ color: '#8b949e', fontSize: '0.95rem' }}>Shared clipboard history will appear here.</p>
                      </div>
                    ) : (
                      clipboardItems.map(item => (
                        <div key={item.id} className="glass-card" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.05)', gap: '0.75rem', width: '100%', maxWidth: 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#8b949e' }}>
                            <span style={{ fontWeight: 600 }}>{item.isMine ? 'YOU' : `PEER (${item.fromPeer.slice(0, 4)})`}</span>
                            <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p style={{ wordBreak: 'break-all', fontSize: '0.95rem', lineHeight: 1.5, color: '#e6edf3' }}>{item.text}</p>
                          <button 
                            className="btn" 
                            onClick={() => { navigator.clipboard.writeText(item.text); alert('Copied!'); }} 
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', width: 'fit-content', border: 'none', background: 'rgba(88,166,255,0.1)', color: 'var(--primary)' }}
                          >
                            <Copy size={14} /> Copy to Clipboard
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shared Modal Overlay */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={() => setShowQRModal(false)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 30 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.9, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card"
              style={{ maxWidth: '380px', width: '100%', textAlign: 'center', padding: '2.5rem', gap: '2rem' }}
            >
              <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-end', marginBottom: '-2.5rem' }}>
                <button onClick={() => setShowQRModal(false)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer' }}><X size={24} /></button>
              </div>
              
              <div>
                <p style={{ color: '#8b949e', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '1.5rem' }}>INVITE ANOTHER PEER</p>
                <div style={{ background: 'white', padding: '1rem', borderRadius: '16px', display: 'inline-block' }}>
                  <QRCodeCanvas 
                    value={`${qrBaseOverride ? (qrBaseOverride.startsWith('http') ? qrBaseOverride : `http://${qrBaseOverride}`) : window.location.origin}${window.location.pathname}?room=${roomId}`}
                    size={220}
                    level="H"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '2.5rem', letterSpacing: '0.25em', margin: 0, fontWeight: 900, color: 'var(--primary)', fontFamily: 'monospace' }}>{roomId}</h2>
                <p style={{ color: '#8b949e', fontSize: '0.9rem' }}>Direct room code</p>
              </div>

              <button 
                className="btn primary" 
                style={{ width: '100%', padding: '1.25rem' }} 
                onClick={() => {
                  const base = qrBaseOverride ? (qrBaseOverride.startsWith('http') ? qrBaseOverride : `http://${qrBaseOverride}`) : window.location.origin;
                  navigator.clipboard.writeText(`${base}${window.location.pathname}?room=${roomId}`);
                  alert("Link copied!");
                }}
              >
                Copy Invite Link
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
