import subprocess
import sys
import os
import time
import signal

# Define paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_SCRIPT = os.path.join(BASE_DIR, "backend", "main.py")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

def cleanup(processes):
    print("\nStopping services...")
    for p in processes:
        if p.poll() is None:  # If process is still running
            # On Windows, terminate() might not be enough for shell=True processes like npm
            if sys.platform == "win32":
                subprocess.call(['taskkill', '/F', '/T', '/PID', str(p.pid)])
            else:
                p.terminate()
    print("Services stopped.")

def run_app():
    processes = []
    
    try:
        print("🚀 Starting Emotion Detection System...")
        
        # 1. Start Backend (Flask)
        print("   [1/2] Launching Backend Server...")
        backend_env = os.environ.copy()
        backend_process = subprocess.Popen(
            [sys.executable, BACKEND_SCRIPT],
            cwd=BASE_DIR,
            env=backend_env
        )
        processes.append(backend_process)

        # 2. Start Frontend (Vite)
        print("   [2/2] Launching Frontend (Vite)...")
        # For Windows, we need shell=True for npm commands
        npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
        frontend_process = subprocess.Popen(
            [npm_cmd, "run", "dev"],
            cwd=FRONTEND_DIR,
            shell=False # Using shell=False is safer if we point directly to npm.cmd
        )
        processes.append(frontend_process)

        print("\n✅ System is running!")
        print("   - Backend: http://127.0.0.1:5000")
        print("   - Frontend: http://localhost:5173")
        print("\nPossible startup delay on backend due to DeepFace model loading.")
        print("Press Ctrl+C to stop all services.\n")

        # Keep the script running to monitor processes
        while True:
            time.sleep(1)
            # Check if any process has crashed
            if backend_process.poll() is not None:
                print("❌ Backend process exited unexpectedly.")
                break
            if frontend_process.poll() is not None:
                print("❌ Frontend process exited unexpectedly.")
                break

    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"Error: {e}")
    finally:
        cleanup(processes)

if __name__ == "__main__":
    run_app()
