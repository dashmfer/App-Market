'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function SessionDebugPage() {
  const { data: session, status } = useSession();
  const [cookies, setCookies] = useState<string>('');
  const [apiSession, setApiSession] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    // Get cookies
    setCookies(document.cookie);

    // Test the API session endpoint
    fetch('/api/auth/session', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setApiSession(data))
      .catch(err => setApiError(err.message));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Session Debug Information
        </h1>

        {/* useSession() Hook Data */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
            useSession() Hook
          </h2>
          <div className="space-y-2 font-mono text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-zinc-500">Status:</div>
              <div className={`font-bold ${
                status === 'authenticated' ? 'text-green-600' :
                status === 'loading' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {status}
              </div>

              <div className="text-zinc-500">Has Session:</div>
              <div className={session ? 'text-green-600' : 'text-red-600'}>
                {session ? '✓ Yes' : '✗ No'}
              </div>

              <div className="text-zinc-500">Has User:</div>
              <div className={session?.user ? 'text-green-600' : 'text-red-600'}>
                {session?.user ? '✓ Yes' : '✗ No'}
              </div>

              <div className="text-zinc-500">User ID:</div>
              <div className={session?.user?.id ? 'text-green-600' : 'text-red-600'}>
                {session?.user?.id || '✗ Missing'}
              </div>

              <div className="text-zinc-500">User Email:</div>
              <div>{session?.user?.email || 'N/A'}</div>

              <div className="text-zinc-500">User Name:</div>
              <div>{session?.user?.name || 'N/A'}</div>

              <div className="text-zinc-500">Username:</div>
              <div>{(session?.user as any)?.username || 'N/A'}</div>

              <div className="text-zinc-500">Image:</div>
              <div>{session?.user?.image || 'N/A'}</div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-zinc-100 dark:bg-zinc-800 rounded overflow-auto">
            <pre className="text-xs">
              {JSON.stringify(session, null, 2)}
            </pre>
          </div>
        </div>

        {/* API Session Endpoint */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
            API Session Endpoint
          </h2>
          {apiError ? (
            <div className="text-red-600 font-mono text-sm">
              Error: {apiError}
            </div>
          ) : (
            <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded overflow-auto">
              <pre className="text-xs font-mono">
                {JSON.stringify(apiSession, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Cookies */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
            Cookies
          </h2>
          <div className="space-y-2">
            {cookies ? (
              cookies.split(';').map((cookie, i) => (
                <div key={i} className="font-mono text-sm text-zinc-700 dark:text-zinc-300 break-all">
                  {cookie.trim()}
                </div>
              ))
            ) : (
              <div className="text-red-600">No cookies found</div>
            )}
          </div>
        </div>

        {/* Button Test */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
            Button Disabled Logic Test
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">ProfilePictureUpload.tsx Logic:</h3>
              <div className="font-mono text-sm space-y-1">
                <div className="text-zinc-500">
                  disabled = uploading || status === 'loading' || !session
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="text-zinc-500">status === 'loading':</div>
                  <div className={status === 'loading' ? 'text-red-600' : 'text-green-600'}>
                    {status === 'loading' ? '✗ TRUE (DISABLES button)' : '✓ FALSE'}
                  </div>
                  <div className="text-zinc-500">!session:</div>
                  <div className={!session ? 'text-red-600' : 'text-green-600'}>
                    {!session ? '✗ TRUE (DISABLES button)' : '✓ FALSE'}
                  </div>
                  <div className="text-zinc-500 font-bold">Button Enabled?:</div>
                  <div className={!(status === 'loading' || !session) ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                    {!(status === 'loading' || !session) ? '✓ YES' : '✗ NO - DISABLED'}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Settings Page Logic:</h3>
              <div className="font-mono text-sm space-y-1">
                <div className="text-zinc-500">
                  disabled = uploading || status !== "authenticated" || !session?.user?.id
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="text-zinc-500">status !== "authenticated":</div>
                  <div className={status !== 'authenticated' ? 'text-red-600' : 'text-green-600'}>
                    {status !== 'authenticated' ? `✗ TRUE (status is "${status}") - DISABLES button` : '✓ FALSE'}
                  </div>
                  <div className="text-zinc-500">!session?.user?.id:</div>
                  <div className={!session?.user?.id ? 'text-red-600' : 'text-green-600'}>
                    {!session?.user?.id ? '✗ TRUE (no user ID) - DISABLES button' : '✓ FALSE'}
                  </div>
                  <div className="text-zinc-500 font-bold">Button Enabled?:</div>
                  <div className={!(status !== 'authenticated' || !session?.user?.id) ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                    {!(status !== 'authenticated' || !session?.user?.id) ? '✓ YES' : '✗ NO - DISABLED'}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <h3 className="font-medium mb-2 text-zinc-900 dark:text-zinc-100">Actual Button Test:</h3>
              <button
                disabled={status !== 'authenticated' || !session?.user?.id}
                className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {status !== 'authenticated' ? 'Sign in to upload' : 'Upload Photo'}
              </button>
            </div>
          </div>
        </div>

        {/* Diagnosis */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-yellow-900 dark:text-yellow-100">
            Diagnosis
          </h2>
          <div className="space-y-2 text-sm">
            {status === 'loading' && (
              <div className="text-yellow-900 dark:text-yellow-100">
                ⚠️ Status is "loading" - This is why the button is disabled. Session is still initializing.
              </div>
            )}
            {status === 'unauthenticated' && (
              <div className="text-red-600 dark:text-red-400">
                ❌ Status is "unauthenticated" - You are not signed in. Please sign in first.
              </div>
            )}
            {status === 'authenticated' && !session?.user?.id && (
              <div className="text-red-600 dark:text-red-400">
                ❌ Status is "authenticated" but user ID is missing. This is a critical bug in the session callback.
              </div>
            )}
            {status === 'authenticated' && session?.user?.id && (
              <div className="text-green-600 dark:text-green-400">
                ✅ Everything looks good! The button should be enabled.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
