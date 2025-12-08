'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { track } from '@vercel/analytics';
import { CheckCircle, AlertCircle, Sparkles, Shuffle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { Globe, GlobeTheme } from '@/components/globe';
import { HistoryResearchInterface } from '@/components/history-research-interface';
import { AuthModal } from '@/components/auth/auth-modal';
import { useAuthStore } from '@/lib/stores/use-auth-store';
import { Sidebar } from '@/components/sidebar';
import BottomBar from '@/components/bottom-bar';
import { ResearchConfirmationDialog } from '@/components/research-confirmation-dialog';
import { SettingsModal } from '@/components/user/settings-modal';
import { SubscriptionModal } from '@/components/user/subscription-modal';

function HomeContent() {
  const { user, valyuAccessToken, loading } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ name: string; lat: number; lng: number; taskId?: string } | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmLocation, setConfirmLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [customInstructions, setCustomInstructions] = useState<string | undefined>(undefined);
  const [globeTheme, setGlobeTheme] = useState<GlobeTheme>('satellite-streets-v12');
  const globeRef = useRef<any>(null);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const [showMobileSubscription, setShowMobileSubscription] = useState(false);
  const [showMobileHistory, setShowMobileHistory] = useState(false);

  // Check if user is signed in with Valyu
  const isSignedIn = !!user && !!valyuAccessToken;
  const isDevelopment = process.env.NEXT_PUBLIC_APP_MODE === 'development';

  // Handle URL messages from auth callbacks
  useEffect(() => {
    const message = searchParams.get('message');
    const error = searchParams.get('error');

    if (message === 'email_updated') {
      setNotification({ type: 'success', message: 'Email address successfully updated!' });
      router.replace('/');
    } else if (message === 'email_link_expired') {
      setNotification({ type: 'error', message: 'Email confirmation link has expired. Please request a new email change.' });
      router.replace('/');
    } else if (error === 'auth_failed') {
      setNotification({ type: 'error', message: 'Authentication failed. Please try again.' });
      router.replace('/');
    }

    // Handle checkout success
    const checkoutSuccess = searchParams.get('checkout');
    if (checkoutSuccess === 'success') {
      setNotification({ type: 'success', message: 'Payment setup successful!' });
      queryClient.invalidateQueries({ queryKey: ['user-subscription'] });
      router.replace('/');
    }
  }, [searchParams, router, queryClient]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleLocationClick = useCallback(async (location: { name: string; lat: number; lng: number }, taskId?: string) => {
    track('location_clicked', { location: location.name });

    // If this is loading existing research (has taskId), allow it
    if (taskId) {
      setSelectedLocation(location);
      const params = new URLSearchParams(window.location.search);
      params.set('research', taskId);
      window.history.pushState({}, '', `?${params.toString()}`);
      return;
    }

    // Require Valyu sign-in (except in development mode)
    if (!isDevelopment && !isSignedIn) {
      setShowAuthModal(true);
      return;
    }

    // Show confirmation dialog
    setConfirmLocation(location);
    setShowConfirmDialog(true);
  }, [isSignedIn, isDevelopment]);

  const handleConfirmResearch = useCallback((instructions?: string) => {
    if (confirmLocation) {
      // Double-check sign-in before starting research
      if (!isDevelopment && !isSignedIn) {
        setShowConfirmDialog(false);
        setShowAuthModal(true);
        return;
      }

      setCustomInstructions(instructions);
      setSelectedLocation(confirmLocation);
      setShowConfirmDialog(false);
      setConfirmLocation(null);
    }
  }, [confirmLocation, isSignedIn, isDevelopment]);

  const handleCancelResearch = useCallback(() => {
    setShowConfirmDialog(false);
    setConfirmLocation(null);
  }, []);

  const handleCloseResearch = useCallback(() => {
    setSelectedLocation(null);

    // Remove research ID from URL
    const params = new URLSearchParams(window.location.search);
    params.delete('research');
    const newUrl = params.toString() ? `?${params.toString()}` : '/';
    window.history.pushState({}, '', newUrl);

    // Trigger popstate to update searchParams
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  // Handle URL-based research loading
  useEffect(() => {
    const researchId = searchParams.get('research');
    if (researchId && !selectedLocation) {
      // Fetch task data to get the actual location
      const fetchTaskData = async () => {
        try {
          const response = await fetch('/api/research/tasks');
          const data = await response.json();
          const tasks = data?.tasks || [];
          const task = tasks.find((t: any) => t.deepresearchId === researchId);

          if (task) {
            setSelectedLocation({
              name: task.locationName,
              lat: task.locationLat,
              lng: task.locationLng,
            });
          } else {
            // Fallback if task not found
            setSelectedLocation({
              name: 'Loading research...',
              lat: 0,
              lng: 0,
            });
          }
        } catch (error) {
          // Fallback on error
          setSelectedLocation({
            name: 'Loading research...',
            lat: 0,
            lng: 0,
          });
        }
      };

      fetchTaskData();
    }
  }, [searchParams]); // Remove selectedLocation from deps to prevent re-opening

  // Handle show-auth-modal event from sidebar
  useEffect(() => {
    const handleShowAuthModal = () => {
      setShowAuthModal(true);
    };

    window.addEventListener('show-auth-modal', handleShowAuthModal);
    return () => window.removeEventListener('show-auth-modal', handleShowAuthModal);
  }, []);

  const handleFeelingLucky = useCallback(() => {
    // Require Valyu sign-in (except in development mode)
    if (!isDevelopment && !isSignedIn) {
      setShowAuthModal(true);
      return;
    }

    if (globeRef.current) {
      globeRef.current.selectRandomLocation();
    }
  }, [isSignedIn, isDevelopment]);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar globeTheme={globeTheme} onGlobeThemeChange={(theme) => setGlobeTheme(theme as GlobeTheme)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Clean Layout */}
        <header className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
          {/* Title Section - Centered */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-center pt-6 sm:pt-8 md:pt-12 pb-3 sm:pb-4 pointer-events-auto px-4"
          >
            <div className="text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="relative inline-block group cursor-pointer"
              >
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light tracking-tight mb-3 sm:mb-4 relative inline-block transition-transform duration-300 ease-out group-hover:-rotate-[5deg]">
                  <span className="font-serif italic bg-gradient-to-br from-primary-foreground via-primary-foreground/95 to-primary-foreground/90 bg-clip-text text-transparent drop-shadow-lg">
                    History
                  </span>
                  <motion.div
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-[2px] bg-gradient-to-r from-transparent via-primary-foreground/60 to-transparent"
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1, delay: 0.6 }}
                  />
                </h1>

                {/* By Valyu Logo - Hidden on mobile, slides out on desktop */}
                <div className="hidden sm:flex absolute left-full top-1/2 -translate-y-1/2 items-center gap-2.5 ml-4 whitespace-nowrap opacity-0 -translate-x-5 transition-all duration-300 ease-out group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none">
                  <span className="text-base md:text-lg text-primary-foreground/70 drop-shadow-md font-light">By</span>
                  <Image
                    src="/valyu.svg"
                    alt="Valyu"
                    width={140}
                    height={140}
                    className="h-8 md:h-10 w-auto opacity-90 drop-shadow-md invert brightness-0 contrast-200"
                    priority
                  />
                </div>
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-sm sm:text-base text-primary-foreground/90 font-light tracking-wide drop-shadow-md px-4"
              >
                Discover the stories behind every place on Earth
              </motion.p>
            </div>
          </motion.div>

          {/* I'm Feeling Lucky - Top Right */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="absolute top-4 sm:top-6 md:top-8 right-4 sm:right-6 md:right-8 pointer-events-auto"
          >
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleFeelingLucky}
              className="group relative px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm font-semibold bg-card/90 backdrop-blur-xl text-card-foreground border border-border rounded-full transition-all shadow-xl hover:shadow-2xl hover:bg-card hover:border-border/80 flex items-center gap-1.5 sm:gap-2 md:gap-2.5 min-h-11"
            >
              <Shuffle className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:rotate-180 transition-transform duration-500" />
              <span className="hidden sm:inline">Random Location</span>
              <span className="sm:hidden">Random</span>
            </motion.button>
          </motion.div>
        </header>

        {/* Globe container */}
        <div className="flex-1 overflow-hidden relative">
          <Globe ref={globeRef} onLocationClick={handleLocationClick} theme={globeTheme} />
        </div>

        {/* Bottom bar */}
        <BottomBar
          onShowAuth={() => setShowAuthModal(true)}
          onShowSettings={() => setShowMobileSettings(true)}
          onShowSubscription={() => setShowMobileSubscription(true)}
          onShowHistory={() => setShowMobileHistory(true)}
        />
      </div>

      {/* Research interface overlay */}
      <AnimatePresence>
        {selectedLocation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <HistoryResearchInterface
              location={selectedLocation}
              onClose={handleCloseResearch}
              onTaskCreated={(taskId) => {
                // Update URL with research ID
                const params = new URLSearchParams(window.location.search);
                params.set('research', taskId);
                window.history.pushState({}, '', `?${params.toString()}`);
              }}
              initialTaskId={searchParams.get('research') || undefined}
              customInstructions={customInstructions}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals and dialogs */}
      {showConfirmDialog && (
        <ResearchConfirmationDialog
          location={confirmLocation}
          onConfirm={handleConfirmResearch}
          onCancel={handleCancelResearch}
          onSignUp={() => {
            setShowConfirmDialog(false);
            setShowAuthModal(true);
          }}
        />
      )}

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSignUpSuccess={(message) => {
          // Don't close modal - let user see success message and click "Got it"
          // Just show notification as well
          setNotification({ type: 'success', message });
        }}
      />

      <SettingsModal
        open={showMobileSettings}
        onClose={() => setShowMobileSettings(false)}
      />

      <SubscriptionModal
        open={showMobileSubscription}
        onClose={() => setShowMobileSubscription(false)}
      />

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-50"
          >
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
                notification.type === 'success'
                  ? 'bg-green-500/10 border-green-500/20'
                  : notification.type === 'info'
                  ? 'bg-blue-500/10 border-blue-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : notification.type === 'info' ? (
                <Sparkles className="h-5 w-5 text-blue-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
