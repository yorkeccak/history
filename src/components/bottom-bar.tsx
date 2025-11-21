"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Menu, X, LogIn, UserPlus, User, Settings, CreditCard, History as HistoryIcon, LogOut } from "lucide-react";
import { useAuthStore } from "@/lib/stores/use-auth-store";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import SocialLinks from "./social-links";

interface BottomBarProps {
  onShowAuth?: () => void;
  onShowSettings?: () => void;
  onShowSubscription?: () => void;
  onShowHistory?: () => void;
}

const BottomBar = ({ onShowAuth, onShowSettings, onShowSubscription, onShowHistory }: BottomBarProps) => {
  const { user, signOut } = useAuthStore();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setShowMobileMenu(false);
  };

  return (
    <>
      {/* Mobile Menu Button - Only visible on mobile */}
      <motion.div
        className="fixed bottom-3 right-3 z-30 sm:hidden"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      >
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="h-12 w-12 rounded-full bg-background/90 backdrop-blur-sm border-2 shadow-lg"
        >
          {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </motion.div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {showMobileMenu && (
          <motion.div
            className="fixed bottom-16 right-3 z-30 sm:hidden"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="bg-background/95 backdrop-blur-xl border-2 rounded-2xl shadow-2xl p-2 min-w-[200px]">
              {user ? (
                <>
                  {/* User Profile Section */}
                  <div className="px-3 py-2 mb-2 border-b">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.user_metadata?.avatar_url} />
                        <AvatarFallback>
                          {user.email?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onShowHistory?.();
                      setShowMobileMenu(false);
                    }}
                    className="w-full justify-start gap-2 h-10"
                  >
                    <HistoryIcon className="h-4 w-4" />
                    <span className="text-sm">History</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onShowSubscription?.();
                      setShowMobileMenu(false);
                    }}
                    className="w-full justify-start gap-2 h-10"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span className="text-sm">Subscription</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onShowSettings?.();
                      setShowMobileMenu(false);
                    }}
                    className="w-full justify-start gap-2 h-10"
                  >
                    <Settings className="h-4 w-4" />
                    <span className="text-sm">Settings</span>
                  </Button>

                  <div className="border-t mt-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSignOut}
                      className="w-full justify-start gap-2 h-10 text-destructive hover:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="text-sm">Sign Out</span>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onShowAuth?.();
                      setShowMobileMenu(false);
                    }}
                    className="w-full justify-start gap-2 h-10"
                  >
                    <LogIn className="h-4 w-4" />
                    <span className="text-sm">Sign In</span>
                  </Button>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      onShowAuth?.();
                      setShowMobileMenu(false);
                    }}
                    className="w-full justify-start gap-2 h-10 mt-1"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span className="text-sm">Sign Up</span>
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Right - Social Links - Always visible on desktop, hidden on mobile */}
      <motion.div
        className="fixed bottom-7 sm:bottom-9 right-2 sm:right-4 z-30 transition-opacity duration-300 hidden sm:flex flex-col items-end gap-3"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1, duration: 0.5, ease: "easeOut" }}
      >
        {/* Social Links */}
        <SocialLinks />
      </motion.div>
    </>
  );
};

export default BottomBar;