import React, { useState, useEffect } from 'react';
import { Trash2, TrendingUp, Calendar, Clock, Image as ImageIcon } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const EMOTION_SCORES = {
    'Disgusted': 0,
    'Fearful': 1,
    'Sad': 2,
    'Neutral': 3,
    'Happy': 4,
    'Surprised': 5,
    'Angry': 6
};

const REVERSE_SCORES = Object.entries(EMOTION_SCORES).reduce((acc, [k, v]) => ({...acc, [v]: k}), {});

const SessionReports = () => {
    const [sessions, setSessions] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState(null);
    const [timelineData, setTimelineData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            const res = await fetch('/api/session_reports');
            const data = await res.json();
            setSessions(data.sessions || []);
            setLoading(false);
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    const deleteSession = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this session?')) return;
        
        try {
            await fetch(`/api/session/${id}`, { method: 'DELETE' });
            setSessions(prev => prev.filter(s => s.session_id !== id));
            if (selectedSessionId === id) {
                setSelectedSessionId(null);
                setTimelineData(null);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const loadTimeline = async (id) => {
        if (selectedSessionId === id) return;
        setSelectedSessionId(id);
        
        try {
            const res = await fetch(`/api/session_reports/${id}`);
            const data = await res.json();
            setTimelineData(data.timeline);
        } catch (e) {
            console.error(e);
        }
    };

    const chartData = timelineData ? {
        labels: timelineData.map(t => `${t.elapsed_seconds}s`),
        datasets: [
            {
                label: 'Emotion Progression',
                data: timelineData.map(t => EMOTION_SCORES[t.emotion] || 3),
                borderColor: 'rgb(56, 189, 248)',
                backgroundColor: 'rgba(56, 189, 248, 0.5)',
                tension: 0.3,
            },
        ],
    } : null;

    const chartOptions = {
        responsive: true,
        scales: {
            y: {
                min: 0,
                max: 6,
                ticks: {
                    callback: function(value) {
                        return REVERSE_SCORES[value] || '';
                    }
                }
            }
        },
        plugins: {
            legend: {
                position: 'top',
                labels: { color: '#94a3b8' }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return REVERSE_SCORES[context.raw];
                    }
                }
            }
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Session Reports</h2>
                <button onClick={fetchSessions} className="text-sm text-primary hover:underline">
                    Refresh Data
                </button>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-secondary/50 text-muted-foreground uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-4">Session ID</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Duration</th>
                                <th className="px-6 py-4">Images</th>
                                <th className="px-6 py-4">Dominant Emotion</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr><td colSpan="7" className="px-6 py-8 text-center text-muted-foreground">Loading sessions...</td></tr>
                            ) : sessions.length === 0 ? (
                                <tr><td colSpan="7" className="px-6 py-8 text-center text-muted-foreground">No sessions recorded yet.</td></tr>
                            ) : (
                                sessions.map(session => (
                                    <tr 
                                        key={session.session_id} 
                                        onClick={() => loadTimeline(session.session_id)}
                                        className={`cursor-pointer transition-colors hover:bg-secondary/30 ${selectedSessionId === session.session_id ? 'bg-secondary/50 ring-1 ring-primary' : ''}`}
                                    >
                                        <td className="px-6 py-4 font-mono text-xs text-primary">{session.session_id}</td>
                                        <td className="px-6 py-4 text-muted-foreground">{session.date}</td>
                                        <td className="px-6 py-4">{Math.floor(session.duration_seconds/60)}m {session.duration_seconds%60}s</td>
                                        <td className="px-6 py-4">{session.images_captured}</td>
                                        <td className="px-6 py-4 font-medium">{session.dominant_emotion}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                session.status === 'active' 
                                                    ? 'bg-green-500/10 text-green-500' 
                                                    : 'bg-yellow-500/10 text-yellow-500'
                                            }`}>
                                                {session.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={(e) => deleteSession(session.session_id, e)}
                                                className="p-2 hover:bg-destructive/10 text-destructive rounded-md transition-colors"
                                                title="Delete Session"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedSessionId && timelineData && (
                <div className="grid lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm">
                        <h3 className="text-lg font-semibold mb-6 flex items-center space-x-2">
                            <TrendingUp size={20} className="text-primary" />
                            <span>Emotion Timeline</span>
                        </h3>
                        <div className="h-[300px] w-full">
                            <Line options={chartOptions} data={chartData} />
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm h-[400px] flex flex-col">
                        <h3 className="text-lg font-semibold mb-6 flex items-center space-x-2">
                            <ImageIcon size={20} className="text-primary" />
                            <span>Captures Gallery</span>
                        </h3>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                            {timelineData.map((item, idx) => (
                                <div key={idx} className="group relative rounded-lg overflow-hidden border border-border">
                                    <img 
                                        src={item.image_path} 
                                        alt={item.emotion} 
                                        loading="lazy"
                                        className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-xs flex justify-between items-center backdrop-blur-sm">
                                        <span className="font-semibold text-white">{item.emotion}</span>
                                        <span className="text-gray-300">{item.elapsed_seconds}s</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SessionReports;
