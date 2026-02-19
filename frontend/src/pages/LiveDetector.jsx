import React, { useRef, useState, useEffect } from 'react';
import { Play, Square, Loader2, Camera as CameraIcon, Cpu, ScanFace, Activity } from 'lucide-react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import anime from 'animejs/lib/anime.es.js';

const LiveDetector = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const barRef = useRef(null);
    
    // State
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [emotion, setEmotion] = useState('N/A');
    const [confidence, setConfidence] = useState(0);
    const [faceStatus, setFaceStatus] = useState('Initializing...');
    const [backendStatus, setBackendStatus] = useState('Connecting...');
    const [loading, setLoading] = useState(false);
    
    // Refs for processing
    const faceMeshRef = useRef(null);
    const cameraRef = useRef(null);

    // Animate Confidence Bar
    useEffect(() => {
        if (barRef.current) {
            anime({
                targets: barRef.current,
                width: `${Math.max(5, confidence * 100)}%`,
                backgroundColor: confidence > 0.8 ? '#00f0ff' : confidence > 0.5 ? '#7000ff' : '#ff0099',
                boxShadow: confidence > 0.8 ? '0 0 20px #00f0ff' : 'none',
                easing: 'easeOutElastic(1, .8)',
                duration: 800
            });
        }
    }, [confidence]);

    useEffect(() => {
        // Initialize FaceMesh
        const faceMesh = new FaceMesh({locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }});
        
        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        faceMesh.onResults(onResults);
        faceMeshRef.current = faceMesh;

        // Check backend status
        fetch('/api/model_status')
            .then(res => res.json())
            .then(data => setBackendStatus(data.yolo_status === 'available' ? 'Online' : 'Limited'))
            .catch(() => setBackendStatus('Offline'));

        return () => {
            stopSession();
        };
    }, []);

    const onResults = (results) => {
        if (!canvasRef.current || !videoRef.current) return;
        
        const canvasCtx = canvasRef.current.getContext('2d');
        const { width, height } = canvasRef.current;
        
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, width, height);
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            setFaceStatus('Tracking Active');
            
            for (const landmarks of results.multiFaceLandmarks) {
                // Cyberpunk overlay - simple corners
                let minX = 1, minY = 1, maxX = 0, maxY = 0;
                landmarks.forEach(p => {
                     if (p.x < minX) minX = p.x;
                     if (p.x > maxX) maxX = p.x;
                     if (p.y < minY) minY = p.y;
                     if (p.y > maxY) maxY = p.y;
                });
                
                const w = (maxX - minX) * width;
                const h = (maxY - minY) * height;
                const x = minX * width;
                const y = minY * height;
                const pad = 20;

                // Draw corners
                canvasCtx.strokeStyle = '#00f0ff';
                canvasCtx.lineWidth = 2;
                canvasCtx.shadowBlur = 10;
                canvasCtx.shadowColor = '#00f0ff';

                // Top Left
                canvasCtx.beginPath();
                canvasCtx.moveTo(x - pad, y - pad + 20);
                canvasCtx.lineTo(x - pad, y - pad);
                canvasCtx.lineTo(x - pad + 20, y - pad);
                canvasCtx.stroke();

                // Top Right
                canvasCtx.beginPath();
                canvasCtx.moveTo(x + w + pad - 20, y - pad);
                canvasCtx.lineTo(x + w + pad, y - pad);
                canvasCtx.lineTo(x + w + pad, y - pad + 20);
                canvasCtx.stroke();

                // Bottom Left
                canvasCtx.beginPath();
                canvasCtx.moveTo(x - pad, y + h + pad - 20);
                canvasCtx.lineTo(x - pad, y + h + pad);
                canvasCtx.lineTo(x - pad + 20, y + h + pad);
                canvasCtx.stroke();

                // Bottom Right
                canvasCtx.beginPath();
                canvasCtx.moveTo(x + w + pad - 20, y + h + pad);
                canvasCtx.lineTo(x + w + pad, y + h + pad);
                canvasCtx.lineTo(x + w + pad, y + h + pad - 20);
                canvasCtx.stroke();
            }
        } else {
            setFaceStatus('Scanning...');
        }
        canvasCtx.restore();
    };

    const startSession = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/session/start', { method: 'POST' });
            const data = await res.json();
            
            if (data.session_id) {
                setSessionId(data.session_id);
                setIsSessionActive(true);
                
                if (videoRef.current && faceMeshRef.current) {
                    const camera = new Camera(videoRef.current, {
                        onFrame: async () => {
                            if (faceMeshRef.current) {
                                await faceMeshRef.current.send({image: videoRef.current});
                            }
                        },
                        width: 640,
                        height: 480
                    });
                    camera.start();
                    cameraRef.current = camera;
                }
            } else {
                throw new Error('Failed to start session');
            }
        } catch (e) {
            console.error(e);
            alert("Failed to start session. Check backend connection.");
        } finally {
            setLoading(false);
        }
    };

    const stopSession = async () => {
        if (sessionId) {
            try {
                await fetch(`/api/session/${sessionId}/stop`, { method: 'POST' });
            } catch (e) {}
        }
        
        if (cameraRef.current) {
            try { cameraRef.current.stop(); } catch(e) {}
        }
        
        if (videoRef.current && videoRef.current.srcObject) {
             const tracks = videoRef.current.srcObject.getTracks();
             tracks.forEach(t => t.stop());
             videoRef.current.srcObject = null;
        }

        setIsSessionActive(false);
        setSessionId(null);
        setFaceStatus('Idle');
        setEmotion('N/A');
    };

    useEffect(() => {
        let interval;
        if (isSessionActive && sessionId) {
            interval = setInterval(async () => {
                if (videoRef.current) {
                    const canvas = document.createElement('canvas');
                    canvas.width = videoRef.current.videoWidth;
                    canvas.height = videoRef.current.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(videoRef.current, 0, 0);
                    const imageData = canvas.toDataURL('image/jpeg', 0.8);

                    try {
                        const res = await fetch(`/api/session/${sessionId}/capture`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ image_data: imageData })
                        });
                        const data = await res.json();
                        if (data.emotion) {
                            setEmotion(data.emotion);
                            setConfidence(data.confidence);
                        }
                    } catch (e) {
                        console.error("Capture failed", e);
                    }
                }
            }, 1000); 
        }
        return () => clearInterval(interval);
    }, [isSessionActive, sessionId]);

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 md:px-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-6 mb-8 justify-between items-start md:items-center">
                <div className="flex-1">
                    <h1 className="text-3xl font-bold mb-1 text-white tracking-tight flex items-center">
                        <Activity className="mr-3 text-primary animate-pulse" />
                        Live Analysis
                    </h1>
                    <p className="text-muted-foreground text-sm font-mono tracking-wide">
                        MODULE: DEEPFACE // STATUS: <span className={backendStatus === 'Online' ? 'text-green-400' : 'text-red-400'}>{backendStatus.toUpperCase()}</span>
                    </p>
                </div>
                
                <div className="w-full md:w-auto">
                    {isSessionActive ? (
                        <button 
                            onClick={() => stopSession()}
                            className="w-full md:w-auto flex items-center justify-center space-x-2 bg-destructive/90 hover:bg-destructive text-white px-8 py-3 rounded-lg transition-all shadow-lg hover:shadow-red-900/20 font-semibold tracking-wide"
                        >
                            <Square size={18} fill="currentColor" />
                            <span>TERMINATE SESSION</span>
                        </button>
                    ) : (
                        <button 
                            onClick={startSession}
                            disabled={loading}
                            className="w-full md:w-auto flex items-center justify-center space-x-2 bg-primary hover:bg-primary/80 text-black px-8 py-3 rounded-lg transition-all shadow-neon font-bold tracking-wide disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                            <span>INITIATE SCAN</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Video Feed */}
                <div className="lg:col-span-2 relative bg-black rounded-2xl overflow-hidden aspect-video shadow-2xl ring-1 ring-white/10 group">
                    <video 
                        ref={videoRef}
                        className="absolute inset-0 w-full h-full object-cover opacity-80"
                        playsInline
                        muted
                        style={{ display: isSessionActive ? 'block' : 'none' }}
                    />
                    <canvas 
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
                    />
                    
                    {/* Scanline Overlay */}
                    {isSessionActive && (
                        <div className="absolute inset-0 pointer-events-none z-20 bg-[linear-gradient(transparent_50%,rgba(0,240,255,0.025)_50%)] bg-[length:100%_4px]"></div>
                    )}
                    
                    {!isSessionActive && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/50 backdrop-blur-sm border border-white/5">
                            <div className="w-20 h-20 rounded-full bg-black/50 border border-white/10 flex items-center justify-center mb-4">
                                <CameraIcon size={32} className="text-muted-foreground/50" />
                            </div>
                            <p className="text-muted-foreground font-mono text-xs tracking-widest uppercase">Video Feed Offline</p>
                        </div>
                    )}
                    
                    <div className="absolute top-4 right-4 z-30">
                         <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                            <div className={`w-2 h-2 rounded-full ${isSessionActive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
                            <span className="text-[10px] font-mono text-white/70 uppercase">REC</span>
                         </div>
                    </div>

                    <div className="absolute bottom-4 left-4 z-30 inline-flex items-center space-x-2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-lg border border-primary/20 text-xs text-primary shadow-neon">
                        <ScanFace size={16} />
                        <span className="font-mono tracking-wider">{faceStatus.toUpperCase()}</span>
                    </div>
                </div>

                {/* Analysis Panel */}
                <div className="space-y-6">
                    <div className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 shadow-xl relative overflow-hidden">
                        {/* Background glow */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="flex items-center justify-between mb-8 relative z-10">
                            <h3 className="font-bold flex items-center text-white tracking-wide">
                                <Cpu className="mr-2 text-secondary" size={18} />
                                INFERENCE ENGINE
                            </h3>
                            <span className="text-[10px] bg-secondary/20 text-secondary border border-secondary/50 px-2 py-0.5 rounded font-mono">LIVE</span>
                        </div>
                        
                        <div className="text-center py-6 relative z-10">
                            <div className="text-5xl md:text-6xl font-black mb-2 tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                                {emotion || '---'}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono uppercase tracking-[0.2em] mt-4">
                                Confidence Level
                            </div>
                        </div>

                        <div className="space-y-2 mt-6 relative z-10">
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div 
                                    ref={barRef}
                                    className="h-full bg-primary shadow-[0_0_10px_theme('colors.primary.DEFAULT')]"
                                    style={{ width: '0%' }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                                <span>0%</span>
                                <span>{(confidence * 100).toFixed(0)}%</span>
                                <span>100%</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card/30 border border-white/5 rounded-xl p-6">
                         <div className="space-y-4 font-mono text-xs">
                            <div className="flex justify-between items-center pb-3 border-b border-white/5">
                                <span className="text-muted-foreground uppercase tracking-wider">Session ID</span>
                                <span className="text-primary truncate max-w-[120px]">{sessionId || '---'}</span>
                            </div>
                            <div className="flex justify-between items-center pb-3 border-b border-white/5">
                                <span className="text-muted-foreground uppercase tracking-wider">Faces Detected</span>
                                <span className="text-white">1</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground uppercase tracking-wider">Latency</span>
                                <span className="text-green-400">~85ms</span>
                            </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveDetector;
