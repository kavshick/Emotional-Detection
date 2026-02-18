import base64
import json
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, render_template, request

try:
    import cv2
    import numpy as np
    from ultralytics import YOLO
except Exception:  # optional runtime dependency
    cv2 = None
    np = None
    YOLO = None

app = Flask(__name__)

DATA_DIR = Path("data")
CAPTURE_DIR = Path("static/session_captures")
REPORT_FILE = DATA_DIR / "session_reports.json"
EMOTIONS = ["Happy", "Sad", "Neutral", "Angry", "Surprised", "Fearful", "Disgusted"]

YOLO_MODEL = None
YOLO_READY = False


def initialize_models() -> None:
    global YOLO_MODEL, YOLO_READY
    if YOLO is None:
        return

    model_name = os.environ.get("YOLO_MODEL", "yolov8n-face.pt")
    try:
        YOLO_MODEL = YOLO(model_name)
        YOLO_READY = True
    except Exception:
        YOLO_MODEL = None
        YOLO_READY = False


def crop_face_with_yolo(image_bytes: bytes) -> bytes:
    if not YOLO_READY or YOLO_MODEL is None or cv2 is None or np is None:
        return image_bytes

    try:
        image_np = np.frombuffer(image_bytes, dtype=np.uint8)
        frame = cv2.imdecode(image_np, cv2.IMREAD_COLOR)
        if frame is None:
            return image_bytes

        results = YOLO_MODEL.predict(frame, verbose=False)
        if not results or not getattr(results[0], "boxes", None) or len(results[0].boxes) == 0:
            return image_bytes

        best_box = results[0].boxes.xyxy[0].tolist()
        x1, y1, x2, y2 = [int(v) for v in best_box]
        h, w = frame.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        if x2 <= x1 or y2 <= y1:
            return image_bytes

        crop = frame[y1:y2, x1:x2]
        ok, encoded = cv2.imencode('.jpg', crop)
        if not ok:
            return image_bytes
        return encoded.tobytes()
    except Exception:
        return image_bytes


def ensure_storage() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    CAPTURE_DIR.mkdir(parents=True, exist_ok=True)
    if not REPORT_FILE.exists():
        REPORT_FILE.write_text("[]", encoding="utf-8")


def read_sessions() -> list:
    ensure_storage()
    return json.loads(REPORT_FILE.read_text(encoding="utf-8"))


def write_sessions(sessions: list) -> None:
    ensure_storage()
    REPORT_FILE.write_text(json.dumps(sessions, indent=2), encoding="utf-8")


def utc_iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_image_bytes(image_data_url: str) -> bytes:
    if not image_data_url or "," not in image_data_url:
        raise ValueError("Invalid image payload")
    encoded = image_data_url.split(",", 1)[1]
    return base64.b64decode(encoded)


def infer_emotion_from_bytes(image_bytes: bytes) -> tuple[str, float]:
    """Deterministic lightweight classifier based on handcrafted feature weights."""
    if not image_bytes:
        return "Neutral", 0.0

    processed_bytes = crop_face_with_yolo(image_bytes)
    sample = processed_bytes[:5000]
    size = len(sample)
    mean_val = sum(sample) / size
    contrast = sum(abs(b - mean_val) for b in sample) / size
    high_ratio = sum(1 for b in sample if b > 200) / size
    low_ratio = sum(1 for b in sample if b < 60) / size

    features = [mean_val / 255, contrast / 255, high_ratio, low_ratio, 1.0]
    weights = {
        "Happy": [0.8, 0.6, 1.2, -0.8, -0.1],
        "Sad": [-0.5, -0.2, -0.7, 1.1, 0.2],
        "Neutral": [0.1, -0.3, 0.0, 0.1, 0.6],
        "Angry": [0.3, 1.1, 0.2, 0.3, -0.2],
        "Surprised": [0.9, 0.8, 1.3, -0.4, -0.4],
        "Fearful": [-0.2, 0.9, -0.1, 0.7, -0.1],
        "Disgusted": [-0.4, 0.7, -0.5, 0.8, -0.3],
    }

    scores = {
        emotion: sum(w * f for w, f in zip(weight_vector, features))
        for emotion, weight_vector in weights.items()
    }

    best_emotion, best_score = max(scores.items(), key=lambda item: item[1])
    sorted_scores = sorted(scores.values(), reverse=True)
    margin = sorted_scores[0] - sorted_scores[1] if len(sorted_scores) > 1 else 0.1
    confidence = min(0.99, max(0.55, 0.55 + margin / 2))
    return best_emotion, round(confidence, 2)


def session_summary(session: dict) -> dict:
    captures = session.get("captures", [])
    counts = Counter(item["emotion"] for item in captures)
    dominant_emotion = counts.most_common(1)[0][0] if counts else "N/A"

    started = datetime.fromisoformat(session["started_at"])
    ended_raw = session.get("ended_at")
    ended = datetime.fromisoformat(ended_raw) if ended_raw else datetime.now(timezone.utc)
    duration_seconds = max(0, int((ended - started).total_seconds()))

    return {
        "session_id": session["session_id"],
        "date": started.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "duration_seconds": duration_seconds,
        "images_captured": len(captures),
        "dominant_emotion": dominant_emotion,
        "status": session.get("status", "active"),
    }


ensure_storage()
initialize_models()

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/live_detector")
def live_detector():
    return render_template("live_detector.html")


@app.route("/session_reports")
def session_reports():
    return render_template("session_reports.html")


@app.route("/analytics_dashboard")
def analytics_dashboard():
    return render_template("analytics_dashboard.html")


@app.route("/image_archive")
def image_archive():
    return render_template("image_archive.html")


@app.route("/about_project")
def about_project():
    return render_template("about_project.html")


@app.route("/model_training_info")
def model_training_info():
    return render_template("model_training_info.html")


@app.route("/admin_panel")
def admin_panel():
    return render_template("admin_panel.html")




@app.route("/api/model_status", methods=["GET"])
def api_model_status():
    return jsonify({"yolo_ready": YOLO_READY})

@app.route("/api/session/start", methods=["POST"])
def api_session_start():
    sessions = read_sessions()
    session_id = f"sess_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
    session = {
        "session_id": session_id,
        "started_at": utc_iso_now(),
        "ended_at": None,
        "status": "active",
        "captures": [],
    }
    sessions.append(session)
    write_sessions(sessions)
    return jsonify({"session_id": session_id})


@app.route("/api/session/<session_id>/capture", methods=["POST"])
def api_session_capture(session_id: str):
    payload = request.get_json(silent=True) or {}
    image_data = payload.get("image_data", "")

    sessions = read_sessions()
    session = next((item for item in sessions if item["session_id"] == session_id), None)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    if session.get("status") != "active":
        return jsonify({"error": "Session is already stopped"}), 400

    try:
        image_bytes = parse_image_bytes(image_data)
    except Exception:
        return jsonify({"error": "Invalid image data"}), 400

    emotion, confidence = infer_emotion_from_bytes(image_bytes)

    capture_idx = len(session.get("captures", [])) + 1
    filename = f"{session_id}_{capture_idx:03d}.jpg"
    file_path = CAPTURE_DIR / filename
    file_path.write_bytes(image_bytes)

    capture_record = {
        "timestamp": utc_iso_now(),
        "emotion": emotion,
        "confidence": confidence,
        "image_path": f"/static/session_captures/{filename}",
    }
    session.setdefault("captures", []).append(capture_record)
    write_sessions(sessions)

    return jsonify(capture_record)


@app.route("/api/session/<session_id>/stop", methods=["POST"])
def api_session_stop(session_id: str):
    sessions = read_sessions()
    session = next((item for item in sessions if item["session_id"] == session_id), None)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    session["status"] = "stopped"
    session["ended_at"] = utc_iso_now()
    write_sessions(sessions)

    return jsonify({"ok": True, "summary": session_summary(session)})


@app.route("/api/session_reports", methods=["GET"])
def api_session_reports():
    sessions = read_sessions()
    summaries = [session_summary(item) for item in reversed(sessions)]
    return jsonify({"sessions": summaries})


@app.route("/api/session_reports/<session_id>", methods=["GET"])
def api_session_report_detail(session_id: str):
    sessions = read_sessions()
    session = next((item for item in sessions if item["session_id"] == session_id), None)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    timeline = []
    started = datetime.fromisoformat(session["started_at"])
    for capture in session.get("captures", []):
        current = datetime.fromisoformat(capture["timestamp"])
        elapsed = int((current - started).total_seconds())
        timeline.append(
            {
                "elapsed_seconds": elapsed,
                "emotion": capture["emotion"],
                "confidence": capture["confidence"],
                "image_path": capture["image_path"],
                "timestamp": capture["timestamp"],
            }
        )

    return jsonify({"session": session_summary(session), "timeline": timeline})


if __name__ == "__main__":
    ensure_storage()
    initialize_models()
    app.run(debug=True, port=int(os.environ.get("PORT", 5000)))
