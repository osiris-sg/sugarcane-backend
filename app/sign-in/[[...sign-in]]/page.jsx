"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    console.log(`[SignIn] ${message}`);
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    addLog(`Starting sign-in for username: ${username}`);
    addLog(`Clerk isLoaded: ${isLoaded}`);

    if (!isLoaded) {
      addLog("Clerk not loaded yet");
      setError("Clerk not loaded yet. Please wait.");
      setLoading(false);
      return;
    }

    try {
      addLog("Calling signIn.create()...");

      const result = await signIn.create({
        identifier: username,
        password: password,
      });

      addLog(`signIn.create result status: ${result.status}`);
      addLog(`Result: ${JSON.stringify(result, null, 2)}`);

      if (result.status === "complete") {
        addLog("Sign-in complete, setting active session...");
        await setActive({ session: result.createdSessionId });
        addLog("Session set, redirecting to dashboard...");
        router.push("/dashboard");
      } else {
        addLog(`Unexpected status: ${result.status}`);
        setError(`Sign-in incomplete. Status: ${result.status}`);
      }
    } catch (err) {
      addLog(`Error: ${err.message}`);
      addLog(`Error code: ${err.errors?.[0]?.code}`);
      addLog(`Error details: ${JSON.stringify(err.errors, null, 2)}`);

      const errorMessage = err.errors?.[0]?.message || err.message || "Sign-in failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Sign in to Supercane</CardTitle>
            <p className="text-sm text-muted-foreground">Welcome back! Please sign in to continue</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Debug Logs */}
        {logs.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Debug Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-auto rounded bg-muted p-2 font-mono text-xs">
                {logs.map((log, i) => (
                  <div key={i} className="py-0.5">{log}</div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setLogs([])}
              >
                Clear logs
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
