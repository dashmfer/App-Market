"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function SessionCheckPage() {
  const { data: session, status } = useSession();
  const [backendCheck, setBackendCheck] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/debug/production-check')
      .then(res => res.json())
      .then(data => {
        setBackendCheck(data);
        setLoading(false);
      })
      .catch(err => {
        setBackendCheck({ error: err.message });
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🔍 Production Diagnostics</h1>
        <p className="text-zinc-500 mb-8">Check what's broken on the live site</p>

        {/* Frontend Session Check */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 mb-6 border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold mb-4">Frontend Session Status</h2>
          <div className="space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span>Session Status:</span>
              <span className={status === 'authenticated' ? 'text-green-500' : 'text-red-500'}>
                {status === 'authenticated' ? '✅' : '❌'} {status}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Has Session:</span>
              <span className={session ? 'text-green-500' : 'text-red-500'}>
                {session ? '✅ Yes' : '❌ No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Has User:</span>
              <span className={session?.user ? 'text-green-500' : 'text-red-500'}>
                {session?.user ? '✅ Yes' : '❌ No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>User ID:</span>
              <span className={session?.user?.id ? 'text-green-500' : 'text-red-500'}>
                {session?.user?.id || '❌ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>User Email:</span>
              <span>{session?.user?.email || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>User Name:</span>
              <span>{session?.user?.name || '—'}</span>
            </div>
          </div>

          {status !== 'authenticated' && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <p className="text-red-800 dark:text-red-200 font-semibold">⚠️ NOT SIGNED IN</p>
              <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                You need to sign in first. Go to the home page and click "Sign In".
              </p>
            </div>
          )}

          {status === 'authenticated' && !session?.user?.id && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <p className="text-red-800 dark:text-red-200 font-semibold">🔴 CRITICAL: User ID Missing</p>
              <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                Session exists but user.id is missing. This means the JWT callback is broken.
                Check backend logs and NEXTAUTH_SECRET.
              </p>
            </div>
          )}
        </div>

        {/* Backend Health Check */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold mb-4">Backend Health Check</h2>

          {loading ? (
            <p className="text-zinc-500">Loading...</p>
          ) : backendCheck?.error ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <p className="text-red-800 dark:text-red-200 font-semibold">❌ Failed to fetch backend status</p>
              <p className="text-red-700 dark:text-red-300 text-sm mt-1 font-mono">{backendCheck.error}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Overall Status */}
              <div className={`p-4 rounded border ${
                backendCheck?.overallStatus?.includes('✅')
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <p className="font-semibold">{backendCheck?.overallStatus}</p>
              </div>

              {/* Critical Issues */}
              {backendCheck?.criticalIssues?.length > 0 && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                  <p className="font-semibold mb-2">🚨 Critical Issues:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {backendCheck.criticalIssues.map((issue: string, i: number) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Environment Variables */}
              <div>
                <h3 className="font-semibold mb-2">Environment Variables</h3>
                <div className="font-mono text-sm space-y-1">
                  {Object.entries(backendCheck?.envVars || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span>{key}:</span>
                      <span>{value as string}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Database */}
              <div>
                <h3 className="font-semibold mb-2">Database</h3>
                <div className="font-mono text-sm space-y-1">
                  {Object.entries(backendCheck?.database || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span>{key}:</span>
                      <span>{JSON.stringify(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Session Backend */}
              <div>
                <h3 className="font-semibold mb-2">Session (Backend)</h3>
                <div className="font-mono text-sm space-y-1">
                  {Object.entries(backendCheck?.session || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span>{key}:</span>
                      <span>{JSON.stringify(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* URLs */}
              <div>
                <h3 className="font-semibold mb-2">URLs</h3>
                <div className="font-mono text-sm space-y-1">
                  {Object.entries(backendCheck?.urls || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span>{key}:</span>
                      <span className="break-all max-w-md text-right">{JSON.stringify(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Items */}
        <div className="mt-6 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold mb-2">📋 What to do:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Check the diagnostics above for any ❌ marks</li>
            <li>Go to Vercel dashboard → Settings → Environment Variables</li>
            <li>Add/fix any missing environment variables</li>
            <li>Redeploy your app (Deployments tab → Redeploy)</li>
            <li>Come back to this page and refresh</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
