document.addEventListener('DOMContentLoaded', () => {
    const startStopBtn = document.getElementById('start-stop-btn');
    if (!startStopBtn) return; // Exit if not on live detector page

    const video = document.getElementById('webcam');
    const statusText = document.querySelector('.status-active'); // Assuming this exists or creates one
    const sessionIdDisplay = document.getElementById('session-id');
    const emotionDisplay = document.getElementById('detected-emotion');
    const confidenceDisplay = document.getElementById('confidence');

    let stream = null;
    let isSessionActive = false;
    let captureInterval = null;

    startStopBtn.addEventListener('click', async () => {
        if (!isSessionActive) {
            startSession();
        } else {
            stopSession();
        }
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

    function stopSession() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
            stream = null;
        }
        clearInterval(captureInterval);
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
        
        const imageData = canvas.toDataURL('image/jpeg');

        // Here we would send imageData to the backend
        // For now, simulate a response
        simulateBackendResponse();
    }

    function simulateBackendResponse() {
        const emotions = ['Happy', 'Sad', 'Neutral', 'Angry', 'Surprised'];
        const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
        const randomConfidence = (Math.random() * (0.99 - 0.70) + 0.70).toFixed(2);

        emotionDisplay.textContent = randomEmotion;
        confidenceDisplay.textContent = randomConfidence;
    }
});
