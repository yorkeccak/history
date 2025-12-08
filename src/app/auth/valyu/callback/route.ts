import { NextRequest, NextResponse } from 'next/server';

/**
 * OAuth callback route for Valyu Sign In
 * Receives the authorization code from Valyu Platform and redirects to completion page
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Get the app URL for redirects
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  // Handle OAuth errors
  if (error) {
    console.error('[Valyu OAuth Callback] Error:', error, errorDescription);
    const errorUrl = new URL('/', appUrl);
    errorUrl.searchParams.set('auth_error', errorDescription || error);
    return NextResponse.redirect(errorUrl);
  }

  // Validate we have a code
  if (!code) {
    console.error('[Valyu OAuth Callback] No authorization code received');
    const errorUrl = new URL('/', appUrl);
    errorUrl.searchParams.set('auth_error', 'No authorization code received');
    return NextResponse.redirect(errorUrl);
  }

  // Redirect to client-side completion page with the code
  // The completion page will handle PKCE verification and token exchange
  const completeUrl = new URL('/auth/valyu/complete', appUrl);
  completeUrl.searchParams.set('code', code);
  if (state) {
    completeUrl.searchParams.set('state', state);
  }

  return NextResponse.redirect(completeUrl);
}
