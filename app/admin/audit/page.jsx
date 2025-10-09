/**
 * Admin-only Audit Log Viewer
 * Path: /admin/audit
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Download, Search, Shield, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function AuditLogPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [chainStatus, setChainStatus] = useState('unknown');

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [action, setAction] = useState('');
  const [actorEmail, setActorEmail] = useState('');
  const [actorType, setActorType] = useState('');
  const [entityType, setEntityType] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 100;

  // Check admin access
  useEffect(() => {
    if (!user) return;

    const userRoleNames = user?.roles?.map((role) =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    ) || [];

    const isAdmin = userRoleNames.some((role) => ['Admin', 'Manager'].includes(role));

    if (!isAdmin) {
      router.push('/dashboard');
      toast.error('Access denied: Admin role required');
    }
  }, [user, router]);

  // Fetch audit logs
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', new Date(startDate).toISOString());
      if (endDate) params.set('endDate', new Date(endDate).toISOString());
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
      console.error('Error fetching logs:', error);
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
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
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
      console.error('Error verifying chain:', error);
      toast.error('Failed to verify chain');
    } finally {
      setLoading(false);
    }
  };

  // Export logs
  const exportLogs = async (format) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', new Date(startDate).toISOString());
      if (endDate) params.set('endDate', new Date(endDate).toISOString());
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
      console.error('Error exporting logs:', error);
      toast.error('Failed to export logs');
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [offset, startDate, endDate, action, actorEmail, actorType, entityType]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Button>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Audit Log
          </h1>
          <p className="text-muted-foreground">
            Tamper-evident append-only audit trail for AIDIN Helpdesk
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportLogs('jsonl')}>
            <Download className="mr-2 h-4 w-4" />
            Export JSONL
          </Button>
          <Button variant="outline" onClick={() => exportLogs('csv')}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={verifyChain} disabled={loading}>
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
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Action</label>
              <Input
                placeholder="e.g., ticket.created"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              />
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
                setStartDate('');
                setEndDate('');
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
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Timestamp</th>
                  <th className="text-left p-2">Action</th>
                  <th className="text-left p-2">Actor</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Entity</th>
                  <th className="text-left p-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b hover:bg-muted cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="p-2 text-sm">
                      {new Date(log.ts).toLocaleString()}
                    </td>
                    <td className="p-2">
                      <Badge variant="outline">{log.action}</Badge>
                    </td>
                    <td className="p-2 text-sm">{log.actorEmail}</td>
                    <td className="p-2">
                      <Badge
                        variant={
                          log.actorType === 'human'
                            ? 'default'
                            : log.actorType === 'system'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {log.actorType}
                      </Badge>
                    </td>
                    <td className="p-2 text-sm">
                      {log.entityType}: {log.entityId}
                    </td>
                    <td className="p-2 text-sm text-muted-foreground">
                      {log.requestId?.substring(0, 8)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
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
