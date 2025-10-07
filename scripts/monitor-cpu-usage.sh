#!/bin/bash

# CPU Monitoring Script
# Sends email alert when CPU usage exceeds threshold
# Alert recipient: jmedina@surterreproperties.com

# Configuration
CPU_THRESHOLD=80  # Alert if CPU usage exceeds 80%
ALERT_EMAIL="jmedina@surterreproperties.com"
HOSTNAME=$(hostname)
SCRIPT_DIR="/opt/apps/aidin/scripts"
LOG_FILE="/var/log/cpu-monitor.log"

# Get current CPU usage (average across all cores)
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
CPU_USAGE_INT=${CPU_USAGE%.*}  # Convert to integer

# Log timestamp
echo "[$(date '+%Y-%m-%d %H:%M:%S')] CPU Usage: ${CPU_USAGE}%" >> "$LOG_FILE"

# Check if CPU usage exceeds threshold
if [ "$CPU_USAGE_INT" -gt "$CPU_THRESHOLD" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  HIGH CPU ALERT: ${CPU_USAGE}% (threshold: ${CPU_THRESHOLD}%)" >> "$LOG_FILE"

    # Collect detailed system information
    REPORT_FILE="/tmp/cpu-report-$(date +%s).txt"

    cat > "$REPORT_FILE" << EOF
CPU USAGE ALERT - $HOSTNAME
=================================
Alert Time: $(date '+%Y-%m-%d %H:%M:%S %Z')
Current CPU Usage: ${CPU_USAGE}%
Threshold: ${CPU_THRESHOLD}%

SYSTEM OVERVIEW
=================================
$(uptime)

CPU DETAILS
=================================
$(mpstat -P ALL 1 1)

TOP 10 CPU-CONSUMING PROCESSES
=================================
$(ps aux --sort=-%cpu | head -11)

MEMORY USAGE
=================================
$(free -h)

TOP 10 MEMORY-CONSUMING PROCESSES
=================================
$(ps aux --sort=-%mem | head -11)

DISK I/O STATISTICS
=================================
$(iostat -x 1 2 | tail -20)

ACTIVE CONNECTIONS
=================================
$(ss -ant | grep ESTAB | wc -l) established connections

LOAD AVERAGE
=================================
$(cat /proc/loadavg)

RUNNING DOCKER CONTAINERS
=================================
$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.CPUPerc}}\t{{.MemPerc}}" 2>/dev/null || echo "Docker not available")

PM2 PROCESSES
=================================
$(npx pm2 list 2>/dev/null || echo "PM2 not available")

RECENT SYSTEM LOGS (last 20 lines)
=================================
$(journalctl -n 20 --no-pager)

---
This is an automated alert from the AidIN Helpdesk monitoring system.
Server: $HOSTNAME
EOF

    # Send email alert using Node.js script
    node "$SCRIPT_DIR/send-cpu-alert.cjs" "$ALERT_EMAIL" "$REPORT_FILE"

    # Keep report for 7 days for debugging
    mv "$REPORT_FILE" "/var/log/cpu-reports/"

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Alert email sent to $ALERT_EMAIL" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] CPU usage normal" >> "$LOG_FILE"
fi

# Clean up old reports (older than 7 days)
find /var/log/cpu-reports/ -type f -mtime +7 -delete 2>/dev/null

exit 0
