'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Sparkles, History, Gift } from 'lucide-react';
import Image from 'next/image';

interface SignupPromptProps {
  open: boolean;
  onClose: () => void;
  onSignUp: () => void;
}

export function SignupPrompt({ open, onClose, onSignUp }: SignupPromptProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] sm:w-full max-w-lg"
          >
            <div className="bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-lg hover:bg-accent transition-colors z-10 min-h-11 min-w-11"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Content */}
              <div className="p-4 sm:p-8">
                {/* Icon */}
                <div className="flex justify-center mb-4 sm:mb-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center border border-primary/20">
                    <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-lg sm:text-2xl font-semibold text-center mb-2 text-foreground px-2">
                  Sign in to Continue
                </h2>

                {/* Subtitle */}
                <p className="text-center text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 px-2">
                  Sign in with Valyu to run deep research queries
                </p>

                {/* Free Credits Badge */}
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Gift className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="text-green-600 dark:text-green-400 font-bold">$10 Free Credits</span>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    New accounts get $10 in free search credits
                  </p>
                </div>

                {/* Features */}
                <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 border border-border">
                      <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-xs sm:text-sm text-foreground">
                        Unlimited Deep Research
                      </h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        Run as many queries as you need with your Valyu credits
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 border border-border">
                      <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-xs sm:text-sm text-foreground">
                        Save Your Research
                      </h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        Access your research history anytime, anywhere
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA Button */}
                <Button
                  onClick={onSignUp}
                  size="lg"
                  className="w-full min-h-11 sm:min-h-12 text-sm sm:text-base bg-black hover:bg-gray-800 text-white font-medium"
                >
                  <span className="flex items-center justify-center gap-3">
                    <span>Sign in with</span>
                    <Image
                      src="/valyu.svg"
                      alt="Valyu"
                      width={60}
                      height={20}
                      className="h-5 w-auto invert"
                    />
                  </span>
                </Button>

                {/* Note */}
                <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-3 sm:mt-4">
                  Super frictionless. Create an account in seconds.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
