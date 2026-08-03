import os
import subprocess
import time
import sys
import webbrowser
import signal

if sys.platform == "win32":
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# ========================================================
# 🖨️ SmartPrint Academic Workspace Runner
# ========================================================

backend_process = None
frontend_process = None
print_bridge_process = None

def cleanup_processes(signum=None, frame=None):
    """Gracefully terminate backend and frontend servers on exit."""
    print("\n[Runner] Shutting down development servers...")
    
    if backend_process:
        try:
            print("[Runner] Stopping backend server...")
            backend_process.terminate()
        except Exception as e:
            print(f"Error stopping backend: {e}")
            
    if frontend_process:
        try:
            print("[Runner] Stopping frontend server...")
            frontend_process.terminate()
        except Exception as e:
            print(f"Error stopping frontend: {e}")
            
    if print_bridge_process:
        try:
            print("[Runner] Stopping print bridge...")
            print_bridge_process.terminate()
        except Exception as e:
            print(f"Error stopping print bridge: {e}")
            
    sys.exit(0)

# Register termination signals (Ctrl+C, termination)
signal.signal(signal.SIGINT, cleanup_processes)
signal.signal(signal.SIGTERM, cleanup_processes)

def main():
    global backend_process, frontend_process, print_bridge_process

    # Resolve paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(base_dir, "backend")
    frontend_dir = os.path.join(base_dir, "frontend")

    # Ensure Node.js is present in PATH for Windows subprocesses
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    node_dir = r"C:\Program Files\nodejs"
    if os.path.exists(node_dir) and node_dir not in env.get("PATH", ""):
        env["PATH"] = node_dir + os.pathsep + env.get("PATH", "")

    print("========================================================")
    print("         [Printer]  SMARTPRINT ACADEMIC WORKSPACE HUB")
    print("========================================================")
    print()

    # Determine command prefix based on platform (Windows uses shell=True for npm commands)
    use_shell = sys.platform == "win32"

    # Start Backend
    print("[1/3] Starting backend Express server on port 3001...")
    try:
        backend_process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=backend_dir,
            shell=use_shell,
            env=env
        )
    except Exception as e:
        print(f"Failed to start backend: {e}")
        cleanup_processes()

    # Start Frontend
    print("[2/3] Starting frontend Vite server on port 5173...")
    try:
        frontend_process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=frontend_dir,
            shell=use_shell,
            env=env
        )
    except Exception as e:
        print(f"Failed to start frontend: {e}")
        cleanup_processes()

    # Start Print Bridge
    print("[3/4] Starting local print bridge...")
    try:
        print_bridge_process = subprocess.Popen(
            [sys.executable, "print_bridge.py"],
            cwd=base_dir,
            env=env
        )
    except Exception as e:
        print(f"Failed to start print bridge: {e}")
        cleanup_processes()

    print()
    print("Waiting 4 seconds for servers to initialize...")
    time.sleep(4)

    # Open Browser
    print("[4/4] Launching print portal in default browser...")
    webbrowser.open("http://localhost:5173")

    print("\n========================================================")
    print("  🚀 SmartPrint is running!")
    print("========================================================")
    print()
    print("  Frontend  → http://localhost:5173")
    print("  Backend   → http://localhost:3001")
    print("  API Health→ http://localhost:3001/api/health")
    print()
    print("========================================================")
    print("  Press Ctrl+C to stop all servers.")
    print("========================================================")

    # Keep script alive and watch processes
    try:
        while True:
            # Check if processes crashed
            if backend_process.poll() is not None:
                print("\n[Warning] Backend process exited unexpectedly.")
                break
            if frontend_process.poll() is not None:
                print("\n[Warning] Frontend process exited unexpectedly.")
                break
            if print_bridge_process and print_bridge_process.poll() is not None:
                print("\n[Warning] Print bridge process exited unexpectedly.")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        cleanup_processes()

if __name__ == "__main__":
    main()
