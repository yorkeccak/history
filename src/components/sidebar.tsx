'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/use-auth-store';
import { createClient } from '@/utils/supabase/client-wrapper';
import {
  History,
  Settings,
  LogOut,
  CreditCard,
  Plus,
  Building2,
  MapPin,
  Loader,
  CheckCircle2,
  AlertCircle,
  Clock,
  Globe2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { SettingsModal } from '@/components/user/settings-modal';
import { SubscriptionModal } from '@/components/user/subscription-modal';
import { EnterpriseContactModal } from '@/components/enterprise/enterprise-contact-modal';

interface SidebarProps {
  currentSessionId?: string;
  onSessionSelect?: (sessionId: string) => void;
  onNewChat?: () => void;
  hasMessages?: boolean;
  globeTheme?: string;
  onGlobeThemeChange?: (theme: string) => void;
}

interface ResearchTask {
  id: string;
  deepresearchId: string;
  locationName: string;
  locationLat: number;
  locationLng: number;
  status: 'queued' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export function Sidebar({
  currentSessionId,
  onSessionSelect,
  onNewChat,
  hasMessages = false,
  globeTheme,
  onGlobeThemeChange,
}: SidebarProps) {
  const { user } = useAuthStore();
  const signOut = useAuthStore((state) => state.signOut);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const isSelfHosted = process.env.NEXT_PUBLIC_APP_MODE === 'self-hosted';

  // Keep dock open by default for everyone
  const [isOpen, setIsOpen] = useState(true);
  const [alwaysOpen, setAlwaysOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);
  const [showMapStyles, setShowMapStyles] = useState(false);

  // Fetch research tasks
  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['research-tasks'],
    queryFn: async () => {
      if (isSelfHosted) {
        const response = await fetch('/api/research/tasks');
        const { tasks } = await response.json();
        return tasks;
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/research/tasks', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });

      const { tasks } = await response.json();
      return tasks;
    },
    enabled: isSelfHosted || !!user,
    refetchInterval: 5000, // Refresh every 5 seconds to update status badges
  });

  const handleTaskSelect = useCallback((task: ResearchTask) => {
    // Navigate to the research by updating the URL
    const params = new URLSearchParams(window.location.search);
    params.set('research', task.deepresearchId);
    window.history.pushState({}, '', `?${params.toString()}`);

    // Trigger popstate event so URL change is detected
    window.dispatchEvent(new PopStateEvent('popstate'));

    setShowHistory(false);
  }, []);

  const handleNewResearch = useCallback(() => {
    // Clear the research from URL
    const params = new URLSearchParams(window.location.search);
    params.delete('research');
    const newUrl = params.toString() ? `?${params.toString()}` : '/';
    window.history.pushState({}, '', newUrl);

    setShowHistory(false);
  }, []);

  const toggleSidebar = () => {
    if (alwaysOpen) return; // Don't allow closing if always open is enabled
    setIsOpen(!isOpen);
    if (isOpen) {
      setShowHistory(false); // Close history when closing sidebar
    }
  };

  // Keep sidebar open if alwaysOpen is enabled
  useEffect(() => {
    if (alwaysOpen) {
      setIsOpen(true);
    }
  }, [alwaysOpen]);

  // Listen for upgrade modal trigger from rate limit banner
  useEffect(() => {
    const handleShowUpgradeModal = () => setShowSubscription(true);
    window.addEventListener('show-upgrade-modal', handleShowUpgradeModal);
    return () => window.removeEventListener('show-upgrade-modal', handleShowUpgradeModal);
  }, []);

  const handleLogoClick = () => {
    // Check if there's an active research (research param in URL)
    const hasActiveResearch = new URLSearchParams(window.location.search).has('research');

    if (hasActiveResearch) {
      const confirmed = window.confirm(
        'Close current research and return to globe?'
      );

      if (confirmed) {
        handleNewResearch();
      }
      return;
    }

    // If on homepage without active research, just close history
    if (pathname === '/') {
      setShowHistory(false);
      return;
    }

    // If on other pages, navigate to home
    router.push('/');
  };

  const handleManageCredits = () => {
    // Open Valyu Platform for credit management
    window.open('https://platform.valyu.ai', '_blank');
  };

  return (
    <>
      {/* Chevron Toggle Button - Left Edge, Centered - Hidden on mobile */}
      {!isOpen && (
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={toggleSidebar}
          className="hidden sm:fixed left-0 top-1/2 -translate-y-1/2 z-50 w-10 h-16 sm:flex items-center justify-center bg-card border-r-2 border-t-2 border-b-2 border-border hover:border-border/80 rounded-r-2xl transition-all duration-200 shadow-lg hover:shadow-xl hover:w-12 group"
          title="Open Menu"
        >
          <svg
            className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </motion.button>
      )}

      {/* macOS Dock-Style Navigation - Left Side - Hidden on mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300
            }}
            className="hidden sm:fixed left-6 top-1/2 -translate-y-1/2 z-40 bg-card/80 backdrop-blur-2xl border border-border rounded-[32px] shadow-2xl py-4 px-3 sm:block"
          >
            <div className="flex flex-col items-center gap-2">
              {/* Always Open Toggle */}
              <div className="relative group/tooltip">
                <button
                  onClick={() => setAlwaysOpen(!alwaysOpen)}
                  className={`w-12 h-12 flex items-center justify-center rounded-[20px] transition-all duration-200 hover:scale-110 active:scale-95 ${
                    alwaysOpen
                      ? 'bg-primary/10'
                      : 'hover:bg-accent'
                  }`}
                >
                  <svg
                    className={`w-6 h-6 transition-colors ${
                      alwaysOpen
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </button>
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-popover text-popover-foreground text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-border shadow-md">
                  {alwaysOpen ? 'Always Open (On)' : 'Always Open (Off)'}
                </div>
              </div>

              {/* Divider */}
              <div className="w-10 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              {/* Logo */}
              <div className="relative group/tooltip">
                <button
                  onClick={handleLogoClick}
                  className="w-12 h-12 flex items-center justify-center hover:bg-accent rounded-[20px] transition-all duration-200 hover:scale-110 active:scale-95"
                >
                  <Image
                    src="/nabla.png"
                    alt="Home"
                    width={28}
                    height={28}
                    className="rounded-lg"
                  />
                </button>
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-popover text-popover-foreground text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-border shadow-md">
                  Home
                </div>
              </div>

              {/* Divider */}
              <div className="w-10 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              {/* New Research */}
              {(user || isSelfHosted) && (
                <div className="relative group/tooltip">
                  <button
                    onClick={handleNewResearch}
                    className="w-12 h-12 flex items-center justify-center hover:bg-accent rounded-[20px] transition-all duration-200 group hover:scale-110 active:scale-95"
                  >
                    <Plus className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-popover text-popover-foreground text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-border shadow-md">
                    New Research
                  </div>
                </div>
              )}

                      {/* Research History */}
              <div className="relative group/tooltip">
                <button
                  onClick={() => {
                    if (!user && !isSelfHosted) {
                      window.dispatchEvent(new CustomEvent('show-auth-modal'));
                    } else {
                      setShowHistory(!showHistory);
                    }
                  }}
                  className={`w-12 h-12 flex items-center justify-center rounded-[20px] transition-all duration-200 hover:scale-110 active:scale-95 ${
                    !user && !isSelfHosted
                      ? 'opacity-50 cursor-not-allowed hover:bg-accent'
                      : showHistory
                        ? 'bg-primary text-primary-foreground shadow-lg'
                        : 'hover:bg-accent'
                  }`}
                >
                  <History className={`h-6 w-6 transition-colors ${
                    !user && !isSelfHosted
                      ? 'text-muted-foreground/50'
                      : showHistory
                        ? 'text-primary-foreground'
                        : 'text-muted-foreground'
                  }`} />
                </button>
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-popover text-popover-foreground text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-border shadow-md">
                  {!user && !isSelfHosted ? 'Sign up (free) for history' : 'Research History'}
                </div>
              </div>

              {/* Divider */}
              {user && !isSelfHosted && <div className="w-10 h-px bg-gradient-to-r from-transparent via-border to-transparent my-1" />}

              {/* Valyu Credits - Hidden in self-hosted mode */}
              {user && !isSelfHosted && (
                <div className="relative group/tooltip">
                  <button
                    onClick={handleManageCredits}
                    className="w-12 h-12 flex items-center justify-center hover:bg-accent rounded-[20px] transition-all duration-200 group hover:scale-110 active:scale-95"
                  >
                    <CreditCard className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-popover text-popover-foreground text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-border shadow-md">
                    Manage Credits
                  </div>
                </div>
              )}

              {/* Enterprise */}
              {user && process.env.NEXT_PUBLIC_APP_MODE !== 'self-hosted' && process.env.NEXT_PUBLIC_ENTERPRISE === 'true' && (
                <div className="relative group/tooltip">
                  <button
                    onClick={() => setShowEnterpriseModal(true)}
                    className="w-12 h-12 flex items-center justify-center hover:bg-accent rounded-[20px] transition-all duration-200 group hover:scale-110 active:scale-95"
                  >
                    <Building2 className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-popover text-popover-foreground text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-border shadow-md">
                    Enterprise Solutions
                  </div>
                </div>
              )}

              {/* Map Style - For signed-in users */}
              {user && (
                <div className="relative group/tooltip">
                  <button
                    onClick={() => setShowMapStyles(!showMapStyles)}
                    className="w-12 h-12 flex items-center justify-center hover:bg-accent rounded-[20px] transition-all duration-200 group hover:scale-110 active:scale-95"
                  >
                    <Globe2 className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-popover text-popover-foreground text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-border shadow-md">
                    Map Style
                  </div>
                </div>
              )}

              {/* Settings */}
              {user && (
                <div className="relative group/tooltip">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-12 h-12 flex items-center justify-center hover:bg-accent rounded-[20px] transition-all duration-200 group hover:scale-110 active:scale-95"
                  >
                    <Settings className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-popover text-popover-foreground text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-border shadow-md">
                    Settings
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className="w-10 h-px bg-gradient-to-r from-transparent via-border to-transparent mt-1" />

              {/* Log In Button for unauthenticated users */}
              {!user && (
                <div className="relative group/tooltip">
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('show-auth-modal'));
                    }}
                    className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 rounded-[20px] transition-all duration-200 hover:scale-110 active:scale-95 border border-primary/20 relative"
                  >
                    <LogOut className="h-6 w-6 text-primary rotate-180" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                  </button>
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-popover text-popover-foreground text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-border shadow-md">
                    Log in
                  </div>
                </div>
              )}

              {/* User Avatar with Dropdown */}
              {user && (
                <div className="relative group/tooltip">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="w-12 h-12 flex items-center justify-center hover:bg-accent rounded-[20px] transition-all duration-200 hover:scale-110 active:scale-95"
                  >
                    <Avatar className="h-9 w-9 ring-2 ring-transparent hover:ring-border transition-all">
                      <AvatarImage src={user.user_metadata?.avatar_url} />
                      <AvatarFallback className="text-xs bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold">
                        {user.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  {/* Only show tooltip when menu is NOT open */}
                  {!showProfileMenu && (
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-popover text-popover-foreground text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-border shadow-md">
                      Account
                    </div>
                  )}

                  {/* Profile Dropdown */}
                  <AnimatePresence>
                    {showProfileMenu && (
                      <>
                        {/* Backdrop to close on click away */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowProfileMenu(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, x: -10, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -10, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-full ml-4 bottom-0 bg-popover/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl py-2 px-1 min-w-[220px] z-50"
                        >
                        {/* User Email */}
                        <div className="px-3 py-2.5 mb-1">
                          <p className="text-xs text-muted-foreground mb-1">Signed in as</p>
                          <p className="text-sm font-medium text-popover-foreground truncate">
                            {user.email}
                          </p>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-border my-1" />

                        {/* Sign Out */}
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            const confirmed = window.confirm('Are you sure you want to sign out?');
                            if (confirmed) {
                              signOut();
                            }
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-500/10 rounded-xl transition-all duration-200"
                        >
                          <LogOut className="h-4 w-4" />
                          <span className="font-medium">Sign out</span>
                        </button>
                      </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Close Dock Button - Only show if not always open */}
              {!alwaysOpen && (
                <>
                  <div className="w-10 h-px bg-gradient-to-r from-transparent via-border to-transparent mt-2" />
                  <div className="relative group/tooltip">
                    <button
                      onClick={toggleSidebar}
                      className="w-12 h-12 flex items-center justify-center hover:bg-accent rounded-[20px] transition-all duration-200 hover:scale-110 active:scale-95 mt-2"
                    >
                      <svg
                        className="w-5 h-5 text-muted-foreground"
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
                    </button>
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-popover text-popover-foreground text-sm font-medium rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-border shadow-md">
                      Close
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Research History Panel - Hidden on mobile */}
      <AnimatePresence>
        {showHistory && (user || isSelfHosted) && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
              onClick={() => setShowHistory(false)}
            />

            {/* Panel - Responsive positioning */}
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{
                type: 'spring',
                damping: 30,
                stiffness: 300
              }}
              className="fixed left-0 sm:left-20 top-0 sm:top-4 bottom-0 sm:bottom-4 w-full sm:w-80 bg-card sm:rounded-3xl z-50 shadow-xl sm:ml-2 flex flex-col border-r sm:border border-border overflow-hidden"
            >
              {/* Header */}
              <div className="p-3 sm:p-4 border-b border-border flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-semibold text-card-foreground">Research History</h3>
                  <div className="flex items-center gap-1 sm:gap-2">
                    {/* Close button on mobile */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowHistory(false)}
                      className="h-9 w-9 p-0 sm:hidden min-h-11 min-w-11"
                      title="Close"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNewResearch}
                      className="h-9 w-9 p-0 min-h-11 min-w-11"
                      title="New Research"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Research Tasks List */}
              <div className="flex-1 overflow-y-auto">
                {loadingTasks ? (
                  <div className="space-y-2 p-3 sm:p-4">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="h-20 bg-muted rounded-xl animate-pulse"
                      />
                    ))}
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="flex items-center justify-center h-full p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-muted-foreground text-center">
                      No research history yet.<br />Click anywhere on the globe to start researching!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 py-2 px-3 sm:px-4">
                    {tasks.map((task: ResearchTask) => {
                      const StatusIcon = task.status === 'completed' ? CheckCircle2 : task.status === 'running' ? Loader : task.status === 'failed' ? AlertCircle : Clock;
                      const statusColor = task.status === 'completed' ? 'text-green-600' : task.status === 'running' ? 'text-blue-600' : task.status === 'failed' ? 'text-red-600' : 'text-muted-foreground';
                      const statusBg = task.status === 'completed' ? 'bg-green-500/10' : task.status === 'running' ? 'bg-blue-500/10' : task.status === 'failed' ? 'bg-red-500/10' : 'bg-muted';

                      return (
                        <div
                          key={task.id}
                          onClick={() => handleTaskSelect(task)}
                          className="flex items-start gap-2 sm:gap-2.5 p-2.5 sm:p-3 rounded-xl hover:bg-accent active:bg-accent group cursor-pointer transition-colors min-h-[60px]"
                        >
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs sm:text-sm font-medium text-foreground break-words">
                              {task.locationName}
                            </div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                              {new Date(task.createdAt).toLocaleDateString()}
                            </div>
                            <div className={`inline-flex items-center gap-1 mt-1.5 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium ${statusBg} ${statusColor}`}>
                              <StatusIcon className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${task.status === 'running' ? 'animate-spin' : ''}`} />
                              <span className="capitalize">{task.status}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modals */}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <SubscriptionModal
        open={showSubscription}
        onClose={() => setShowSubscription(false)}
      />

      <EnterpriseContactModal
        open={showEnterpriseModal}
        onClose={() => setShowEnterpriseModal(false)}
      />

      {/* Map Styles Panel - Hidden on mobile */}
      <AnimatePresence>
        {showMapStyles && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowMapStyles(false)}
            />
            <motion.div
              initial={{ x: -400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -400, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 sm:left-24 top-1/2 -translate-y-1/2 z-50 w-full sm:w-80 max-w-sm bg-popover/95 backdrop-blur-xl border-r sm:border border-border sm:rounded-2xl shadow-2xl p-4 sm:p-6"
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-popover-foreground">Map Style</h3>
                <button
                  onClick={() => setShowMapStyles(false)}
                  className="sm:hidden p-2 hover:bg-accent rounded-lg min-h-11 min-w-11"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                {[
                  { value: 'satellite-streets-v12', label: 'Satellite Streets', description: 'Satellite imagery with labels' },
                  { value: 'satellite-v9', label: 'Satellite', description: 'Pure satellite imagery' },
                  { value: 'streets-v12', label: 'Streets', description: 'Classic street map' },
                  { value: 'outdoors-v12', label: 'Outdoors', description: 'Topographic style' },
                  { value: 'light-v11', label: 'Light', description: 'Minimal light theme' },
                  { value: 'dark-v11', label: 'Dark', description: 'Minimal dark theme' },
                  { value: 'navigation-day-v1', label: 'Navigation Day', description: 'Navigation optimized' },
                  { value: 'navigation-night-v1', label: 'Navigation Night', description: 'Night mode navigation' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onGlobeThemeChange?.(option.value);
                      setShowMapStyles(false);
                    }}
                    className={`w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all min-h-12 ${
                      globeTheme === option.value
                        ? 'bg-primary/10 border-l-2 border-primary'
                        : 'hover:bg-accent active:bg-accent'
                    }`}
                  >
                    <div className="font-medium text-xs sm:text-sm text-popover-foreground">{option.label}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">{option.description}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
