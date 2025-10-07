# System Monitoring Notes

## Quick Reference

### CPU Monitoring
- **Status**: ✅ Active
- **Alert Email**: jmedina@surterreproperties.com
- **Threshold**: 80% CPU usage
- **Check Interval**: Every 5 minutes
- **Documentation**: [CPU-MONITORING.md](./CPU-MONITORING.md)

### Commands
```bash
# View monitoring status
tail -f /var/log/cpu-monitor.log

# Check current CPU
top
mpstat

# Historical CPU data
sar

# Force test alert (set threshold to 1%)
sudo sed -i 's/CPU_THRESHOLD=80/CPU_THRESHOLD=1/' /opt/apps/aidin/scripts/monitor-cpu-usage.sh
/opt/apps/aidin/scripts/monitor-cpu-usage.sh
# Don't forget to reset: sudo sed -i 's/CPU_THRESHOLD=1/CPU_THRESHOLD=80/' /opt/apps/aidin/scripts/monitor-cpu-usage.sh
```

### Files
- **Monitor Script**: `/opt/apps/aidin/scripts/monitor-cpu-usage.sh`
- **Email Script**: `/opt/apps/aidin/scripts/send-cpu-alert.cjs`
- **Monitor Log**: `/var/log/cpu-monitor.log`
- **CPU Reports**: `/var/log/cpu-reports/`
- **Cron Job**: `*/5 * * * * /opt/apps/aidin/scripts/monitor-cpu-usage.sh`

### Installed Tools
- **sysstat**: ✅ Installed and enabled
  - `sar` - Historical CPU/memory/IO stats
  - `iostat` - I/O statistics
  - `mpstat` - Multi-processor stats
  - `pidstat` - Process stats

## Alert Email Contents
When CPU exceeds 80%, email includes:
- Current CPU usage percentage
- Top 10 CPU-consuming processes
- Memory usage and top memory consumers
- Disk I/O statistics
- Network connections count
- Load averages
- Docker container status
- PM2 process list
- Recent system logs
- Recommended troubleshooting actions

## Maintenance
- CPU reports auto-delete after 7 days
- Monitor log grows indefinitely (archive manually if needed)
- System uses existing Microsoft Graph API credentials
- No additional authentication setup required

## Future Enhancements (Ideas)
- [ ] Memory usage monitoring (similar to CPU)
- [ ] Disk space monitoring
- [ ] Database performance monitoring
- [ ] Network bandwidth alerts
- [ ] Custom Slack/Teams integration
- [ ] Web dashboard for real-time monitoring

---
Last Updated: 2025-10-07
