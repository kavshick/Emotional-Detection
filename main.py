import os
from flask import Flask, render_template

app = Flask(__name__)

@app.route("/")
def index():
    return render_template('index.html')

@app.route("/live_detector")
def live_detector():
    return render_template('live_detector.html')

@app.route("/session_reports")
def session_reports():
    return render_template('session_reports.html')

@app.route("/analytics_dashboard")
def analytics_dashboard():
    return render_template('analytics_dashboard.html')

@app.route("/image_archive")
def image_archive():
    return render_template('image_archive.html')

@app.route("/about_project")
def about_project():
    return render_template('about_project.html')

@app.route("/model_training_info")
def model_training_info():
    return render_template('model_training_info.html')

if __name__ == "__main__":
    app.run(debug=True, port=int(os.environ.get('PORT', 5000)))
