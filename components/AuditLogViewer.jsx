'use client';

import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Download, Search, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [chainStatus, setChainStatus] = useState('unknown');
  const [availableActions, setAvailableActions] = useState([]);

  // Filters
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [action, setAction] = useState('');
  const [actorEmail, setActorEmail] = useState('');
  const [actorType, setActorType] = useState('');
  const [entityType, setEntityType] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 100;

  // Fetch audit logs
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate.toISOString());
      if (endDate) params.set('endDate', endDate.toISOString());
      if (action) params.set('action', action);
      if (actorEmail) params.set('actorEmail', actorEmail);
      if (actorType) params.set('actorType', actorType);
      if (entityType) params.set('entityType', entityType);
      params.set('limit', limit.toString());
      params.set('offset', offset.toString());

      const res = await fetch(`/api/admin/audit?${params}`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');

      const data = await res.json();
      setLogs(data.data);
      setTotal(data.total);
    } catch (error) {
      // console.error('Error fetching logs:', error);
      toast.error('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  // Verify chain
  const verifyChain = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates for verification');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/audit/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      });

      if (!res.ok) throw new Error('Verification failed');

      const result = await res.json();
      setChainStatus(result.status);

      if (result.status === 'valid') {
        toast.success(`Chain verified: ${result.totalEntries} entries valid`);
      } else {
        toast.error(`Chain broken at entry ${result.firstFailureId}`);
      }
    } catch (error) {
      // console.error('Error verifying chain:', error);
      toast.error('Failed to verify chain');
    } finally {
      setLoading(false);
    }
  };

  // Export logs
  const exportLogs = async (format) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate.toISOString());
      if (endDate) params.set('endDate', endDate.toISOString());
      if (action) params.set('action', action);
      if (actorEmail) params.set('actorEmail', actorEmail);
      if (entityType) params.set('entityType', entityType);
      params.set('format', format);

      const res = await fetch(`/api/admin/audit/export?${params}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString()}.${format === 'csv' ? 'csv' : 'jsonl'}`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success(`Exported ${format.toUpperCase()} successfully`);
    } catch (error) {
      // console.error('Error exporting logs:', error);
      toast.error('Failed to export logs');
    }
  };

  // Fetch available actions
  const fetchActions = async () => {
    try {
      const res = await fetch('/api/admin/audit/actions');
      if (!res.ok) throw new Error('Failed to fetch actions');
      const data = await res.json();
      setAvailableActions(data.actions);
    } catch (error) {
      // console.error('Error fetching actions:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [offset, startDate, endDate, action, actorEmail, actorType, entityType]);

  useEffect(() => {
    fetchActions();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Audit Log Viewer
          </h3>
          <p className="text-sm text-muted-foreground">
            Tamper-evident append-only audit trail
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportLogs('jsonl')}>
            <Download className="mr-2 h-4 w-4" />
            Export JSONL
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportLogs('csv')}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm" onClick={verifyChain} disabled={loading}>
            {chainStatus === 'valid' ? (
              <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
            ) : chainStatus === 'invalid' ? (
              <AlertTriangle className="mr-2 h-4 w-4 text-red-600" />
            ) : (
              <Shield className="mr-2 h-4 w-4" />
            )}
            Verify Chain
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter audit log entries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium block mb-2">Start Date</label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                showTimeSelect
                dateFormat="Pp"
                placeholderText="Select start date"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                isClearable
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">End Date</label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                showTimeSelect
                dateFormat="Pp"
                placeholderText="Select end date"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                isClearable
              />
            </div>
            <div>
              <label className="text-sm font-medium">Action</label>
              <Select value={action || "all"} onValueChange={(val) => setAction(val === "all" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {availableActions.map((actionName) => (
                    <SelectItem key={actionName} value={actionName}>
                      {actionName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Actor Email</label>
              <Input
                placeholder="Filter by actor"
                value={actorEmail}
                onChange={(e) => setActorEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Actor Type</label>
              <Select value={actorType || "all"} onValueChange={(val) => setActorType(val === "all" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="human">Human</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Entity Type</label>
              <Select value={entityType || "all"} onValueChange={(val) => setEntityType(val === "all" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="ticket">Ticket</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="comment">Comment</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="setting">Setting</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={fetchLogs} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setStartDate(null);
                setEndDate(null);
                setAction('');
                setActorEmail('');
                setActorType('');
                setEntityType('');
                setOffset(0);
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Entries ({total} total)</CardTitle>
          <CardDescription>
            Showing {offset + 1} - {Math.min(offset + limit, total)} of {total}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-sm min-w-[160px]">Timestamp</TableHead>
                  <TableHead className="text-sm min-w-[120px]">Action</TableHead>
                  <TableHead className="text-sm min-w-[180px]">Actor</TableHead>
                  <TableHead className="text-sm w-20">Type</TableHead>
                  <TableHead className="text-sm min-w-[140px] max-w-[200px]">Entity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="text-sm min-w-[160px]">
                      {new Date(log.ts).toLocaleString()}
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      <Badge variant="outline" className="text-xs">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm min-w-[180px]">{log.actorEmail}</TableCell>
                    <TableCell className="w-20">
                      <Badge
                        variant={
                          log.actorType === 'human'
                            ? 'default'
                            : log.actorType === 'system'
                            ? 'secondary'
                            : 'outline'
                        }
                        className="text-xs"
                      >
                        {log.actorType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm min-w-[140px] max-w-[200px]">
                      {log.entityType === 'comment' && log.metadata?.ticketNumber ? (
                        <div className="flex flex-col">
                          <span className="truncate">{log.entityType}: {log.entityId.substring(0, 8)}...</span>
                          <span className="text-xs text-muted-foreground">
                            Ticket: {log.metadata.ticketNumber}
                          </span>
                        </div>
                      ) : (
                        <span className="truncate" title={`${log.entityType}: ${log.entityId}`}>
                          {log.entityType}: {log.entityId.length > 15 ? log.entityId.substring(0, 12) + '...' : log.entityId}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit) || 1}
            </span>
            <Button
              variant="outline"
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedLog && (
            <>
              <SheetHeader>
                <SheetTitle>Audit Log Entry</SheetTitle>
                <SheetDescription>
                  {new Date(selectedLog.ts).toLocaleString()}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                {/* Show comment summary for comment actions */}
                {selectedLog.action === 'comment.created' && selectedLog.metadata?.commentSummary && (
                  <div className="bg-muted p-3 rounded-md">
                    <h3 className="font-semibold text-sm mb-2">Comment Summary</h3>
                    <p className="text-sm">
                      {selectedLog.metadata.commentSummary}
                      {selectedLog.newValues?.contentLength > 200 && '...'}
                    </p>
                    {selectedLog.metadata?.ticketNumber && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Ticket: {selectedLog.metadata.ticketNumber}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">Action</h3>
                  <Badge>{selectedLog.action}</Badge>
                </div>
                <div>
                  <h3 className="font-semibold">Actor</h3>
                  <p>{selectedLog.actorEmail}</p>
                  <Badge variant="secondary" className="mt-1">
                    {selectedLog.actorType}
                  </Badge>
                </div>
                <div>
                  <h3 className="font-semibold">Entity</h3>
                  <p>
                    {selectedLog.entityType}: {selectedLog.entityId}
                  </p>
                </div>
                {selectedLog.ip && (
                  <div>
                    <h3 className="font-semibold">IP Address</h3>
                    <p className="text-sm">{selectedLog.ip}</p>
                  </div>
                )}
                {selectedLog.prevValues && (
                  <div>
                    <h3 className="font-semibold">Previous Values</h3>
                    <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.prevValues, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.newValues && (
                  <div>
                    <h3 className="font-semibold">New Values</h3>
                    <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.newValues, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.metadata && (
                  <div>
                    <h3 className="font-semibold">Metadata</h3>
                    <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">Hash Chain</h3>
                  <p className="text-xs font-mono break-all">{selectedLog.hash}</p>
                  {selectedLog.prevHash && (
                    <p className="text-xs font-mono break-all text-muted-foreground mt-1">
                      Prev: {selectedLog.prevHash}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
