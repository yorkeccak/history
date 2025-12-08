import { NextRequest, NextResponse } from 'next/server';

/**
 * Internal proxy for Valyu API calls
 * Forwards requests to the Valyu Platform OAuth Proxy with the user's access token
 * This allows API calls to be billed to the user's organization credits
 */

const VALYU_APP_URL = process.env.VALYU_APP_URL || 'https://platform.valyu.ai';
const VALYU_OAUTH_PROXY_URL = process.env.VALYU_OAUTH_PROXY_URL || `${VALYU_APP_URL}/api/oauth/proxy`;

export async function POST(req: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');

    // Parse the request body
    const { path, method, body } = await req.json();

    if (!path) {
      return NextResponse.json(
        { error: 'Missing path parameter' },
        { status: 400 }
      );
    }

    // Forward the request to Valyu Platform OAuth Proxy
    const proxyResponse = await fetch(VALYU_OAUTH_PROXY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path,
        method: method || 'POST',
        body,
      }),
    });

    if (!proxyResponse.ok) {
      const errorData = await proxyResponse.json().catch(() => ({}));
      console.error('[Valyu Proxy] Error:', proxyResponse.status, errorData);

      // Return specific error for credit issues
      if (proxyResponse.status === 402) {
        return NextResponse.json(
          { error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' },
          { status: 402 }
        );
      }

      return NextResponse.json(
        { error: errorData.error || 'Proxy request failed' },
        { status: proxyResponse.status }
      );
    }

    const data = await proxyResponse.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('[Valyu Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
