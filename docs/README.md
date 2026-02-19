# Emotional Detection

Flask web app for live emotion session tracking, periodic frame capture, and session-based reports.

## What this project contains

- **Live Detector**: starts/stops a webcam session and records captures every 5 seconds.
- **Session Reports**: lists captured sessions and shows emotion timeline graphs with thumbnails.
- **Analytics / Archive / About**: UI routes for dashboarding and project context.

## Project structure

- `main.py` – Flask app routes + session APIs + storage/inference helpers.
- `templates/` – Jinja templates for all pages.
- `static/css/style.css` – global UI/UX styles (desktop + mobile).
- `static/js/script.js` – frontend logic (mobile nav, live capture, reports/timeline rendering).
- `static/session_captures/` – runtime-generated captured session images (git-ignored).
- `data/` – runtime-generated session metadata JSON (git-ignored).
- `devserver.sh`, `dev.nix` – local/dev environment startup.

## Getting started

1. Create and activate virtual environment:

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Run the app:

   ```bash
   python -m flask --app main run --host 0.0.0.0 --port 5000
   ```

## Notes

- Runtime artifacts are intentionally excluded from git (`data/`, `static/session_captures/`, logs, caches).
- Some model-training image placeholders referenced in `model_training_info.html` may require adding actual image files.
