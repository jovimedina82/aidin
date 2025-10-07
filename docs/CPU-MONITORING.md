# CPU Monitoring & Alert System

## Overview
Automated CPU monitoring system that sends email alerts to IT staff when CPU usage exceeds configured thresholds.

## Configuration

### Alert Settings
- **Threshold**: 80% CPU usage
- **Check Interval**: Every 5 minutes
- **Alert Recipient**: jmedina@surterreproperties.com
- **Alert Method**: Email via Microsoft Graph API

### Files & Locations
```
/opt/apps/aidin/scripts/monitor-cpu-usage.sh    # Main monitoring script
/opt/apps/aidin/scripts/send-cpu-alert.cjs       # Email sending script
/var/log/cpu-monitor.log                         # Monitoring log
/var/log/cpu-reports/                            # Detailed reports (kept 7 days)
```

## How It Works

### Monitoring Process
1. **Cron Job** runs every 5 minutes
2. **Script checks** current CPU usage
3. **If threshold exceeded**:
   - Collects detailed system information
   - Generates comprehensive report
   - Sends email alert with report
   - Logs event

### Email Alert Contains
- Current CPU usage percentage
- Top 10 CPU-consuming processes
- Memory usage statistics
- Top 10 memory-consuming processes
- Disk I/O statistics
- Active network connections
- Load averages
- Docker container status
- PM2 process status
- Recent system logs
- Recommended actions

## Modifying Configuration

### Change CPU Threshold
Edit `/opt/apps/aidin/scripts/monitor-cpu-usage.sh`:
```bash
CPU_THRESHOLD=80  # Change this value (default: 80%)
```

### Change Alert Recipient
Edit `/opt/apps/aidin/scripts/monitor-cpu-usage.sh`:
```bash
ALERT_EMAIL="jmedina@surterreproperties.com"  # Change email here
```

### Change Check Interval
Edit crontab:
```bash
sudo crontab -e
```
Current setting:
```
*/5 * * * *   # Every 5 minutes
```
Options:
```
*/1 * * * *   # Every 1 minute
*/10 * * * *  # Every 10 minutes
*/15 * * * *  # Every 15 minutes
0 * * * *     # Every hour
```

## Manual Testing

### Test Monitoring Script
```bash
/opt/apps/aidin/scripts/monitor-cpu-usage.sh
```

### View Monitoring Log
```bash
tail -f /var/log/cpu-monitor.log
```

### View Recent Reports
```bash
ls -lh /var/log/cpu-reports/
cat /var/log/cpu-reports/cpu-report-*.txt
```

### Force Alert (for testing)
Temporarily lower threshold to 1% to trigger alert:
```bash
sudo sed -i 's/CPU_THRESHOLD=80/CPU_THRESHOLD=1/' /opt/apps/aidin/scripts/monitor-cpu-usage.sh
/opt/apps/aidin/scripts/monitor-cpu-usage.sh
# Reset threshold
sudo sed -i 's/CPU_THRESHOLD=1/CPU_THRESHOLD=80/' /opt/apps/aidin/scripts/monitor-cpu-usage.sh
```

## Checking System Performance

### Real-time CPU Monitoring
```bash
# Interactive top
top

# CPU stats every 2 seconds
mpstat 2

# Watch CPU usage
watch -n 2 "mpstat | tail -3"
```

### Historical CPU Data (sysstat)
```bash
# Today's CPU usage
sar

# Yesterday's CPU usage
sar -f /var/log/sysstat/sa$(date -d yesterday +%d)

# CPU usage at specific time
sar -s 14:00:00 -e 16:00:00

# CPU per core
sar -P ALL
```

### Identify CPU-Heavy Processes
```bash
# Top 10 CPU consumers
ps aux --sort=-%cpu | head -11

# Continuous monitoring
top -b -o %CPU | head -20

# PM2 processes with CPU
npx pm2 list
npx pm2 monit
```

## Troubleshooting

### No Alerts Received
1. Check monitoring log:
   ```bash
   tail -20 /var/log/cpu-monitor.log
   ```

2. Verify cron job is active:
   ```bash
   sudo crontab -l | grep cpu-monitor
   ```

3. Test email sending manually:
   ```bash
   echo "Test report" > /tmp/test-report.txt
   node /opt/apps/aidin/scripts/send-cpu-alert.cjs jmedina@surterreproperties.com /tmp/test-report.txt
   ```

4. Check Azure AD credentials in `.env`:
   ```bash
   cd /opt/apps/aidin
   grep AZURE_AD .env
   ```

### High CPU Issues

#### Common Causes
1. **Node.js/Next.js processes** - Check PM2 for memory leaks
2. **Docker containers** - Check with `docker stats`
3. **Database queries** - Check slow query logs
4. **Background jobs** - Check cron jobs and schedulers
5. **System updates** - Check `apt` or `unattended-upgrades`

#### Quick Fixes
```bash
# Restart PM2 processes
npx pm2 restart all

# Restart Docker containers
docker-compose -f /opt/apps/aidin/docker-compose.yml restart

# Check for zombie processes
ps aux | grep -i defunct

# Clear system cache (safe)
sudo sync && echo 3 | sudo tee /proc/sys/vm/drop_caches
```

## Maintenance

### Log Rotation
Logs are automatically managed:
- **Monitoring log**: Grows indefinitely (manually archive if needed)
- **Detailed reports**: Auto-deleted after 7 days

Manual cleanup:
```bash
# Archive old monitoring logs
sudo gzip /var/log/cpu-monitor.log
sudo touch /var/log/cpu-monitor.log

# Clean old reports manually
sudo find /var/log/cpu-reports/ -type f -mtime +7 -delete
```

### Disable Monitoring
```bash
# Remove cron job
sudo crontab -l | grep -v cpu-monitor | sudo crontab -

# Or comment it out
sudo crontab -e
# Add # before the line
```

### Re-enable Monitoring
```bash
# Add back to crontab
echo "*/5 * * * * /opt/apps/aidin/scripts/monitor-cpu-usage.sh >> /var/log/cpu-monitor.log 2>&1" | sudo crontab -
```

## Alert History

View all alerts sent:
```bash
grep "HIGH CPU ALERT" /var/log/cpu-monitor.log
```

Count alerts by day:
```bash
grep "HIGH CPU ALERT" /var/log/cpu-monitor.log | awk '{print $1}' | sort | uniq -c
```

## Email Configuration

The alert system uses the existing Microsoft Graph API configuration from the AidIN Helpdesk system:
- **From**: helpdesk@surterreproperties.com
- **Authentication**: Azure AD (client credentials flow)
- **Environment variables**: Loaded from `/opt/apps/aidin/.env`

No additional email configuration required.

## Best Practices

1. **Monitor the monitor**: Regularly check the log to ensure alerts are working
2. **Tune thresholds**: Adjust based on your server's normal operating range
3. **Review alerts**: Investigate each alert to identify patterns
4. **Document changes**: Note any configuration changes in git
5. **Test regularly**: Send test alerts monthly to verify system works

## Support

For issues or questions:
- **Email**: helpdesk@surterreproperties.com
- **Logs**: `/var/log/cpu-monitor.log`
- **Scripts**: `/opt/apps/aidin/scripts/`
