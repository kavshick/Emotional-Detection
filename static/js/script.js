document.addEventListener('DOMContentLoaded', () => {
    const startStopBtn = document.getElementById('start-stop-btn');
    if (!startStopBtn) {
        return;
    }

    const video = document.getElementById('webcam');
    const statusText = document.querySelector('.status-active'); // Assuming this exists or creates one
    const sessionIdDisplay = document.getElementById('session-id');
    const emotionDisplay = document.getElementById('detected-emotion');
    const confidenceDisplay = document.getElementById('confidence');
    const faceStatus = document.getElementById('face-status');
    const modelStatus = document.getElementById('model-status');

    let stream = null;
    let activeSessionId = null;
    let isSessionActive = false;
    let captureInterval = null;
    let faceMesh = null;
    let hasFace = false;

    fetch('/api/model_status')
        .then((r) => r.json())
        .then((data) => {
            modelStatus.textContent = data.yolo_ready
                ? 'YOLO + FaceMesh active'
                : 'FaceMesh active (YOLO fallback unavailable)';
        })
        .catch(() => {
            modelStatus.textContent = 'FaceMesh active (model status unavailable)';
        });

    startStopBtn.addEventListener('click', async () => {
        if (!isSessionActive) {
            await startSession();
            return;
        }

        await stopSession();
    });

    async function startSession() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            isSessionActive = true;
            startStopBtn.textContent = "Stop Session";
            sessionIdDisplay.textContent = generateSessionId();
            
            // Start capturing frames
            captureInterval = setInterval(captureFrame, 2000); // Every 2 seconds
            
        } catch (err) {
            console.error("Error accessing webcam:", err);
            alert("Could not access webcam. Please allow permissions.");
        }
    }

    async function stopSession() {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            video.srcObject = null;
            stream = null;
        }

        clearInterval(captureInterval);

        if (activeSessionId) {
            try {
                await fetch(`/api/session/${activeSessionId}/stop`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
            } catch (error) {
                console.error('Error stopping session:', error);
            }
        }

        isSessionActive = false;
        startStopBtn.textContent = "Start Session";
        sessionIdDisplay.textContent = "N/A";
        emotionDisplay.textContent = "N/A";
        confidenceDisplay.textContent = "N/A";
    }

    function generateSessionId() {
        return 'sess_' + Math.random().toString(36).substr(2, 9);
    }

    async function captureFrame() {
        if (!isSessionActive) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = canvas.toDataURL('image/jpeg', 0.9);

        try {
            const response = await fetch(`/api/session/${activeSessionId}/capture`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_data: imageData })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Capture request failed');
            }

            emotionDisplay.textContent = data.emotion;
            confidenceDisplay.textContent = data.confidence;
        } catch (error) {
            console.error('Capture failed:', error);
        }
    }
}

async function initializeSessionReports() {
    const tableBody = document.getElementById('session-reports-table');
    if (!tableBody) {
        return;
    }

    const timelineLabel = document.getElementById('timeline-session-id');
    const imageGrid = document.getElementById('timeline-image-grid');
    const chartCanvas = document.getElementById('session-emotion-chart');

    const emotionScores = {
        Disgusted: 0,
        Fearful: 1,
        Sad: 2,
        Neutral: 3,
        Happy: 4,
        Surprised: 5,
        Angry: 6
    };

    let timelineChart = null;

    function durationLabel(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }

    async function renderTimeline(sessionId) {
        const response = await fetch(`/api/session_reports/${sessionId}`);
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || 'Failed to load session timeline');
        }

        timelineLabel.textContent = `Session ${sessionId}`;

        const labels = payload.timeline.map((item) => `${item.elapsed_seconds}s`);
        const values = payload.timeline.map((item) => emotionScores[item.emotion] ?? 3);

        if (timelineChart) {
            timelineChart.destroy();
        }

        timelineChart = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Emotion progression',
                    data: values,
                    borderColor: '#57f6c3',
                    backgroundColor: 'rgba(87, 246, 195, 0.2)',
                    tension: 0.25,
                    pointRadius: 4
                }]
            },
            options: {
                scales: {
                    y: {
                        ticks: {
                            callback: (value) => Object.keys(emotionScores).find((key) => emotionScores[key] === value) || value
                        },
                        min: 0,
                        max: 6
                    }
                }
            }
        });

        imageGrid.innerHTML = '';
        payload.timeline.forEach((entry) => {
            const card = document.createElement('div');
            card.className = 'timeline-thumb';
            card.innerHTML = `
                <img src="${entry.image_path}" alt="${entry.emotion} capture">
                <p>${entry.elapsed_seconds}s · ${entry.emotion} (${entry.confidence})</p>
            `;
            imageGrid.appendChild(card);
        });
    }

    const response = await fetch('/api/session_reports');
    const payload = await response.json();

    tableBody.innerHTML = '';
    payload.sessions.forEach((session) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${session.session_id}</td>
            <td>${session.date}</td>
            <td>${durationLabel(session.duration_seconds)}</td>
            <td>${session.images_captured}</td>
            <td>${session.dominant_emotion}</td>
            <td>${session.status}</td>
            <td><button class="view-timeline-btn" data-session-id="${session.session_id}">View timeline</button></td>
        `;
        tableBody.appendChild(row);
    });

    tableBody.querySelectorAll('.view-timeline-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const sessionId = button.getAttribute('data-session-id');
            try {
                await renderTimeline(sessionId);
            } catch (error) {
                console.error(error);
                timelineLabel.textContent = 'Unable to load selected timeline.';
            }
        });
    });
}
