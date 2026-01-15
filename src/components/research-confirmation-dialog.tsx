'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, ChevronDown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/lib/stores/use-auth-store';
import { Favicon } from '@/components/ui/favicon';

interface ResearchConfirmationDialogProps {
  location: { name: string; lat: number; lng: number } | null;
  onConfirm: (customInstructions?: string, excludedSources?: string[]) => void;
  onCancel: () => void;
  onSignUp?: () => void;
}

const PRESETS = [
  {
    id: 'general',
    label: 'General',
    prompt: 'Provide a comprehensive historical overview of this location, covering major events, cultural significance, and key developments throughout history.',
  },
  {
    id: 'wars',
    label: 'Wars',
    prompt: 'Focus on wars, battles, and military conflicts that have taken place at this location. Include details about the opposing forces, key battles, strategies, outcomes, and historical impact.',
  },
  {
    id: 'nature',
    label: 'Nature',
    prompt: 'Research the natural history and geography of this location, including geological formations, climate history, natural landmarks, ecosystems, and environmental changes over time.',
  },
  {
    id: 'animals',
    label: 'Wildlife',
    prompt: 'Focus on the animal life and wildlife of this location, including native species, extinct fauna, conservation efforts, and the relationship between wildlife and human settlement.',
  },
  {
    id: 'people',
    label: 'People',
    prompt: 'Research notable people associated with this location, including historical figures, leaders, artists, scientists, and their contributions to history and culture.',
  },
  {
    id: 'architecture',
    label: 'Architecture',
    prompt: 'Focus on architectural history and significant buildings at this location, including historical structures, architectural styles, construction techniques, and cultural importance.',
  },
  {
    id: 'culture',
    label: 'Culture',
    prompt: 'Research the cultural and artistic heritage of this location, including traditions, customs, art movements, literature, music, and cultural practices throughout history.',
  },
  {
    id: 'economy',
    label: 'Economy',
    prompt: 'Focus on the economic history and trade of this location, including major industries, trade routes, economic developments, and the evolution of commerce.',
  },
  {
    id: 'news',
    label: 'News',
    prompt: 'Research current and recent news events at this location, including significant political developments, social movements, disasters, celebrations, and noteworthy incidents.',
  },
  {
    id: 'geology',
    label: 'Geology',
    prompt: 'Focus on the geological history and features of this location, including rock formations, tectonic activity, volcanic history, erosion patterns, mineral deposits, and the geological forces that shaped the landscape.',
  },
  {
    id: 'culinary',
    label: 'Culinary',
    prompt: 'Research the culinary history and food culture of this location, including traditional dishes, cooking techniques, local ingredients, food-related traditions, and the evolution of cuisine over time.',
  },
];

export function ResearchConfirmationDialog({
  location,
  onConfirm,
  onCancel,
  onSignUp,
}: ResearchConfirmationDialogProps) {
  const { user } = useAuthStore();
  const [selectedPreset, setSelectedPreset] = useState<string>('general');
  const [customInstructions, setCustomInstructions] = useState('');
  const [showCustom, setShowCustom] = useState(true);
  const [wikipediaDisabled, setWikipediaDisabled] = useState(false);

  if (!location) return null;

  const handleConfirm = () => {
    const excludedSources = wikipediaDisabled ? ['wikipedia.org'] : undefined;
    if (customInstructions.trim()) {
      onConfirm(customInstructions.trim(), excludedSources);
    } else {
      const preset = PRESETS.find(p => p.id === selectedPreset);
      onConfirm(preset?.prompt, excludedSources);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onCancel}
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-background rounded-xl shadow-2xl max-w-md w-full border"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold truncate">
                Research {location.name}
              </h2>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                Choose a focus or leave blank for general history
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 sm:p-2 hover:bg-accent rounded-lg transition-colors flex-shrink-0 min-h-11 min-w-11 flex items-center justify-center"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3">
            {/* Preset Pills */}
            <div>
              <label className="block text-[10px] sm:text-xs font-medium text-muted-foreground mb-1.5 sm:mb-2">
                Quick presets (optional)
              </label>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedPreset(preset.id);
                      setCustomInstructions('');
                    }}
                    className={`px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-all border min-h-8 ${
                      selectedPreset === preset.id && !customInstructions
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-card text-card-foreground border-border hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Instructions Dropdown */}
            <div>
              <button
                onClick={() => setShowCustom(!showCustom)}
                className="w-full flex items-center justify-between text-[10px] sm:text-xs font-medium text-muted-foreground hover:text-foreground transition-colors min-h-9"
              >
                <span>Custom instructions (optional)</span>
                <ChevronDown className={`h-3 w-3 transition-transform flex-shrink-0 ${showCustom ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showCustom && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <Textarea
                      value={customInstructions}
                      onChange={(e) => {
                        setCustomInstructions(e.target.value);
                        if (e.target.value) setSelectedPreset('');
                      }}
                      placeholder="e.g., Focus on indigenous peoples before colonization..."
                      className="min-h-[70px] sm:min-h-[80px] text-xs sm:text-sm resize-none mt-1.5 sm:mt-2"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Source Exclusions */}
            <div>
              <label className="block text-[10px] sm:text-xs font-medium text-muted-foreground mb-1.5 sm:mb-2">
                Exclude sources (optional)
              </label>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                <button
                  onClick={() => setWikipediaDisabled(!wikipediaDisabled)}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-all border min-h-8 ${
                    wikipediaDisabled
                      ? 'bg-destructive/10 text-destructive border-destructive/30 line-through'
                      : 'bg-card text-card-foreground border-border hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Favicon url="https://wikipedia.org" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Wikipedia</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t">
            {!user ? (
              // Anonymous user - show signup incentive
              <div className="space-y-2">
                <Button
                  onClick={handleConfirm}
                  size="default"
                  variant="outline"
                  className="w-full font-semibold min-h-11 text-xs sm:text-sm"
                >
                  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  <span className="truncate">Continue Without Signup</span>
                </Button>
                {onSignUp && (
                  <Button
                    onClick={onSignUp}
                    size="default"
                    className="w-full font-semibold min-h-11 text-xs sm:text-sm"
                  >
                    <span className="truncate">Sign Up to Save Research</span>
                  </Button>
                )}
              </div>
            ) : (
              // Signed in user - show normal buttons
              <div className="flex gap-2 justify-between items-center">
                <Button
                  variant="ghost"
                  onClick={onCancel}
                  size="sm"
                  className="min-h-11 text-xs sm:text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  size="default"
                  className="px-4 sm:px-6 font-semibold min-h-11 text-xs sm:text-sm"
                >
                  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  <span className="truncate">Start Research</span>
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
