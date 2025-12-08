'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/use-auth-store';
import { Loader2 } from 'lucide-react';

function CompleteAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Completing sign in...');
  const completeValyuAuth = useAuthStore((state) => state.completeValyuAuth);

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setMessage(error);
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('No authorization code received');
        return;
      }

      // Get stored PKCE verifier
      const storedState = localStorage.getItem('valyu_oauth_state');
      const storedVerifier = localStorage.getItem('valyu_oauth_verifier');

      // Validate state
      if (state && storedState && state !== storedState) {
        setStatus('error');
        setMessage('Invalid state parameter - security check failed');
        return;
      }

      if (!storedVerifier) {
        setStatus('error');
        setMessage('Missing PKCE verifier - please try signing in again');
        return;
      }

      // Clear PKCE data
      localStorage.removeItem('valyu_oauth_state');
      localStorage.removeItem('valyu_oauth_verifier');

      try {
        setMessage('Exchanging authorization code...');

        // Exchange code for tokens via our server endpoint
        const redirectUri = `${window.location.origin}/auth/valyu/callback`;
        const tokenResponse = await fetch('/api/auth/valyu/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            redirect_uri: redirectUri,
            code_verifier: storedVerifier,
          }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          throw new Error(errorData.error || 'Failed to exchange token');
        }

        const tokenData = await tokenResponse.json();

        setMessage('Creating local session...');

        // Complete auth - this creates the local Supabase session
        const result = await completeValyuAuth(
          tokenData.id_token,
          tokenData.access_token,
          tokenData.refresh_token,
          tokenData.expires_in
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to create local session');
        }

        setStatus('success');
        setMessage('Sign in successful! Redirecting...');

        // Redirect to home page
        setTimeout(() => {
          router.push('/');
        }, 500);

      } catch (err) {
        console.error('[Valyu OAuth Complete] Error:', err);
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Authentication failed');
      }
    }

    handleCallback();
  }, [searchParams, router, completeValyuAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        {status === 'loading' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-foreground font-medium">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="text-red-600">{message}</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Return Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ValyuAuthCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <CompleteAuthContent />
    </Suspense>
  );
}
