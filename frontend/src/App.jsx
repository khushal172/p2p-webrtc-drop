import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebRTC } from './hooks/useWebRTC';

import { Send, Download, Users, File as FileIcon, ArrowLeft, Check, X, FileCheck, FileX, Clipboard, Copy, QrCode } from 'lucide-react';
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
    <div className="glass-card" style={{ width: '100%', maxWidth: '480px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 className="title" style={{ margin: 0 }}>Drop</h1>
        {status !== 'idle' && (
          <button onClick={reset} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer' }}>
            <ArrowLeft size={20} />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <p className="subtitle">Peer-to-peer secure file transfer.</p>
            <button className="btn primary" onClick={createRoom}><Send size={18} /> Host a Transfer</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.5rem 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
              <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="000000" maxLength={6} />
              <button className="btn" onClick={() => joinRoom(joinCode)} disabled={joinCode.length < 6}><Download size={18} /> Join</button>
            </div>
          </motion.div>
        )}

        {(status === 'creating' || status === 'joining') && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
            <div className="loader" />
            <p>{status === 'creating' ? 'Creating secure room...' : 'Joining room...'}</p>
          </motion.div>
        )}

        {status === 'waiting' && roomId && (
          <motion.div key="waiting" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', textAlign: 'center' }}>
            <div style={{ background: 'rgba(88, 166, 255, 0.05)', padding: '1.5rem', borderRadius: '24px', width: '100%', border: '1px solid var(--glass-border)' }}>
              <p style={{ color: '#8b949e', marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em' }}>SHARE THIS ROOM</p>
              
              <div style={{ background: 'white', padding: '1rem', borderRadius: '16px', display: 'inline-block', marginBottom: '1.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', border: '4px solid rgba(255,255,255,0.1)' }}>
                <QRCodeCanvas 
                  value={`${qrBaseOverride ? (qrBaseOverride.startsWith('http') ? qrBaseOverride : `http://${qrBaseOverride}`) : window.location.origin}${window.location.pathname}?room=${roomId}`}
                  size={180}
                  level="H"
                  includeMargin={false}
                />
              </div>

              {window.location.hostname === 'localhost' && !qrBaseOverride && (
                <div style={{ background: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.3)', padding: '0.75rem', borderRadius: '12px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <X size={16} color="#ff9800" style={{ transform: 'rotate(45deg)' }} />
                  <p style={{ fontSize: '0.75rem', color: '#ff9800', margin: 0, textAlign: 'left', lineHeight: 1.2 }}>
                    <strong>Note:</strong> You are on <code>localhost</code>. QR code might not work on other devices.
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                {isEditingHost ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      value={qrBaseOverride} 
                      onChange={(e) => setQrBaseOverride(e.target.value)} 
                      placeholder="e.g. 192.168.1.5:5173" 
                      style={{ fontSize: '0.8rem', padding: '0.4rem', flex: 1 }}
                    />
                    <button className="btn primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setIsEditingHost(false)}>Save</button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsEditingHost(true)} 
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                  >
                    {qrBaseOverride ? `Using: ${qrBaseOverride}` : 'Change QR Host (for mobile test)'} <QrCode size={12} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h2 style={{ fontSize: '2.5rem', letterSpacing: '0.3em', margin: 0, fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{roomId}</h2>
                <p style={{ fontSize: '0.85rem', color: '#8b949e' }}>Scan to join instantly</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary)' }}>
              <div className="loader" style={{ width: 14, height: 14, borderWidth: 2 }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>Waiting for peers...</p>
            </div>
          </motion.div>
        )}

        {status === 'connected' && (
          <motion.div key="connected" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
              <button onClick={() => setActiveTab('files')} style={{ background: 'none', border: 'none', color: activeTab === 'files' ? 'var(--primary)' : 'var(--text-color)', fontWeight: activeTab === 'files' ? 600 : 400, cursor: 'pointer', padding: '0.5rem 1rem 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'color 0.2s' }}>
                <FileIcon size={16} /> Files {transfers.length > 0 && `(${transfers.length})`}
              </button>
              <button onClick={() => setActiveTab('clipboard')} style={{ background: 'none', border: 'none', color: activeTab === 'clipboard' ? 'var(--primary)' : 'var(--text-color)', fontWeight: activeTab === 'clipboard' ? 600 : 400, cursor: 'pointer', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'color 0.2s' }}>
                <Clipboard size={16} /> Shared Clipboard
              </button>
              <div style={{ flex: 1 }} />
              <button 
                onClick={() => setShowQRModal(true)} 
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-color)', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                title="Show Room QR"
              >
                <QrCode size={18} />
              </button>
            </div>
            
            <div className="status-badge" style={{ width: 'fit-content', margin: '0 0 0.5rem 0', padding: '0.4rem 0.8rem', background: 'transparent', gap: '0.5rem', fontWeight: 600 }}>
                <Users size={14} color="var(--success)" /> <span style={{fontSize: '0.85rem'}}>{connectedPeers.length} Peer{connectedPeers.length !== 1 ? 's' : ''} connected</span>
            </div>
            
            {activeTab === 'files' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '40vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {transfers.length === 0 ? (
                    <div style={{ flex: 1, minHeight: '150px', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--glass-border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
                      <FileIcon size={32} color="#8b949e" />
                      <p style={{ color: '#8b949e', fontSize: '0.95rem', textAlign: 'center' }}>Select multiple files to transfer securely.</p>
                    </div>
                  ) : (
                    transfers.map(t => renderTransferItem(t))
                  )}
                </div>

                <div style={{ display: 'flex', marginTop: '0.5rem' }}>
                    <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />
                    <button className="btn primary" style={{ width: '100%' }} onClick={() => fileInputRef.current?.click()}>
                      Add Files to Queue
                    </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'clipboard' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '270px' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <textarea 
                    placeholder="Type or paste to share..." 
                    value={clipInput} 
                    onChange={e => setClipInput(e.target.value)} 
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendClip();
                      }
                    }}
                    style={{ flex: 1, textAlign: 'left', letterSpacing: 'normal', fontWeight: 'normal', borderRadius: '8px', padding: '0.8rem', resize: 'vertical', minHeight: '44px', maxHeight: '150px', background: 'rgba(13, 17, 23, 0.8)', border: '1px solid var(--glass-border)', color: 'var(--text-color)', outline: 'none', fontFamily: 'inherit' }} 
                  />
                  <button className="btn" onClick={handlePasteAndSend} title="Paste from Local Clipboard" style={{ padding: '0 1rem', borderRadius: '8px', border: '1px solid var(--primary)', color: 'var(--primary)' }}>
                    <Clipboard size={18} />
                  </button>
                  <button className="btn primary" onClick={handleSendClip} disabled={!clipInput.trim()} style={{ padding: '0 1rem', borderRadius: '8px' }}>
                    <Send size={18} />
                  </button>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '40vh', paddingRight: '0.2rem' }}>
                  {clipboardItems.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#8b949e', marginTop: '2rem', fontSize: '0.95rem' }}>No clipboard items shared yet.</p>
                  ) : (
                    clipboardItems.map(item => (
                      <div key={item.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--glass-border)' }}>
                        <p style={{ margin: 0, fontSize: '0.95rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: item.isMine ? '#8b949e' : '#e6edf3', marginRight: '1rem', lineHeight: 1.4 }}>
                          {item.text}
                        </p>
                        <button 
                          onClick={() => { navigator.clipboard.writeText(item.text); alert("Copied to local clipboard!"); }} 
                          className="btn" 
                          style={{ padding: '0.5rem', borderRadius: '8px', minWidth: '40px' }} 
                          title="Copy to local clipboard"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
            
            {error && <div className="status-badge error" style={{ width: '100%', textAlign: 'center', marginTop: '1rem' }}>{error}</div>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Code Modal Overlay */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowQRModal(false)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '2rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', maxWidth: '320px', width: '100%', textAlign: 'center' }}
            >
              <div style={{ display: 'flex', justifySelf: 'flex-end', width: '100%', marginBottom: '-1rem' }}>
                <button onClick={() => setShowQRModal(false)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', marginLeft: 'auto' }}><X size={20} /></button>
              </div>
              
              <p style={{ color: '#8b949e', fontSize: '0.9rem', fontWeight: 600 }}>INVITE OTHERS</p>
              
              <div style={{ background: 'white', padding: '1rem', borderRadius: '16px' }}>
                <QRCodeCanvas 
                  value={`${qrBaseOverride ? (qrBaseOverride.startsWith('http') ? qrBaseOverride : `http://${qrBaseOverride}`) : window.location.origin}${window.location.pathname}?room=${roomId}`}
                  size={200}
                  level="H"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '2rem', letterSpacing: '0.2em', margin: 0, fontWeight: 700, color: 'var(--primary)' }}>{roomId}</h2>
                <p style={{ color: '#8b949e', fontSize: '0.85rem' }}>Scan to join the current session</p>
              </div>

              <button 
                className="btn primary" 
                style={{ width: '100%', marginTop: '0.5rem' }} 
                onClick={() => {
                  const base = qrBaseOverride ? (qrBaseOverride.startsWith('http') ? qrBaseOverride : `http://${qrBaseOverride}`) : window.location.origin;
                  navigator.clipboard.writeText(`${base}${window.location.pathname}?room=${roomId}`);
                  alert("Link copied to clipboard!");
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
