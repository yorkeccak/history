import { NextResponse } from 'next/server';

/**
 * Server-side token exchange endpoint for Valyu OAuth
 * Keeps the client_secret secure on the server
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, code_verifier, redirect_uri, grant_type, refresh_token } = body;

    // Get configuration from environment
    const valyuSupabaseUrl = process.env.NEXT_PUBLIC_VALYU_SUPABASE_URL;
    const clientId = process.env.NEXT_PUBLIC_VALYU_CLIENT_ID;
    const clientSecret = process.env.VALYU_CLIENT_SECRET;

    if (!valyuSupabaseUrl || !clientId || !clientSecret) {
      console.error('[Token Exchange] Missing configuration');
      return NextResponse.json(
        { error: 'server_error', message: 'OAuth not configured' },
        { status: 500 }
      );
    }

    // Validate redirect_uri against allowlist
    const allowedRedirectUris = [
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/valyu/callback`,
      'http://localhost:3000/auth/valyu/callback',
      'http://localhost:3001/auth/valyu/callback',
    ];

    if (redirect_uri && !allowedRedirectUris.includes(redirect_uri)) {
      console.error('[Token Exchange] Invalid redirect_uri:', redirect_uri);
      return NextResponse.json(
        { error: 'invalid_request', message: 'Invalid redirect_uri' },
        { status: 400 }
      );
    }

    // Build token request - use OAuth 2.1 endpoint
    const tokenUrl = `${valyuSupabaseUrl}/auth/v1/oauth/token`;
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    let tokenParams: Record<string, string>;

    if (grant_type === 'refresh_token' && refresh_token) {
      // Refresh token flow
      tokenParams = {
        grant_type: 'refresh_token',
        refresh_token,
      };
    } else if (code && code_verifier) {
      // Authorization code flow with PKCE
      tokenParams = {
        grant_type: 'authorization_code',
        code,
        code_verifier,
        redirect_uri: redirect_uri || '',
      };
    } else {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log('[Token Exchange] Requesting tokens from Valyu Supabase');

    // Exchange code/refresh_token for tokens
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('[Token Exchange] Failed:', tokenResponse.status, errorData);
      return NextResponse.json(
        { error: 'token_exchange_failed', message: 'Failed to exchange code for tokens' },
        { status: tokenResponse.status }
      );
    }

    const tokenData = await tokenResponse.json();

    console.log('[Token Exchange] Success');

    // Return tokens to client
    return NextResponse.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      id_token: tokenData.id_token,
      expires_in: tokenData.expires_in || 3600,
      token_type: tokenData.token_type || 'bearer',
    });
  } catch (error) {
    console.error('[Token Exchange] Error:', error);
    return NextResponse.json(
      { error: 'server_error', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
