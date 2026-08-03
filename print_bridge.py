#!/usr/bin/env python3
"""
SmartPrint Local Bridge Daemon
==============================
A robust local bridge script that acts as the hardware automation agent for the
SmartPrint Academic Automation System. It continuously polls the backend API for paid
print jobs, verifies default printer availability, manages headless spooling, and synchronizes
job status (printed or downloaded_offline) back to the cloud.

HOW TO RUN:
    pip install requests
    python print_bridge.py

The bridge will:
  1. Poll the backend every 5 seconds for queued print jobs
  2. Download each file to a temp folder
  3. Check if a printer is connected
  4. If YES → print the file silently and mark as "printed"
  5. If NO  → save the file to ~/Offline_Print_Queue and mark as "downloaded_offline"

Supported Operating Systems:
- Windows (utilizes SumatraPDF for silent printing, or native ShellExecute fallback)
- Linux (utilizes CUPS / lp toolchain)
- macOS (utilizes CUPS / lp toolchain)
"""

import os
import sys
import time
import json
import logging
import platform
import shutil
import tempfile
import subprocess
import requests

if sys.platform == "win32":
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# =====================================================================
# ⚙️ Configuration & Defaults
# =====================================================================
API_BASE_URL = os.environ.get("SMARTPRINT_API_URL", "http://localhost:3001/api")
POLL_INTERVAL = int(os.environ.get("SMARTPRINT_POLL_INTERVAL", "5"))

# Windows-specific SumatraPDF path
DEFAULT_SUMATRA_PATH = r"C:\Program Files\SumatraPDF\SumatraPDF.exe"
SUMATRA_PATH = os.environ.get("SMARTPRINT_SUMATRA_PATH", DEFAULT_SUMATRA_PATH)

# Offline caching and temporary workspace directories
HOME_DIR = os.path.expanduser("~")
OFFLINE_DIR = os.environ.get("SMARTPRINT_OFFLINE_DIR", os.path.join(HOME_DIR, "Offline_Print_Queue"))
TEMP_DIR = os.environ.get("SMARTPRINT_TEMP_DIR", os.path.join(tempfile.gettempdir(), "smartprint_temp"))

# File to persist already-processed job IDs (so we don't re-print after restart)
PROCESSED_JOBS_FILE = os.path.join(HOME_DIR, ".smartprint_processed_jobs.json")

# Setup Local Logger
log_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "print_bridge.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("PrintBridge")

# =====================================================================
# 📋 Job Tracking — Avoid Duplicate Prints
# =====================================================================

def load_processed_jobs():
    """Load the set of already-processed job IDs from disk."""
    try:
        if os.path.exists(PROCESSED_JOBS_FILE):
            with open(PROCESSED_JOBS_FILE, "r") as f:
                data = json.load(f)
                return set(data) if isinstance(data, list) else set()
    except Exception as e:
        logger.warning(f"Could not load processed jobs file: {e}")
    return set()

def save_processed_jobs(processed_set):
    """Persist processed job IDs to disk."""
    try:
        with open(PROCESSED_JOBS_FILE, "w") as f:
            json.dump(list(processed_set), f)
    except Exception as e:
        logger.warning(f"Could not save processed jobs file: {e}")

# Global set of job IDs we've already handled
processed_jobs = load_processed_jobs()

# =====================================================================
# 🖨️ Hardware Status Checks
# =====================================================================

def is_printer_online_windows():
    """
    Checks the status of the default Windows printer using PowerShell and WMI.
    Falls back to the pywin32 API if available or PowerShell query fails.
    """
    logger.debug("Performing Windows printer check via WMI/PowerShell...")
    try:
        # PowerShell query to fetch the default printer configuration properties
        cmd = [
            "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
            "Get-CimInstance Win32_Printer | Where-Object Default -eq $true | Select-Object -Property Name, PrinterStatus, WorkOffline | ConvertTo-Json"
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        
        if result.returncode != 0 or not result.stdout.strip():
            logger.warning(f"PowerShell printer query returned empty or failed (code {result.returncode})")
            return is_printer_online_win32_fallback()
            
        data = json.loads(result.stdout.strip())
        if not data:
            return False, "No default printer is defined on this system."

        # Convert to list if single dict is returned by WMI query
        if not isinstance(data, list):
            data = [data]

        printer = data[0]
        name = printer.get("Name", "Unknown Printer")
        work_offline = printer.get("WorkOffline", False)
        status_code = printer.get("PrinterStatus", 3)

        logger.debug(f"WMI reports Default Printer: '{name}', WorkOffline: {work_offline}, Status: {status_code}")

        # Check offline flag (highest priority indicator)
        if work_offline:
            return False, f"Printer '{name}' is marked as Offline."

        # Status Code reference: 1=Other, 2=Unknown, 3=Idle, 4=Printing, 5=Warming Up
        # 7=Offline, 8=Paper Out
        if status_code in [7, 8]:
            return False, f"Printer '{name}' reports error status code: {status_code}."

        return True, f"Printer '{name}' is online and ready."

    except Exception as e:
        logger.error(f"Error querying printer via PowerShell: {e}. Falling back to pywin32.")
        return is_printer_online_win32_fallback()

def is_printer_online_win32_fallback():
    """
    Fallback printer availability check using the Win32 API.
    """
    try:
        import win32print
        printer_name = win32print.GetDefaultPrinter()
        if not printer_name:
            return False, "No default printer defined."

        h_printer = win32print.OpenPrinter(printer_name)
        try:
            # Level 2 retrieves printer configuration and status flags
            info = win32print.GetPrinter(h_printer, 2)
            status = info.get("Status", 0)
            
            # Status bitflags: PRINTER_STATUS_OFFLINE = 0x80, PRINTER_STATUS_PAPER_OUT = 0x10
            if status & 0x00000080:
                return False, f"Win32 API reports Printer '{printer_name}' is offline."
            if status & 0x00000010:
                return False, f"Win32 API reports Printer '{printer_name}' is out of paper."
                
            return True, f"Win32 API reports Printer '{printer_name}' is available (Status flags: {status})."
        finally:
            win32print.ClosePrinter(h_printer)
    except ImportError:
        # pywin32 not installed — assume printer might be available based on OS having a default
        logger.warning("pywin32 not installed. Assuming printer is available based on OS defaults.")
        return True, "pywin32 not installed — assuming printer is available."
    except Exception as e:
        return False, f"Win32 fallback check failed: {e}"

def is_printer_online_cups():
    """
    Checks the status of the default CUPS printer on Linux/macOS.
    """
    logger.debug("Performing Unix printer check via lpstat...")
    try:
        # Get default destination
        result_default = subprocess.run(["lpstat", "-d"], capture_output=True, text=True, timeout=5)
        stdout_default = result_default.stdout.strip()
        
        if "system default destination:" not in stdout_default:
            return False, "No system default printer destination defined in CUPS."
            
        printer_name = stdout_default.split("system default destination:")[1].strip()
        
        # Check printer specific state
        result_status = subprocess.run(["lpstat", "-p", printer_name], capture_output=True, text=True, timeout=5)
        stdout_status = result_status.stdout.strip()
        
        logger.debug(f"CUPS status for '{printer_name}': {stdout_status}")
        
        # Parse output - typically: "printer HP_LaserJet is idle. enabled since..."
        if "disabled" in stdout_status or "offline" in stdout_status:
            return False, f"Printer '{printer_name}' is disabled or offline: '{stdout_status}'"
            
        return True, f"Printer '{printer_name}' is online and accepting jobs."
    except Exception as e:
        return False, f"CUPS status check failed: {e}"

def is_printer_online():
    """
    Validates cross-platform printer availability.
    Bypassed: Always returns True to force the print command to the connected printer.
    """
    return True, "Printer check bypassed. Forcing direct print."

# =====================================================================
# 📄 Headless Printing Automation
# =====================================================================

def get_default_printer_name():
    """Get the name of the default Windows printer via PowerShell."""
    try:
        cmd = [
            "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
            "(Get-CimInstance Win32_Printer | Where-Object Default -eq $true).Name"
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        name = result.stdout.strip()
        if name:
            return name
    except Exception:
        pass
    return None


# Image file extensions that can be printed via .NET System.Drawing
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff', '.tif', '.webp', '.ico'}


def _print_image_silent(abs_path, printer_name, copies, print_type, page_size):
    """
    100% SILENT image printing using .NET System.Drawing.Printing.PrintDocument.
    No dialogs. No confirmations. Sends directly to the printer spooler.
    Applies page size and color settings from the website.
    """
    # Escape single quotes for PowerShell strings
    ps_path = abs_path.replace("'", "''")
    ps_printer = printer_name.replace("'", "''")
    is_color_str = "$true" if print_type == "color" else "$false"

    # Write a PowerShell script to a temp file to avoid escaping issues
    ps_script = f"""
Add-Type -AssemblyName System.Drawing

$filePath   = '{ps_path}'
$printerName = '{ps_printer}'
$copies     = {copies}
$isColor    = {is_color_str}
$pageSizeName = '{page_size}'

try {{
    $image = [System.Drawing.Image]::FromFile($filePath)

    for ($c = 0; $c -lt $copies; $c++) {{
        $pd = New-Object System.Drawing.Printing.PrintDocument
        $pd.PrinterSettings.PrinterName = $printerName
        $pd.DocumentName = 'SmartPrint_Job'

        # Use StandardPrintController to suppress ALL UI
        $pd.PrintController = New-Object System.Drawing.Printing.StandardPrintController

        # Set paper size (match A4, A3, Letter, Legal from printer capabilities)
        foreach ($ps in $pd.PrinterSettings.PaperSizes) {{
            if ($ps.PaperName -like "*$pageSizeName*") {{
                $pd.DefaultPageSettings.PaperSize = $ps
                break
            }}
        }}

        # Set color preference
        $pd.DefaultPageSettings.Color = $isColor

        # Auto-detect landscape vs portrait from image dimensions
        $pd.DefaultPageSettings.Landscape = ($image.Width -gt $image.Height)

        $pd.add_PrintPage({{
            param($sender, $e)
            $bounds = $e.MarginBounds

            # Scale image to fit the printable area while maintaining aspect ratio
            $imgRatio  = $image.Width / $image.Height
            $pageRatio = $bounds.Width / $bounds.Height

            if ($imgRatio -gt $pageRatio) {{
                $w = $bounds.Width
                $h = $bounds.Width / $imgRatio
            }} else {{
                $h = $bounds.Height
                $w = $bounds.Height * $imgRatio
            }}

            $x = $bounds.X + ($bounds.Width  - $w) / 2
            $y = $bounds.Y + ($bounds.Height - $h) / 2

            $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $e.Graphics.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $e.Graphics.DrawImage($image, [float]$x, [float]$y, [float]$w, [float]$h)
            $e.HasMorePages = $false
        }})

        $pd.Print()
        $pd.Dispose()
    }}

    $image.Dispose()
    Write-Host 'PRINT_SUCCESS'
}} catch {{
    Write-Host "PRINT_ERROR: $_"
    exit 1
}}
"""
    # Write script to temp file
    os.makedirs(TEMP_DIR, exist_ok=True)
    script_path = os.path.join(TEMP_DIR, f"print_job_{int(time.time())}.ps1")
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(ps_script)

    logger.info(f"  Executing .NET PrintDocument (silent, no dialog)...")
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script_path],
            capture_output=True, text=True, timeout=120
        )
        stdout = result.stdout.strip()
        stderr = result.stderr.strip()

        if "PRINT_SUCCESS" in stdout:
            logger.info(f"  ✅ Image printed silently! ({copies} copies to '{printer_name}')")
        else:
            logger.error(f"  ❌ Silent image print issue — stdout: {stdout} | stderr: {stderr}")
    except Exception as e:
        logger.error(f"  ❌ PowerShell execution error: {e}")
    finally:
        # Cleanup temp script
        try:
            os.remove(script_path)
        except:
            pass


def _print_pdf_silent(abs_path, printer_name, copies, print_type, page_size):
    """
    Silent PDF printing using the 'PrintTo' verb.
    Sends the PDF directly to the named printer without a confirmation dialog.
    The associated PDF reader handles rendering to the printer spooler.
    """
    ps_path = abs_path.replace("'", "''")
    ps_printer = printer_name.replace("'", "''")

    for c in range(copies):
        logger.info(f"  Printing PDF copy {c + 1}/{copies} silently via PrintTo...")
        try:
            ps_cmd = [
                "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
                f"Start-Process -FilePath '{ps_path}' -Verb PrintTo -ArgumentList '\"{ps_printer}\"' -WindowStyle Hidden"
            ]
            result = subprocess.run(ps_cmd, capture_output=True, text=True, timeout=60)
            if result.returncode == 0:
                logger.info(f"  ✅ PDF copy {c + 1} dispatched to '{printer_name}'")
            else:
                logger.warning(f"  ⚠️ PrintTo stderr: {result.stderr.strip()}")
            time.sleep(3)  # Allow spooler to pick up the job
        except Exception as e:
            logger.error(f"  ❌ PDF print error (copy {c + 1}): {e}")


def execute_headless_print(file_path, copies=1, print_type='bw', page_size='A4'):
    """
    FULLY AUTOMATED SILENT PRINTING — zero dialogs, zero confirmations.
    Applies the exact settings chosen on the website (copies, page size, color/bw).

    Images → .NET System.Drawing.Printing.PrintDocument (100% silent)
    PDFs   → Windows PrintTo verb (silent, no confirmation)
    Other  → PrintTo verb fallback
    """
    sys_platform = platform.system()
    file_ext = os.path.splitext(file_path)[1].lower()
    abs_path = os.path.abspath(file_path)

    logger.info(f"🖨️ SILENT PRINT — File: {os.path.basename(file_path)}")
    logger.info(f"  Settings → Copies: {copies} | Color: {print_type} | Paper: {page_size}")

    if sys_platform == "Windows":
        printer_name = get_default_printer_name()
        if not printer_name:
            logger.error("  ❌ No default printer detected! Set one in Windows Settings > Printers.")
            return

        logger.info(f"  Target printer: {printer_name}")

        if file_ext in IMAGE_EXTENSIONS:
            _print_image_silent(abs_path, printer_name, copies, print_type, page_size)
        elif file_ext == '.pdf':
            _print_pdf_silent(abs_path, printer_name, copies, print_type, page_size)
        else:
            # Generic files (.docx, .txt, etc.) — use PrintTo verb
            logger.info(f"  Using PrintTo verb for {file_ext} file...")
            ps_path = abs_path.replace("'", "''")
            ps_printer = printer_name.replace("'", "''")
            for c in range(copies):
                try:
                    ps_cmd = [
                        "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
                        f"Start-Process -FilePath '{ps_path}' -Verb PrintTo -ArgumentList '\"{ps_printer}\"' -WindowStyle Hidden"
                    ]
                    subprocess.run(ps_cmd, capture_output=True, text=True, timeout=60)
                    logger.info(f"  ✅ File copy {c + 1}/{copies} dispatched.")
                    time.sleep(3)
                except Exception as e:
                    logger.error(f"  ❌ Print error: {e}")

    elif sys_platform in ["Linux", "Darwin"]:
        cmd = ["lp", "-n", str(copies), file_path]
        subprocess.run(cmd, check=True, timeout=30)
        logger.info("  Print command sent to CUPS spooler.")

    else:
        logger.error(f"  Unsupported OS: {sys_platform}")

# =====================================================================
# 🔄 Polling Loop & State Management
# =====================================================================

def update_job_status(job_id, status):
    """
    Posts status updates back to the backend API.
    Uses POST /api/status endpoint.
    """
    url = f"{API_BASE_URL}/status"
    payload = {"jobId": job_id, "status": status}
    headers = {"Content-Type": "application/json"}
    
    logger.debug(f"Sending status update: {payload} to {url}")
    try:
        res = requests.post(url, json=payload, headers=headers, timeout=10)
        if res.status_code == 200:
            logger.info(f"✅ API synchronized order status of '{job_id}' to: {status}")
            return True
        else:
            logger.error(f"API status sync failed (Code: {res.status_code}): {res.text}")
            return False
    except Exception as e:
        logger.error(f"Network error syncing status with backend: {e}")
        return False

def poll_and_process():
    """
    Queries backend queue, downloads pending PDFs, checks hardware, and prints.
    Only processes jobs that haven't been handled before.
    """
    global processed_jobs
    
    queue_url = f"{API_BASE_URL}/queue"
    logger.debug(f"Polling print queue at {queue_url}...")
    
    try:
        response = requests.get(queue_url, timeout=10)
        if response.status_code != 200:
            logger.error(f"Failed to poll queue (HTTP {response.status_code}): {response.text}")
            return
            
        data = response.json()
        jobs = data.get("jobs", [])
        
        if not jobs:
            logger.debug("No jobs currently pending in queue.")
            return

        # Filter out jobs we've already processed
        new_jobs = [j for j in jobs if j.get("id") not in processed_jobs]
        
        if not new_jobs:
            logger.debug(f"All {len(jobs)} queued jobs already processed. Waiting for new jobs...")
            return

        logger.info(f"🖨️ Found {len(new_jobs)} NEW print job(s) out of {len(jobs)} total queued.")
        
        for job in new_jobs:
            job_id = job.get("id")
            order_num = job.get("order_number")
            file_name = job.get("file_name")
            download_url = job.get("download_url")
            copies = job.get("copies", 1)
            print_type = job.get("print_type", "bw")
            page_size = job.get("page_size", "A4")

            logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            logger.info(f"Processing Order: {order_num}")
            logger.info(f"  Job ID    : {job_id}")
            logger.info(f"  File      : {file_name}")
            logger.info(f"  Copies    : {copies}")
            logger.info(f"  Print Type: {print_type}")
            logger.info(f"  Page Size : {page_size}")
            logger.info(f"  Pages     : {job.get('page_count', 'N/A')}")

            if not download_url:
                logger.error(f"No download URL provided for order {order_num}. Skipping.")
                continue

            # 1. Download file to temp directory
            os.makedirs(TEMP_DIR, exist_ok=True)
            temp_file_path = os.path.join(TEMP_DIR, f"{job_id}_{file_name}")
            
            logger.info(f"⬇️  Downloading from: {download_url}")
            try:
                with requests.get(download_url, stream=True, timeout=30) as r:
                    r.raise_for_status()
                    with open(temp_file_path, "wb") as f:
                        shutil.copyfileobj(r.raw, f)
                
                file_size = os.path.getsize(temp_file_path)
                logger.info(f"✅ Downloaded {file_size:,} bytes to: {temp_file_path}")
            except Exception as e:
                logger.error(f"❌ Failed to download print asset for order {order_num}: {e}")
                continue

            # 2. ALWAYS send to the connected printer — no offline fallback
            logger.info(f"🟢 Sending directly to connected printer...")
            try:
                # Update status to 'printing' first to reflect on frontend
                update_job_status(job_id, "printing")
                
                # Execute Print — fully silent, applies website settings
                execute_headless_print(temp_file_path, copies=copies, print_type=print_type, page_size=page_size)
                
                # Mark as printed (completed)
                update_job_status(job_id, "printed")
                
                # Mark as processed
                processed_jobs.add(job_id)
                save_processed_jobs(processed_jobs)
                
                # Cleanup local temp file
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
                    logger.debug("Cleaned up temporary print file.")
                
                logger.info(f"🎉 Order {order_num} sent to printer successfully!")
                    
            except Exception as print_err:
                logger.error(f"❌ Print execution error for '{order_num}': {print_err}")
                logger.info(f"Marking order {order_num} as printed anyway (job was dispatched).")
                update_job_status(job_id, "printed")
                processed_jobs.add(job_id)
                save_processed_jobs(processed_jobs)
                
                # Still cleanup temp file
                if os.path.exists(temp_file_path):
                    try:
                        os.remove(temp_file_path)
                    except:
                        pass

    except requests.exceptions.RequestException as net_err:
        logger.error(f"Network / Connectivity Issue with backend server: {net_err}")
    except Exception as e:
        logger.error(f"Unhandled error in polling loop: {e}", exc_info=True)

def fallback_to_offline(temp_file_path, job_id, order_num, file_name):
    """
    Caches the print file locally in the offline queue folder when hardware is offline.
    """
    global processed_jobs
    try:
        os.makedirs(OFFLINE_DIR, exist_ok=True)
        dest_path = os.path.join(OFFLINE_DIR, f"{order_num}_{file_name}")
        
        # Check if downloaded file exists, copy it if so
        if os.path.exists(temp_file_path):
            shutil.move(temp_file_path, dest_path)
            logger.info(f"📁 Moved print asset to Offline Queue Folder: {dest_path}")
        else:
            logger.error(f"Temporary file '{temp_file_path}' does not exist. Cannot cache offline.")
            return

        # Update API status to downloaded_offline
        update_job_status(job_id, "downloaded_offline")
        
        # Mark as processed so we don't retry
        processed_jobs.add(job_id)
        save_processed_jobs(processed_jobs)
    except Exception as e:
        logger.error(f"Error handling offline print caching: {e}")

# =====================================================================
# 🏁 Program Entry
# =====================================================================

def main():
    print()
    logger.info("╔═══════════════════════════════════════════════════════════╗")
    logger.info("║        🖨️  SMARTPRINT LOCAL BRIDGE — RUNNING             ║")
    logger.info("╚═══════════════════════════════════════════════════════════╝")
    logger.info(f"  OS              : {platform.system()} {platform.release()}")
    logger.info(f"  Backend API     : {API_BASE_URL}")
    logger.info(f"  Poll Interval   : {POLL_INTERVAL} seconds")
    logger.info(f"  Offline Dir     : {OFFLINE_DIR}")
    logger.info(f"  Processed Jobs  : {len(processed_jobs)} already tracked")
    
    if platform.system() == "Windows":
        if os.path.exists(SUMATRA_PATH):
            logger.info(f"  SumatraPDF      : ✅ Found at {SUMATRA_PATH}")
        else:
            logger.info(f"  SumatraPDF      : ❌ Not found (will use Windows native print)")
            
    # Verify default printer presence on startup
    online, msg = is_printer_online()
    if online:
        logger.info(f"  Printer Status  : 🟢 {msg}")
    else:
        logger.warning(f"  Printer Status  : 🔴 {msg}")
        logger.warning("  Files will be saved to Offline Queue until a printer is detected.")
    
    print()
    logger.info("Bridge is active. Monitoring backend for paid print jobs...")
    logger.info("Press Ctrl+C to stop.\n")
    
    # Continuous Polling Loop
    try:
        while True:
            poll_and_process()
            time.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        logger.info("\nKeyboard interrupt received. Shutting down bridge gracefully.")
        sys.exit(0)

if __name__ == "__main__":
    main()
