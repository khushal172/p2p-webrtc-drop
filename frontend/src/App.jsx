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
      <nav style={{ width: '100%', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem', position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={reset}>
          <div style={{ width: '32px', height: '32px', background: 'var(--primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={18} color="#0d1117" />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>P2P Drop</span>
        </div>
        
        {status !== 'idle' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {status === 'connected' && <div className="status-badge" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}><Users size={12} /> {connectedPeers.length}</div>}
            <button onClick={reset} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
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
            className="landing-container"
          >
            {/* Hero Section */}
            <header style={{ textAlign: 'center', maxWidth: '800px', width: '100%' }}>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <h1 className="hero-title">
                  Share files <span style={{ background: 'linear-gradient(90deg, #58a6ff, #A371F7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>privately</span>,<br/> without the cloud.
                </h1>
                <p className="hero-subtitle">
                  No servers. No tracking. Just direct, browser-to-browser 
                  transfer powered by WebRTC. Safe, instant, and free.
                </p>
              </motion.div>

              {/* Primary Call to Action Cards */}
              <div className="action-grid">
                <motion.div 
                  initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                  whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(88,166,255,0.1)' }}
                  className="glass-card" 
                  style={{ textAlign: 'left', cursor: 'default', height: '100%', border: '1px solid rgba(88, 166, 255, 0.2)' }}
                >
                  <div style={{ width: '48px', height: '48px', background: 'rgba(88, 166, 255, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                    <Users size={24} color="var(--primary)" />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Host a Transfer</h3>
                  <p style={{ color: '#8b949e', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: 1.5 }}>
                    Open a temporary secure tunnel. Anyone with your 6-digit code or QR can connect instantly.
                  </p>
                  <button className="btn primary" onClick={createRoom} style={{ width: '100%', padding: '1rem' }}>
                    Create Secure Tunnel
                  </button>
                </motion.div>

                <motion.div 
                  initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.4 }}
                  whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(163,113,247,0.1)' }}
                  className="glass-card" 
                  style={{ textAlign: 'left', cursor: 'default', height: '100%', border: '1px solid rgba(163, 113, 247, 0.2)' }}
                >
                  <div style={{ width: '48px', height: '48px', background: 'rgba(163, 113, 247, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                    <QrCode size={24} color="#A371F7" />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Join a Peer</h3>
                  <p style={{ color: '#8b949e', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                    Received a code? Enter it below to establish a direct connection and start exchanging.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="text" 
                      placeholder="CODE" 
                      value={joinCode} 
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1rem', padding: '0.75rem' }}
                    />
                    <button className="btn" onClick={() => joinRoom(joinCode)} disabled={joinCode.length !== 6} style={{ padding: '0 1rem' }}>
                      <ArrowLeft style={{ transform: 'rotate(180deg)' }} />
                    </button>
                  </div>
                </motion.div>
              </div>
            </header>

            {/* Feature Highlights Grid */}
            <section className="feature-highlights">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ background: 'rgba(46,160,67,0.1)', color: 'var(--success)', padding: '0.75rem', borderRadius: '50%', marginBottom: '1rem' }}>
                  <Shield size={20} />
                </div>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>E2E Encrypted</h4>
                <p style={{ color: '#8b949e', fontSize: '0.85rem', lineHeight: 1.5 }}>Direct browser-to-browser encryption. One-to-one.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ background: 'rgba(163,113,247,0.1)', color: '#A371F7', padding: '0.75rem', borderRadius: '50%', marginBottom: '1rem' }}>
                  <Zap size={20} />
                </div>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Instant Velocity</h4>
                <p style={{ color: '#8b949e', fontSize: '0.85rem', lineHeight: 1.5 }}>Direct WebRTC speed. No proxy bottlenecks.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ background: 'rgba(88,166,255,0.1)', color: 'var(--primary)', padding: '0.75rem', borderRadius: '50%', marginBottom: '1rem' }}>
                  <Globe size={20} />
                </div>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Cross-Platform</h4>
                <p style={{ color: '#8b949e', fontSize: '0.85rem', lineHeight: 1.5 }}>Works on mobile, tablet, and desktop browsers.</p>
              </div>
            </section>

            <footer style={{ marginTop: '1rem', color: '#484f58', fontSize: '0.75rem', textAlign: 'center' }}>
              Built with privacy-first principles. <br/> NO DATA IS STORED ON ANY SERVER.
            </footer>
          </motion.div>
        )}

        {(status === 'creating' || status === 'joining') && (
          <motion.div 
            key="loader"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 1, scale: 0.95 }}
            className="glass-card"
            style={{ marginTop: '10vh', maxWidth: '400px' }}
          >
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="loader" style={{ width: '40px', height: '40px', margin: '0 auto 1.5rem', borderWidth: '3px' }}></div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                {status === 'creating' ? 'Creating Tunnel...' : 'Seeking Peer...'}
              </h2>
              <p style={{ color: '#8b949e', fontSize: '0.85rem' }}>Establishing secure data channel.</p>
            </div>
          </motion.div>
        )}

        {status === 'waiting' && roomId && (
          <motion.div 
            key="waiting"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card"
            style={{ marginTop: '2vh', maxWidth: '480px' }}
          >
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#8b949e', marginBottom: '1rem', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em' }}>SHARE THIS SESSION</p>
              
              <div style={{ background: 'white', padding: '1rem', borderRadius: '20px', display: 'inline-block', marginBottom: '1.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                <QRCodeCanvas 
                  value={`${qrBaseOverride ? (qrBaseOverride.startsWith('http') ? qrBaseOverride : `http://${qrBaseOverride}`) : window.location.origin}${window.location.pathname}?room=${roomId}`}
                  size={180}
                  level="H"
                />
              </div>

              {window.location.hostname === 'localhost' && !qrBaseOverride && (
                <div style={{ background: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.2)', padding: '0.6rem', borderRadius: '12px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <X size={14} color="#ff9800" style={{ transform: 'rotate(45deg)' }} />
                   <p style={{ fontSize: '0.7rem', color: '#ff9800', margin: 0, textAlign: 'left' }}>
                      <strong>Host Override</strong> needed for mobile test.
                   </p>
                   <button onClick={() => setIsEditingHost(true)} style={{ marginLeft: 'auto', background: 'rgba(255,152,0,0.2)', color: '#ff9800', border: 'none', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>EDIT</button>
                </div>
              )}

              {isEditingHost && (
                <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.4rem' }}>
                  <input 
                    value={qrBaseOverride} 
                    onChange={(e) => setQrBaseOverride(e.target.value)} 
                    placeholder="e.g. 192.168.1.5:5173" 
                    style={{ fontSize: '0.8rem', padding: '0.5rem', textAlign: 'left', letterSpacing: 'normal' }}
                  />
                  <button className="btn primary" style={{ padding: '0.5rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setIsEditingHost(false)}>Save</button>
                </div>
              )}

              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '2.5rem', letterSpacing: '0.25em', margin: 0, fontWeight: 900, color: 'var(--primary)', fontFamily: 'monospace' }}>{roomId}</h2>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#8b949e', marginTop: '0.4rem' }}>
                  <div className="loader" style={{ width: 10, height: 10, borderWidth: 2 }} />
                  <span style={{ fontSize: '0.8rem' }}>Waiting for connection...</span>
                </div>
              </div>

              <button 
                className="btn" 
                style={{ width: '100%', gap: '0.5rem', padding: '0.8rem' }} 
                onClick={() => {
                  const base = qrBaseOverride ? (qrBaseOverride.startsWith('http') ? qrBaseOverride : `http://${qrBaseOverride}`) : window.location.origin;
                  navigator.clipboard.writeText(`${base}${window.location.pathname}?room=${roomId}`);
                  alert("Link copied!");
                }}
              >
                <Copy size={16} /> Copy Invite Link
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
            style={{ marginTop: '2vh' }}
          >
            <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(0,0,0,0.2)', padding: '0.3rem', borderRadius: '14px', marginBottom: '1rem' }}>
              <button 
                className="btn" 
                style={{ flex: 1, background: activeTab === 'files' ? 'var(--primary)' : 'transparent', color: activeTab === 'files' ? '#0d1117' : 'white', border: 'none', borderRadius: '10px', padding: '0.6rem', fontSize: '0.9rem' }}
                onClick={() => setActiveTab('files')}
              >
                <FileIcon size={16} /> Files
              </button>
              <button 
                className="btn" 
                style={{ flex: 1, background: activeTab === 'clipboard' ? 'var(--primary)' : 'transparent', color: activeTab === 'clipboard' ? '#0d1117' : 'white', border: 'none', borderRadius: '10px', padding: '0.6rem', fontSize: '0.9rem' }}
                onClick={() => setActiveTab('clipboard')}
              >
                <Clipboard size={16} /> Clip
              </button>
              <button 
                className="btn" 
                onClick={() => setShowQRModal(true)} 
                style={{ width: '40px', padding: 0, background: 'rgba(255,255,255,0.05)', border: 'none', color: '#8b949e', borderRadius: '10px' }}
              >
                <QrCode size={16} />
              </button>
            </div>

            <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '0.4rem' }}>
              {activeTab === 'files' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <button className="btn primary" onClick={() => fileInputRef.current?.click()} style={{ padding: '0.8rem', width: '100%', fontSize: '0.95rem' }}>
                    <Download size={18} style={{ transform: 'rotate(180deg)' }} /> Select Files
                  </button>
                  <input type="file" multiple onChange={handleFileSelect} ref={fileInputRef} style={{ display: 'none' }} />
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {transfers.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--glass-border)', borderRadius: '14px' }}>
                        <p style={{ color: '#8b949e', fontSize: '0.85rem' }}>No files shared yet.</p>
                      </div>
                    ) : (
                      transfers.map(renderTransferItem)
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <textarea 
                      placeholder="Share notes..." 
                      value={clipInput} 
                      onChange={(e) => setClipInput(e.target.value)}
                      style={{ minHeight: '80px', textAlign: 'left', letterSpacing: 'normal', fontWeight: 'normal', borderRadius: '10px', fontSize: '0.9rem', padding: '0.75rem' }}
                    />
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn" onClick={handlePasteAndSend} style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }}><Clipboard size={16} /> Paste</button>
                      <button className="btn primary" onClick={handleSendClip} disabled={!clipInput.trim()} style={{ flex: 1.5, padding: '0.6rem', fontSize: '0.85rem' }}>Send Peer</button>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {clipboardItems.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--glass-border)', borderRadius: '14px' }}>
                        <p style={{ color: '#8b949e', fontSize: '0.85rem' }}>Shared clipboard history.</p>
                      </div>
                    ) : (
                      clipboardItems.map(item => (
                        <div key={item.id} className="glass-card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', gap: '0.6rem', width: '100%', maxWidth: 'none', borderRadius: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: '#8b949e' }}>
                            <span style={{ fontWeight: 600 }}>{item.isMine ? 'YOU' : `PEER`}</span>
                            <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p style={{ wordBreak: 'break-all', fontSize: '0.9rem', lineHeight: 1.4, color: '#e6edf3' }}>{item.text}</p>
                          <button 
                            className="btn" 
                            onClick={() => { navigator.clipboard.writeText(item.text); alert('Copied!'); }} 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', width: 'fit-content', border: 'none', background: 'rgba(88,166,255,0.1)', color: 'var(--primary)' }}
                          >
                            <Copy size={12} /> Copy
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {error && <div className="status-badge error" style={{ width: '100%', textAlign: 'center', marginTop: '1rem', fontSize: '0.75rem' }}>{error}</div>}
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
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 30 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.9, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card"
              style={{ maxWidth: '360px', width: '100%', textAlign: 'center', padding: '2rem', gap: '1.5rem' }}
            >
              <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-end', marginBottom: '-2rem' }}>
                <button onClick={() => setShowQRModal(false)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              
              <div>
                <p style={{ color: '#8b949e', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '1rem' }}>INVITE PEER</p>
                <div style={{ background: 'white', padding: '0.75rem', borderRadius: '16px', display: 'inline-block' }}>
                  <QRCodeCanvas 
                    value={`${qrBaseOverride ? (qrBaseOverride.startsWith('http') ? qrBaseOverride : `http://${qrBaseOverride}`) : window.location.origin}${window.location.pathname}?room=${roomId}`}
                    size={200}
                    level="H"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <h2 style={{ fontSize: '2rem', letterSpacing: '0.2em', margin: 0, fontWeight: 900, color: 'var(--primary)', fontFamily: 'monospace' }}>{roomId}</h2>
                <p style={{ color: '#8b949e', fontSize: '0.8rem' }}>Direct room code</p>
              </div>

              <button 
                className="btn primary" 
                style={{ width: '100%', padding: '1rem' }} 
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
