'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/stores/use-auth-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ExternalLink, Zap, Check, Wallet, Building2 } from 'lucide-react';
import { track } from '@vercel/analytics';
import { EnterpriseContactModal } from '@/components/enterprise/enterprise-contact-modal';

interface SubscriptionModalProps {
  open: boolean;
  onClose: () => void;
}

export function SubscriptionModal({ open, onClose }: SubscriptionModalProps) {
  const user = useAuthStore((state) => state.user);
  const valyuAccessToken = useAuthStore((state) => state.valyuAccessToken);
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);

  const handleEnterpriseClick = () => {
    track('Enterprise CTA Clicked', { source: 'subscription_modal' });
    onClose();
    setTimeout(() => {
      setShowEnterpriseModal(true);
    }, 100);
  };

  const handleManageCredits = () => {
    track('Manage Credits Clicked', { source: 'subscription_modal' });
    window.open('https://platform.valyu.ai', '_blank');
  };

  // Show Valyu credits management for authenticated users
  if (user && valyuAccessToken) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="!max-w-2xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <DialogHeader className="space-y-3 pb-6">
            <DialogTitle className="text-2xl font-semibold text-gray-900 dark:text-gray-100 text-center">
              Your Valyu Credits
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Current Plan Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-600 dark:bg-blue-700 rounded-lg">
                    <Wallet className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      Valyu Credits
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Managed by Valyu Platform
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-gray-700 dark:text-gray-300">Unlimited queries (credit-based)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-gray-700 dark:text-gray-300">Full tool access</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-gray-700 dark:text-gray-300">Download reports</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-gray-700 dark:text-gray-300">Credits shared across your organization</span>
                </div>
              </div>
            </div>

            {/* Manage Credits Button */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleManageCredits}
                className="w-full"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Manage Credits on Valyu Platform
              </Button>
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                View balance, add credits, and manage your organization
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show sign-in prompt for unauthenticated users
  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="!max-w-md sm:!max-w-2xl !w-[96vw] sm:!w-[90vw] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-2 sm:space-y-3 pb-4 sm:pb-6">
            <DialogTitle className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 text-center px-2">
              Get Full Access with Valyu
            </DialogTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-lg mx-auto px-2">
              Sign in with your Valyu account to unlock unlimited research powered by your organization&apos;s credits.
            </p>
          </DialogHeader>

          <div className="space-y-4">
            {/* Benefits */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-blue-600 dark:bg-blue-700 rounded-lg">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Why Sign In?</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-medium">Unlimited queries</span> - No daily limits</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-medium">Use your existing credits</span> - From your Valyu organization</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-medium">Single sign-on</span> - Works across all Valyu apps</p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-medium">Save your research</span> - Access history and reports</p>
                </div>
              </div>
            </div>

            {/* Enterprise Option */}
            {process.env.NEXT_PUBLIC_APP_MODE !== 'self-hosted' && process.env.NEXT_PUBLIC_ENTERPRISE === 'true' && (
              <motion.div
                className="relative group cursor-pointer"
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                onClick={handleEnterpriseClick}
              >
                <div className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg">
                      <Building2 className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Need Enterprise?</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Custom deployment for your organization</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Info text */}
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              Don&apos;t have a Valyu account? <a href="https://platform.valyu.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Create one for free</a>
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <EnterpriseContactModal
        open={showEnterpriseModal}
        onClose={() => setShowEnterpriseModal(false)}
      />
    </>
  );
}
