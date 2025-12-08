'use client';

import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createClient } from '@/utils/supabase/client-wrapper';
import { track } from '@vercel/analytics';
import {
  buildAuthorizationUrl,
  getRedirectUri,
  saveValyuTokens,
  loadValyuTokens,
  clearValyuTokens,
  getValidAccessToken,
  type ValyuOAuthTokens,
} from '@/lib/valyu-oauth';

// Token storage keys
const VALYU_TOKEN_KEY = 'valyu_oauth_tokens';

interface AuthState {
  // Supabase user/session (for local database)
  user: User | null;
  loading: boolean;
  initialized: boolean;

  // Valyu OAuth tokens
  valyuAccessToken: string | null;
  valyuRefreshToken: string | null;
  valyuTokenExpiresAt: number | null;

  // Valyu API status
  hasApiKey: boolean;
  creditsAvailable: boolean;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;

  // Valyu OAuth methods
  signInWithValyu: () => Promise<{ data?: any; error?: any }>;
  completeValyuAuth: (
    idToken: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number
  ) => Promise<{ success: boolean; error?: string }>;
  setValyuTokens: (accessToken: string, refreshToken: string, expiresIn: number) => void;
  getValyuAccessToken: () => string | null;
  setApiKeyStatus: (hasApiKey: boolean, creditsAvailable: boolean) => void;

  signOut: () => Promise<{ error?: any }>;
  initialize: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      loading: true,
      initialized: false,

      // Valyu OAuth state
      valyuAccessToken: null,
      valyuRefreshToken: null,
      valyuTokenExpiresAt: null,
      hasApiKey: false,
      creditsAvailable: false,

      // Actions
      setUser: (user) => set({ user }),
      setLoading: (loading) => set({ loading }),
      setInitialized: (initialized) => set({ initialized }),

      /**
       * Initiate Valyu OAuth sign-in flow
       */
      signInWithValyu: async () => {
        try {
          const redirectUri = getRedirectUri();
          const { url } = await buildAuthorizationUrl(redirectUri);

          // Redirect to Valyu OAuth
          window.location.href = url;

          return { data: { url } };
        } catch (error) {
          console.error('[Auth] Valyu sign-in error:', error);
          return { error };
        }
      },

      /**
       * Complete Valyu OAuth - create local Supabase session
       */
      completeValyuAuth: async (idToken, accessToken, refreshToken, expiresIn) => {
        try {
          // Store Valyu tokens
          const tokens: ValyuOAuthTokens = {
            accessToken,
            refreshToken,
            expiresAt: Date.now() + (expiresIn * 1000),
            idToken,
          };
          saveValyuTokens(tokens);

          set({
            valyuAccessToken: accessToken,
            valyuRefreshToken: refreshToken,
            valyuTokenExpiresAt: tokens.expiresAt,
          });

          // Create local Supabase session via our API
          const sessionResponse = await fetch('/api/auth/valyu/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: accessToken,
              id_token: idToken,
            }),
          });

          if (!sessionResponse.ok) {
            const errorData = await sessionResponse.json();
            throw new Error(errorData.error || 'Failed to create session');
          }

          const sessionData = await sessionResponse.json();

          // Sign in to local Supabase using the magic link token
          // Support both tokenHash and token_hash formats
          const tokenHash = sessionData.tokenHash || sessionData.token_hash;
          const supabase = createClient();

          if (tokenHash) {
            // Verify the OTP/magic link token
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: 'magiclink',
            });

            if (error) {
              console.error('[Auth] Magic link verification failed:', error);
              throw new Error('Failed to verify session');
            }

            // Update state with user
            if (data.user) {
              set({
                user: data.user,
                loading: false,
              });

              // Track sign in
              track('Sign In Success', {
                method: 'valyu',
              });
            }
          }

          // Fetch API key status
          try {
            const statusResponse = await fetch('/api/auth/valyu/status', {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            });

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              set({
                hasApiKey: statusData.hasApiKey || false,
                creditsAvailable: statusData.creditsAvailable || false,
              });
            }
          } catch {
            // Non-critical, continue
          }

          return { success: true };
        } catch (error) {
          console.error('[Auth] Complete Valyu auth error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Authentication failed',
          };
        }
      },

      /**
       * Set Valyu OAuth tokens
       */
      setValyuTokens: (accessToken, refreshToken, expiresIn) => {
        const expiresAt = Date.now() + (expiresIn * 1000);

        const tokens: ValyuOAuthTokens = {
          accessToken,
          refreshToken,
          expiresAt,
        };
        saveValyuTokens(tokens);

        set({
          valyuAccessToken: accessToken,
          valyuRefreshToken: refreshToken,
          valyuTokenExpiresAt: expiresAt,
        });
      },

      /**
       * Get current Valyu access token (from state or localStorage)
       */
      getValyuAccessToken: () => {
        const state = get();

        // Check state first
        if (state.valyuAccessToken) {
          // Check if expired
          if (state.valyuTokenExpiresAt && Date.now() < state.valyuTokenExpiresAt) {
            return state.valyuAccessToken;
          }
        }

        // Fall back to localStorage
        const tokens = loadValyuTokens();
        if (tokens) {
          // Update state from localStorage
          set({
            valyuAccessToken: tokens.accessToken,
            valyuRefreshToken: tokens.refreshToken,
            valyuTokenExpiresAt: tokens.expiresAt,
          });
          return tokens.accessToken;
        }

        return null;
      },

      /**
       * Set API key status
       */
      setApiKeyStatus: (hasApiKey, creditsAvailable) => {
        set({ hasApiKey, creditsAvailable });
      },

      /**
       * Sign out from both local Supabase and clear Valyu tokens
       */
      signOut: async () => {
        const supabase = createClient();

        try {
          const result = await supabase.auth.signOut();

          // Clear Valyu tokens
          clearValyuTokens();
          set({
            valyuAccessToken: null,
            valyuRefreshToken: null,
            valyuTokenExpiresAt: null,
            hasApiKey: false,
            creditsAvailable: false,
          });

          return result;
        } catch (error) {
          return { error };
        }
      },

      /**
       * Initialize auth state
       */
      initialize: () => {
        if (get().initialized) return;

        // Mark as initializing to prevent multiple calls
        set({ initialized: true });

        const supabase = createClient();

        // Load Valyu tokens from localStorage
        const valyuTokens = loadValyuTokens();
        if (valyuTokens) {
          set({
            valyuAccessToken: valyuTokens.accessToken,
            valyuRefreshToken: valyuTokens.refreshToken,
            valyuTokenExpiresAt: valyuTokens.expiresAt,
          });
        }

        // Failsafe: if nothing happens in 3 seconds, stop loading
        const timeoutId = setTimeout(() => {
          set({ loading: false });
        }, 3000);

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
          clearTimeout(timeoutId);
          set({
            user: session?.user ?? null,
            loading: false
          });
        }).catch((error: unknown) => {
          clearTimeout(timeoutId);
          set({
            user: null,
            loading: false
          });
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event: AuthChangeEvent, session: Session | null) => {

            set({
              user: session?.user ?? null,
              loading: false
            });

            // Handle sign out event
            if (event === 'SIGNED_OUT') {
              // Clear Valyu tokens on sign out
              clearValyuTokens();
              set({
                valyuAccessToken: null,
                valyuRefreshToken: null,
                valyuTokenExpiresAt: null,
                hasApiKey: false,
                creditsAvailable: false,
              });

              // Notify components of sign out
              if (typeof window !== 'undefined') {
                setTimeout(() => {
                  const event = new CustomEvent('auth:signout');
                  window.dispatchEvent(event);
                }, 100);
              }
            }

            // Track sign in (for non-Valyu methods that might still work)
            if (event === 'SIGNED_IN' && session?.user) {
              const provider = session.user.app_metadata.provider;

              // Only track if not Valyu (Valyu tracking is done in completeValyuAuth)
              if (provider !== 'valyu') {
                track('Sign In Success', {
                  method: provider || 'email'
                });
              }
            }
          }
        );

        // Clean up subscription on unmount would be handled by the component
        if (typeof window !== 'undefined') {
          window.addEventListener('beforeunload', () => {
            subscription?.unsubscribe();
          });
        }
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist user data, not loading or initialization states
      partialize: (state) => ({
        user: state.user
      }),
      skipHydration: true,
    }
  )
);
