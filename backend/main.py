import base64
import json
import os
import cv2
import boto3  # Import AWS SDK
import numpy as np
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env if present

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
CAPTURE_DIR = BASE_DIR.parent / "frontend/public/session_captures"
REPORT_FILE = DATA_DIR / "session_reports.json"
EMOTIONS = ["Happy", "Sad", "Neutral", "Angry", "Surprised", "Fearful", "Disgusted"]
FACE_CASCADE = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)
_DEEPFACE_REF = None
_DEEPFACE_READY = None
_DEEPFACE_ERROR = ""

# AWS S3 Configuration
S3_BUCKET_NAME = os.getenv("AWS_BUCKET_NAME")
S3_REGION = os.getenv("AWS_REGION", "us-east-1")
try:
    s3_client = boto3.client(
        "s3",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=S3_REGION,
    )
except Exception as e:
    print(f"Warning: Failed to initialize AWS S3 client: {e}")
    s3_client = None

def upload_to_s3(image_bytes, filename):
    """
    Uploads image bytes to S3 and returns the public URL.
    """
    if not s3_client or not S3_BUCKET_NAME:
        print("S3 Client or Bucket Name not configured.")
        return None

    s3_key = f"session_captures/{filename}"
    try:
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            Body=image_bytes,
            ContentType="image/jpeg",
        )
        return f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
    except Exception as e:
        print(f"Error uploading to S3: {e}")
        return None


# Eagerly load DeepFace to avoid lazy loading issues during requests
try:
    print("Loading DeepFace library... this may take a moment.")
    from deepface import DeepFace
    _DEEPFACE_REF = DeepFace
    _DEEPFACE_READY = True
    
    # Pre-load models to avoid first-request latency
    print("Pre-loading generic models...")
    # This dummy call forces model weights to load into memory
    try:
        # Create a small dummy image
        dummy_img = np.zeros((48, 48, 3), dtype=np.uint8)
        DeepFace.analyze(img_path=dummy_img, actions=['emotion'], detector_backend='ssd', enforce_detection=False, silent=True)
        print("DeepFace models loaded successfully.")
    except Exception as e:
        print(f"Warning: Model pre-loading failed (will load on first request): {e}")

except Exception as exc:
    print(f"DeepFace failed to load: {exc}")
    _DEEPFACE_REF = None
    _DEEPFACE_READY = False
    _DEEPFACE_ERROR = str(exc)


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


def decode_image_bytes(image_bytes: bytes) -> np.ndarray | None:
    if not image_bytes:
        return None
    nparr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


def get_deepface():
    return _DEEPFACE_REF


def detect_primary_face(frame: np.ndarray) -> dict | None:
    if frame is None or frame.size == 0 or FACE_CASCADE.empty():
        return None

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = FACE_CASCADE.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(48, 48))
    if len(faces) == 0:
        return None

    x, y, w, h = max(faces, key=lambda item: item[2] * item[3])
    return {"x": int(x), "y": int(y), "w": int(w), "h": int(h)}


def heuristic_emotion_from_frame(frame: np.ndarray, face_box: dict | None) -> tuple[str, float]:
    if frame is None or frame.size == 0:
        return "Neutral", 0.0

    region = frame
    if face_box:
        x, y, w, h = face_box["x"], face_box["y"], face_box["w"], face_box["h"]
        region = frame[y : y + h, x : x + w]
        if region.size == 0:
            region = frame

    gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
    mean_val = float(np.mean(gray))
    contrast = float(np.std(gray))

    if mean_val > 165 and contrast > 58:
        return "Surprised", 0.64
    if mean_val > 145 and contrast > 40:
        return "Happy", 0.62
    if mean_val < 90 and contrast < 35:
        return "Sad", 0.6
    if contrast > 62:
        return "Angry", 0.58

    return "Neutral", 0.57


def infer_emotion_from_frame(frame: np.ndarray, face_box: dict | None) -> tuple[str, float, str]:
    deepface = get_deepface()
    if deepface is not None:
        try:
            # Use 'ssd' detector for better accuracy than opencv (haar cascade)
            # This helps align the face correctly for the emotion model
            detector = "ssd" 

            results = deepface.analyze(
                img_path=frame,
                actions=["emotion"],
                enforce_detection=False,
                detector_backend=detector,
                silent=True,
            )

            # DeepFace returns a list of result objects
            if isinstance(results, dict):
                results = [results]

            valid_results = [r for r in results if r.get('region')]
            
            if valid_results:
                # Pick the largest face detected to be safe
                result = max(valid_results, key=lambda r: r['region']['w'] * r['region']['h'])
                
                dominant = result.get("dominant_emotion", "neutral")
                scores = result.get("emotion", {})
                score_val = float(scores.get(dominant, 0.0))
                # Ensure confidence is 0.0-1.0
                confidence = score_val / 100.0
                
                emotion = dominant.capitalize()
                if emotion not in EMOTIONS:
                    emotion = "Neutral"
                    
                return emotion, round(max(0.0, min(1.0, confidence)), 2), f"deepface-{detector}"

        except Exception as e:
            # Fallback if deepface fails
            # print(f"DeepFace analysis error: {e}") 
            pass

    # Fallback to heuristic if deepface fails or no face found
    emotion, confidence = heuristic_emotion_from_frame(frame, face_box)
    return emotion, confidence, "heuristic"


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


# @app.route("/")
# def index():
    return jsonify({"status": "API is running", "message": "Please access the frontend via port 5173"})


@app.route("/api/model_status", methods=["GET"])
def api_model_status():
    deepface = get_deepface()
    ml_ready = deepface is not None
    ml_status = "available" if ml_ready else f"unavailable ({_DEEPFACE_ERROR or 'import failed'})"
    model_name = "DeepFace + OpenCV fallback" if ml_ready else "OpenCV heuristic fallback"

    return jsonify(
        {
            "yolo_ready": ml_ready,  # Keeping key for frontend compatibility.
            "yolo_status": ml_status,
            "fallback": "OpenCV heuristic",
            "model_name": model_name,
            "emotions_supported": EMOTIONS,
        }
    )


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

    frame = decode_image_bytes(image_bytes)
    if frame is None:
        return jsonify({"error": "Invalid image buffer"}), 400

    face_box = detect_primary_face(frame)
    emotion, confidence, emotion_source = infer_emotion_from_frame(frame, face_box)

    capture_idx = len(session.get("captures", [])) + 1
    filename = f"{session_id}_{capture_idx:03d}.jpg"
    
    # --- Upload to S3 if configured ---
    image_url = None
    if s3_client and S3_BUCKET_NAME:
        image_url = upload_to_s3(image_bytes, filename)

    # --- Fallback to Local Storage if S3 failed or not configured ---
    if not image_url:
        print("S3 upload unavailable, falling back to local storage.")
        file_path = CAPTURE_DIR / filename
        file_path.write_bytes(image_bytes)
        image_url = f"/session_captures/{filename}"

    capture_record = {
        "timestamp": utc_iso_now(),
        "emotion": emotion,
        "confidence": confidence,
        "emotion_source": emotion_source,
        "face_detected": bool(face_box),
        "face_box": face_box,
        "image_path": image_url,
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


@app.route("/api/session/<session_id>", methods=["DELETE"])
def api_session_delete(session_id: str):
    sessions = read_sessions()
    session = next((item for item in sessions if item["session_id"] == session_id), None)
    
    if not session:
        return jsonify({"error": "Session not found"}), 404

    # Remove associated images
    for capture in session.get("captures", []):
        img_path = capture.get("image_path", "")
        
        # 1. Handle S3 Deletion
        if s3_client and S3_BUCKET_NAME and "amazonaws.com" in img_path:
            try:
                # Extract key from URL. Assuming URL ends with session_captures/filename.jpg
                if "/session_captures/" in img_path:
                    filename = img_path.split("/")[-1]
                    s3_key = f"session_captures/{filename}"
                    s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
            except Exception as e:
                print(f"Failed to delete S3 object {img_path}: {e}")

        # 2. Handle Local Deletion (Fallback or old sessions)
        elif img_path.startswith("/session_captures/"):
            filename = img_path.split("/")[-1]
            file_path = CAPTURE_DIR / filename
            try:
                if file_path.exists():
                    file_path.unlink()
            except Exception:
                pass # Ignore file deletion errors
                
    sessions = [s for s in sessions if s["session_id"] != session_id]
    write_sessions(sessions)
    
    return jsonify({"ok": True})


if __name__ == "__main__":
    ensure_storage()
    app.run(debug=True, port=int(os.environ.get("PORT", 5000)))
