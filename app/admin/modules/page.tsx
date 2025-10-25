"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function AdminModulesPage() {
  // Feature flag check
  if (process.env.NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI !== "true") {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin Modules</CardTitle>
            <CardDescription>This feature is currently disabled.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              To enable this feature, set NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI=true in your environment.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roles = ["requester", "staff", "manager", "admin"];
  const [available, setAvailable] = useState<string[]>([]);
  const [role, setRole] = useState("staff");
  const [roleMods, setRoleMods] = useState<string[]>([]);
  const [userId, setUserId] = useState("");
  const [userMods, setUserMods] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load available modules on mount
  useEffect(() => {
    fetch("/api/admin/modules")
      .then((r) => r.json())
      .then((d) => setAvailable(d.modules || []))
      .catch((e) => toast.error("Failed to load modules"));
  }, []);

  // Load role modules when role changes
  useEffect(() => {
    fetch("/api/admin/role-modules")
      .then((r) => r.json())
      .then((rows) => {
        const row = rows.find((x: any) => x.role === role);
        setRoleMods(row?.modules ?? []);
      })
      .catch((e) => toast.error("Failed to load role modules"));
  }, [role]);

  function toggleRole(m: string) {
    setRoleMods((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]));
  }

  function toggleUser(m: string) {
    setUserMods((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]));
  }

  async function saveRole() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/role-modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, modules: roleMods }),
      });
      if (res.ok) {
        toast.success("Role modules saved successfully");
      } else {
        const error = await res.json();
        toast.error(error.error?.message || "Failed to save");
      }
    } catch (e) {
      toast.error("Failed to save role modules");
    } finally {
      setLoading(false);
    }
  }

  async function loadUser() {
    if (!userId.trim()) {
      toast.error("Please enter a user ID");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/user-modules?userId=${encodeURIComponent(userId)}`);
      const row = await res.json();
      setUserMods(row?.modules ?? []);
      toast.success("User modules loaded");
    } catch (e) {
      toast.error("Failed to load user modules");
    } finally {
      setLoading(false);
    }
  }

  async function saveUser() {
    if (!userId.trim()) {
      toast.error("Please enter a user ID");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/user-modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, modules: userMods }),
      });
      if (res.ok) {
        toast.success("User modules saved successfully");
      } else {
        const error = await res.json();
        toast.error(error.error?.message || "Failed to save");
      }
    } catch (e) {
      toast.error("Failed to save user modules");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Module Assignment</h1>
        <p className="text-muted-foreground mt-2">
          Manage module access for roles and individual users. User overrides take precedence over role defaults.
        </p>
      </div>

      {/* Role Module Assignment */}
      <Card>
        <CardHeader>
          <CardTitle>Role Defaults</CardTitle>
          <CardDescription>Set default module access for each role</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-select">Select Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role-select" className="w-full md:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Enabled Modules</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {available.map((m) => (
                <label
                  key={m}
                  className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={roleMods.includes(m)}
                    onChange={() => toggleRole(m)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium capitalize">{m}</span>
                </label>
              ))}
            </div>
          </div>

          <Button onClick={saveRole} disabled={loading} className="mt-4">
            {loading ? "Saving..." : "Save Role Modules"}
          </Button>
        </CardContent>
      </Card>

      {/* User Module Overrides */}
      <Card>
        <CardHeader>
          <CardTitle>User Overrides</CardTitle>
          <CardDescription>Override module access for specific users (takes precedence over role)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="user-id">User ID</Label>
              <Input
                id="user-id"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter user ID (e.g., user-uuid)"
                className="max-w-md"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={loadUser} disabled={loading} variant="outline">
                Load User
              </Button>
            </div>
          </div>

          {userId && (
            <>
              <div className="space-y-2">
                <Label>User Modules</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {available.map((m) => (
                    <label
                      key={m}
                      className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={userMods.includes(m)}
                        onChange={() => toggleUser(m)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium capitalize">{m}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={saveUser} disabled={loading} className="mt-4">
                {loading ? "Saving..." : "Save User Modules"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
