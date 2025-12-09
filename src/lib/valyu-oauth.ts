/**
 * Valyu OAuth 2.1 PKCE Client
 *
 * Implements OAuth 2.1 Authorization Code Flow with PKCE for "Sign in with Valyu"
 * Uses Valyu Platform's Supabase as the OAuth provider
 */

// OAuth configuration
const VALYU_SUPABASE_URL = process.env.NEXT_PUBLIC_VALYU_SUPABASE_URL || 'https://wqrkdlceexqaqqvjbjxp.supabase.co';
const VALYU_CLIENT_ID = process.env.NEXT_PUBLIC_VALYU_CLIENT_ID || '';

// OAuth endpoints (Supabase OAuth 2.1)
export const OAUTH_ENDPOINTS = {
  authorization: `${VALYU_SUPABASE_URL}/auth/v1/oauth/authorize`,
  token: `${VALYU_SUPABASE_URL}/auth/v1/oauth/token`,
  userinfo: `${VALYU_SUPABASE_URL}/auth/v1/user`,
};

// Storage keys for PKCE
const PKCE_STATE_KEY = 'valyu_oauth_state';
const PKCE_VERIFIER_KEY = 'valyu_oauth_verifier';
const VALYU_TOKEN_KEY = 'valyu_oauth_tokens';

// Types
export interface ValyuOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
  idToken?: string;
}

export interface ValyuUserInfo {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  user_type?: string;
  organisation_id?: string;
  organisation_name?: string;
}

/**
 * Generate a cryptographically secure random string for PKCE
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate code challenge from verifier using SHA-256
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64 URL encode (RFC 4648)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate a random state parameter for CSRF protection
 */
export function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Store PKCE state and verifier in localStorage
 */
export function storePKCEData(state: string, verifier: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PKCE_STATE_KEY, state);
  localStorage.setItem(PKCE_VERIFIER_KEY, verifier);
}

/**
 * Retrieve and clear PKCE data from localStorage
 */
export function retrievePKCEData(): { state: string | null; verifier: string | null } {
  if (typeof window === 'undefined') return { state: null, verifier: null };

  const state = localStorage.getItem(PKCE_STATE_KEY);
  const verifier = localStorage.getItem(PKCE_VERIFIER_KEY);

  // Clear after retrieval for security
  localStorage.removeItem(PKCE_STATE_KEY);
  localStorage.removeItem(PKCE_VERIFIER_KEY);

  return { state, verifier };
}

/**
 * Store Valyu OAuth tokens in localStorage
 */
export function saveValyuTokens(tokens: ValyuOAuthTokens): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VALYU_TOKEN_KEY, JSON.stringify(tokens));
}

/**
 * Load Valyu OAuth tokens from localStorage
 */
export function loadValyuTokens(): ValyuOAuthTokens | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(VALYU_TOKEN_KEY);
  if (!stored) return null;

  try {
    const tokens = JSON.parse(stored) as ValyuOAuthTokens;

    // Check if tokens are expired
    if (tokens.expiresAt && Date.now() >= tokens.expiresAt) {
      // Tokens expired, clear them
      clearValyuTokens();
      return null;
    }

    return tokens;
  } catch {
    return null;
  }
}

/**
 * Clear Valyu OAuth tokens from localStorage
 */
export function clearValyuTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(VALYU_TOKEN_KEY);
}

/**
 * Check if Valyu OAuth tokens exist and are valid
 */
export function hasValidValyuTokens(): boolean {
  const tokens = loadValyuTokens();
  return tokens !== null && tokens.accessToken !== '';
}

/**
 * Build the OAuth authorization URL with PKCE
 * @param redirectUri - The callback URL after OAuth completes
 * @param appSource - Optional identifier for the source app (e.g., 'history.valyu.ai')
 */
export async function buildAuthorizationUrl(redirectUri: string, appSource?: string): Promise<{
  url: string;
  state: string;
  verifier: string;
}> {
  const state = generateState();
  const verifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(verifier);

  // Store PKCE data for later verification
  storePKCEData(state, verifier);

  const params = new URLSearchParams({
    client_id: VALYU_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    // Request openid, email, and profile scopes
    scope: 'openid email profile',
    // Request offline access for refresh token
    access_type: 'offline',
    prompt: 'consent',
  });

  // Add UTM source for tracking which app the user came from
  if (appSource) {
    params.set('utm_source', appSource);
  }

  const url = `${OAUTH_ENDPOINTS.authorization}?${params.toString()}`;

  return { url, state, verifier };
}

/**
 * Validate the OAuth callback parameters
 */
export function validateCallback(
  returnedState: string | null,
  code: string | null,
  error: string | null
): { valid: boolean; error?: string; code?: string } {
  // Check for OAuth errors
  if (error) {
    return { valid: false, error: `OAuth error: ${error}` };
  }

  // Check for authorization code
  if (!code) {
    return { valid: false, error: 'No authorization code received' };
  }

  // Retrieve stored PKCE data
  const { state: storedState } = retrievePKCEData();

  // Validate state parameter (CSRF protection)
  if (!returnedState || returnedState !== storedState) {
    return { valid: false, error: 'Invalid state parameter - possible CSRF attack' };
  }

  return { valid: true, code };
}

/**
 * Exchange authorization code for tokens (client-side call to our token endpoint)
 * The actual exchange happens server-side to keep client_secret secure
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  codeVerifier: string
): Promise<{ tokens?: ValyuOAuthTokens; error?: string }> {
  try {
    const response = await fetch('/api/auth/valyu/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.error || 'Token exchange failed' };
    }

    const data = await response.json();

    const tokens: ValyuOAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      idToken: data.id_token,
    };

    // Save tokens to localStorage
    saveValyuTokens(tokens);

    return { tokens };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Token exchange failed' };
  }
}

/**
 * Refresh the access token using the refresh token
 */
export async function refreshAccessToken(): Promise<{ tokens?: ValyuOAuthTokens; error?: string }> {
  const currentTokens = loadValyuTokens();

  if (!currentTokens?.refreshToken) {
    return { error: 'No refresh token available' };
  }

  try {
    const response = await fetch('/api/auth/valyu/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: currentTokens.refreshToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.error || 'Token refresh failed' };
    }

    const data = await response.json();

    const tokens: ValyuOAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || currentTokens.refreshToken,
      expiresAt: Date.now() + (data.expires_in * 1000),
      idToken: data.id_token,
    };

    // Save updated tokens
    saveValyuTokens(tokens);

    return { tokens };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Token refresh failed' };
  }
}

/**
 * Get valid access token, refreshing if necessary
 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = loadValyuTokens();

  if (!tokens) {
    return null;
  }

  // Check if token is expired or about to expire (within 5 minutes)
  const isExpiringSoon = tokens.expiresAt && (Date.now() >= tokens.expiresAt - 5 * 60 * 1000);

  if (isExpiringSoon && tokens.refreshToken) {
    const refreshResult = await refreshAccessToken();
    if (refreshResult.tokens) {
      return refreshResult.tokens.accessToken;
    }
    // If refresh failed, return existing token (it might still work)
    return tokens.accessToken;
  }

  return tokens.accessToken;
}

/**
 * Fetch user info from Valyu Platform
 */
export async function fetchValyuUserInfo(accessToken: string): Promise<{ user?: ValyuUserInfo; error?: string }> {
  try {
    const response = await fetch(OAUTH_ENDPOINTS.userinfo, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return { error: 'Failed to fetch user info' };
    }

    const data = await response.json();

    // Extract user info from Supabase response
    const user: ValyuUserInfo = {
      sub: data.id || data.sub,
      email: data.email,
      email_verified: data.email_confirmed_at !== null,
      name: data.user_metadata?.full_name || data.user_metadata?.name,
      picture: data.user_metadata?.avatar_url || data.user_metadata?.picture,
      user_type: data.user_metadata?.user_type,
      organisation_id: data.user_metadata?.organisation_id,
      organisation_name: data.user_metadata?.organisation_name,
    };

    return { user };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to fetch user info' };
  }
}

/**
 * Get the redirect URI for OAuth callback
 */
export function getRedirectUri(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_APP_URL + '/auth/valyu/callback';
  }
  return `${window.location.origin}/auth/valyu/callback`;
}

/**
 * Proxy a request to Valyu API using OAuth token
 * This is used for making API calls that should be billed to the user's org
 */
export async function proxyValyuApi(
  path: string,
  method: string,
  body?: any,
  accessToken?: string
): Promise<{ data?: any; error?: string }> {
  const token = accessToken || await getValidAccessToken();

  if (!token) {
    return { error: 'No valid access token' };
  }

  try {
    const response = await fetch('/api/valyu-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        path,
        method,
        body,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.error || 'API proxy request failed' };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'API proxy request failed' };
  }
}
