'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Loader2, MapPin, ExternalLink, FileText, Lightbulb, CornerDownRight, Globe2, CheckCircle2, Brain, Clock, Sparkles, Share2, Check, Copy, Compass, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PhotoGallery } from '@/components/ui/gallery';
import { motion, AnimatePresence } from 'framer-motion';
import { Favicon } from '@/components/ui/favicon';
import { ReasoningDialog } from '@/components/reasoning-dialog';
import { calculateAgentMetrics } from '@/lib/metrics-calculator';
import { useAuthStore } from '@/lib/stores/use-auth-store';
import { loadValyuTokens } from '@/lib/valyu-oauth';
import { Globe } from '@/components/globe';

interface Source {
  title: string;
  url: string;
  snippet?: string;
  doi?: string;
  source?: string;
}

interface ResearchImage {
  image_url: string;
  title?: string;
  image_type?: string;
}

interface ToolCall {
  toolCallId: string;
  toolName: string;
  input?: any;
}

interface ToolResult {
  toolCallId: string;
  toolName: string;
  output?: any;
}

interface TextContent {
  type: 'text';
  text: string;
}

interface ReasoningContent {
  type: 'reasoning';
  text: string;
}

type MessageContent = TextContent | ReasoningContent | ToolCall | ToolResult;

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: MessageContent[];
}

interface HistoryResearchInterfaceProps {
  location: { name: string; lat: number; lng: number } | null;
  onClose: () => void;
  onTaskCreated?: (taskId: string) => void;
  initialTaskId?: string;
  customInstructions?: string;
  initialImages?: string[];
  excludedSources?: string[];
}

const AnimatedDots = ({ isActive }: { isActive: boolean }) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!isActive) {
      setDots('');
      return;
    }

    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isActive]);

  return <span className="inline-block w-6 text-left">{dots}</span>;
};

const TimelineItem = ({ item, idx, timeline, animated = true }: { item: any; idx: number; timeline: any[]; animated?: boolean }) => {
  const ItemWrapper: any = animated ? motion.div : 'div';
  const itemProps = animated ? {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2 }
  } : {};

  if (!item || !item.type) return null;

  if (item.type === 'text') {
    const isReasoning = item.contentType === 'reasoning';

    return (
      <ItemWrapper key={`text-${idx}`} {...itemProps}>
        <div className={`overflow-hidden rounded-lg border backdrop-blur-sm shadow-sm ${
          isReasoning
            ? 'border-amber-200/40 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20'
            : 'border-border/40 bg-background/90'
        }`}>
          <div className={`px-3 py-2 border-b ${
            isReasoning
              ? 'bg-amber-100/30 border-amber-200/30 dark:bg-amber-900/10 dark:border-amber-900/30'
              : 'bg-muted/10 border-border/30'
          }`}>
            <div className={`flex items-center gap-2 ${
              isReasoning ? 'text-foreground/70' : 'text-foreground/70'
            }`}>
              {isReasoning ? (
                <Lightbulb className="h-3.5 w-3.5" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              <span className="text-xs font-semibold">
                {isReasoning ? 'Reasoning' : 'Model Response'}
              </span>
            </div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-xs text-foreground/80 prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-a:text-primary prose-strong:text-foreground prose-code:text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {item.text}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </ItemWrapper>
    );
  } else if (item.type === 'tool-call') {
    if (!item.toolCallId || !item.toolName) return null;

    const resultItem = timeline.find(
      (t: any) => t && t.type === 'tool-result' && t.toolCallId === item.toolCallId
    );

    const resultSources = resultItem?.output?.value?.sources || resultItem?.output?.sources || [];
    const resultText = resultItem?.output?.value?.text || resultItem?.output?.text || '';
    const hasResult = !!resultItem && (resultSources.length > 0 || resultText);

    return (
      <ItemWrapper key={`tool-call-${idx}-${item.toolCallId}`} {...itemProps}>
        <div className={`overflow-hidden rounded-lg border backdrop-blur-sm shadow-sm ${
          hasResult
            ? 'border-blue-200/40 bg-blue-50/20 dark:border-blue-900/40 dark:bg-blue-950/10'
            : 'border-border/40 bg-muted/20'
        }`}>
          <div className={`px-3 py-2 border-b ${
            hasResult
              ? 'bg-blue-100/20 border-blue-200/30 dark:bg-blue-900/10 dark:border-blue-900/30'
              : 'bg-muted/10 border-border/30'
          }`}>
            <div className={`flex items-center gap-2 ${
              hasResult
                ? 'text-foreground/80'
                : 'text-foreground/60'
            }`}>
              {hasResult ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              <span className="text-xs font-semibold">{item.toolName}</span>
            </div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-xs text-foreground/80 break-words whitespace-pre-wrap">
              {typeof item.input === 'object'
                ? item.input?.query || JSON.stringify(item.input, null, 2)
                : String(item.input || '')}
            </div>
          </div>
        </div>
      </ItemWrapper>
    );
  } else if (item.type === 'tool-result') {
    const sources = item.output?.value?.sources || item.output?.sources || [];
    const resultText = item.output?.value?.text || item.output?.text || '';
    const hasContent = sources.length > 0 || resultText;

    if (!hasContent) return null;

    return (
      <ItemWrapper
        key={`tool-result-${idx}-${item.toolCallId}`}
        className="flex gap-2.5 pl-1"
        {...itemProps}
      >
        <div className="flex items-start pt-1">
          <CornerDownRight className="h-3.5 w-3.5 text-green-600/40 flex-shrink-0" />
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            <div className="text-[10px] font-medium text-green-700 uppercase tracking-wide">
              {sources.length > 0 ? `${sources.length} ${sources.length === 1 ? 'Source' : 'Sources'} Found` : 'Result'}
            </div>
          </div>
          {sources.length > 0 && (
            <div className="space-y-1.5">
              {sources.map((source: any, sourceIdx: number) => (
                <a
                  key={sourceIdx}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 p-2.5 bg-green-50/40 dark:bg-green-950/20 rounded-lg border border-green-200/40 dark:border-green-900/40 hover:border-primary hover:bg-green-50/60 dark:hover:bg-green-950/30 transition-colors shadow-sm"
                >
                  {source.url && (
                    <Favicon url={source.url} className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium line-clamp-1 group-hover:text-primary transition-colors">
                      {source.title || 'Untitled'}
                    </div>
                    {source.snippet && (
                      <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                        {source.snippet}
                      </div>
                    )}
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          )}
          {resultText && (
            <div className="text-xs text-muted-foreground p-2.5 bg-muted/20 rounded-lg border border-border/50 max-h-32 overflow-y-auto">
              <pre className="whitespace-pre-wrap font-mono text-[10px]">{resultText}</pre>
            </div>
          )}
        </div>
      </ItemWrapper>
    );
  }
  return null;
};

export function HistoryResearchInterface({ location, onClose, onTaskCreated, initialTaskId, customInstructions, initialImages, excludedSources }: HistoryResearchInterfaceProps) {
  const { user, valyuAccessToken } = useAuthStore();
  const [status, setStatus] = useState<'idle' | 'queued' | 'running' | 'completed' | 'error'>('idle');
  const [showMiniGlobe, setShowMiniGlobe] = useState(true);
  const [content, setContent] = useState<string>('');
  const [sources, setSources] = useState<Source[]>([]);
  const [images, setImages] = useState<ResearchImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 10 });
  const [messages, setMessages] = useState<Message[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [shouldContinuePolling, setShouldContinuePolling] = useState(false);
  const [messagesVersion, setMessagesVersion] = useState(0);
  const [displayLocation, setDisplayLocation] = useState(location);
  const [showReasoningDialog, setShowReasoningDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [heroImages, setHeroImages] = useState<string[]>(initialImages || []);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const globeInitialCenter = useMemo<[number, number] | undefined>(() => {
    if (displayLocation && displayLocation.lat !== 0 && displayLocation.lng !== 0) {
      return [displayLocation.lng, displayLocation.lat];
    }
    return undefined;
  }, [displayLocation]);

  const globeMarker = useMemo<{ lat: number; lng: number } | undefined>(() => {
    if (displayLocation && displayLocation.lat !== 0 && displayLocation.lng !== 0) {
      return { lat: displayLocation.lat, lng: displayLocation.lng };
    }
    return undefined;
  }, [displayLocation]);

  const handleGlobeLocationClick = useCallback(() => {
  }, []);

  const handleShare = async () => {
    if (!user || !taskId) return;

    setSharing(true);
    try {
      // Get the actual task ID from the database
      const tasksResponse = await fetch('/api/research/tasks');
      const { tasks } = await tasksResponse.json();
      const task = tasks.find((t: any) => t.deepresearchId === taskId);

      if (!task) {
        throw new Error('Task not found');
      }

      const response = await fetch('/api/research/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          images: heroImages.length > 0 ? heroImages : undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to share');

      const data = await response.json();
      setShareUrl(data.shareUrl);

      // Copy to clipboard
      await navigator.clipboard.writeText(data.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fail silently - non-critical operation
    } finally {
      setSharing(false);
    }
  };


  const handleDownloadPdf = async () => {
    if (!taskId || !displayLocation) return;

    setDownloadingPdf(true);
    try {
      const response = await fetch('/api/reports/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskId,
          locationName: displayLocation.name,
          valyuAccessToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `history-${displayLocation.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      // Fail silently - non-critical operation
    } finally {
      setDownloadingPdf(false);
    }
  };

  const generateHeroImage = useCallback(async () => {
    if (!location || isGeneratingImage) return;

    setIsGeneratingImage(true);
    try {
      // Load token directly from localStorage (store may not be hydrated yet)
      const valyuTokens = loadValyuTokens();
      const token = valyuTokens?.accessToken;

      const response = await fetch('/api/history/select-location-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationName: location.name,
          valyuAccessToken: token,
        }),
      });

      const { images, reasoning } = await response.json();

      if (images && images.length > 0) {
        setHeroImages(images);

        // Store images in localStorage with taskId for persistence
        if (taskId) {
          try {
            localStorage.setItem(`research_images_${taskId}`, JSON.stringify(images));
          } catch (err) {
            // Fail silently - non-critical operation
          }
        }
      } else {
        setHeroImages([]);
      }
    } catch (error) {
      setHeroImages([]);
    } finally {
      setIsGeneratingImage(false);
    }
  }, [location, isGeneratingImage, customInstructions, taskId]);

  const pollTaskStatus = useCallback(async (taskId: string) => {
    try {
      const headers: HeadersInit = {};
      if (valyuAccessToken) {
        headers['Authorization'] = `Bearer ${valyuAccessToken}`;
      }
      const response = await fetch(`/api/chat/poll?taskId=${taskId}`, { headers });
      if (!response.ok) {
        throw new Error('Failed to poll task status');
      }

      const statusData = await response.json();
      console.log('[Poll Client] Status:', statusData.status, 'hasOutput:', !!statusData.output);

      // Update progress
      if (statusData.status === 'running') {
        setStatus('running');
        // Progress info is in statusData.progress object
        const progress = statusData.progress || {};
        setProgress({
          current: progress.current_step || progress.step || 0,
          total: progress.total_steps || progress.total || 10,
        });

        // Extract location from query if displayLocation not set properly
        if (statusData.query && (!displayLocation || displayLocation.name === 'Loading research...')) {
          const locationMatch = statusData.query.match(/Location:\s*(.+)$/m);
          if (locationMatch && locationMatch[1]) {
            setDisplayLocation({
              name: locationMatch[1].trim(),
              lat: displayLocation?.lat || 0,
              lng: displayLocation?.lng || 0
            });
          }
        }

        // Update messages array if provided
        if (statusData.messages && Array.isArray(statusData.messages) && statusData.messages.length > 0) {
          setMessages([...statusData.messages]);
          setMessagesVersion(v => v + 1);
        }

        // Update content/sources/images if provided during running state
        if (statusData.output) {
          setContent(statusData.output);
        }

        if (statusData.sources && Array.isArray(statusData.sources) && statusData.sources.length > 0) {
          setSources(statusData.sources);
        }

        if (statusData.images && Array.isArray(statusData.images) && statusData.images.length > 0) {
          setImages(statusData.images);
        }

        return { completed: false };
      } else if (statusData.status === 'completed') {

        // Extract content - prioritize output field
        let extractedContent = '';
        if (statusData.output) {
          extractedContent = statusData.output;
        } else if (statusData.messages && Array.isArray(statusData.messages) && statusData.messages.length > 0) {
          // Fallback: extract content from last message
          const lastMessage = statusData.messages[statusData.messages.length - 1];
          if (lastMessage?.role === 'assistant' && Array.isArray(lastMessage.content)) {
            extractedContent = lastMessage.content
              .filter((item: any) => item.type === 'text')
              .map((item: any) => item.text)
              .join('\n\n');
          }
        }

        // Extract location from query if displayLocation not set properly
        if (statusData.query && (!displayLocation || displayLocation.name === 'Loading research...')) {
          // Parse location from query (format: "Research the ... \n\nLocation: Location Name")
          const locationMatch = statusData.query.match(/Location:\s*(.+)$/m);
          if (locationMatch && locationMatch[1]) {
            setDisplayLocation({
              name: locationMatch[1].trim(),
              lat: displayLocation?.lat || 0,
              lng: displayLocation?.lng || 0
            });
          }
        }

        // Update all state in batch before changing status
        // ALWAYS set content even if empty - component will handle empty state
        setContent(extractedContent);

        if (statusData.messages && Array.isArray(statusData.messages) && statusData.messages.length > 0) {
          setMessages([...statusData.messages]);
          setMessagesVersion(v => v + 1);
        }

        if (statusData.sources && Array.isArray(statusData.sources) && statusData.sources.length > 0) {
          setSources(statusData.sources);
        }

        if (statusData.images && Array.isArray(statusData.images) && statusData.images.length > 0) {
          setImages(statusData.images);
        }

        // Set status to completed LAST, after all content is ready
        console.log('[Poll Client] Setting status to completed, content length:', extractedContent.length);
        setStatus('completed');
        return { completed: true };
      } else if (statusData.status === 'failed') {
        throw new Error(statusData.error || 'Research task failed');
      }

      return { completed: false };
    } catch (err) {
      throw err;
    }
  }, [displayLocation, valyuAccessToken]);

  useEffect(() => {
    if (initialTaskId && !taskId) {
      setTaskId(initialTaskId);
      setShouldContinuePolling(true);

      try {
        const cachedImages = localStorage.getItem(`research_images_${initialTaskId}`);
        if (cachedImages) {
          const images = JSON.parse(cachedImages);
          setHeroImages(images);
        }
      } catch (err) {
      }
    }
  }, [initialTaskId, taskId]);

  const researchInitiatedRef = useRef(false);
  const previousLocationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!location || initialTaskId) return;
    const locationKey = `${location.name}_${location.lat}_${location.lng}`;
    if (previousLocationRef.current !== locationKey) {
      previousLocationRef.current = locationKey;
      researchInitiatedRef.current = false;
    }

    if (researchInitiatedRef.current) {
      return;
    }

    const runResearch = async () => {
      researchInitiatedRef.current = true;

      setStatus('queued');
      setContent('');
      setSources([]);
      setImages([]);
      setError(null);
      setMessages([]);
      setTaskId(null);
      setShouldContinuePolling(false);

      try {
        const researchPrompt = customInstructions
          ? `${customInstructions}\n\nLocation: ${location.name}`
          : `Research the history of ${location.name}`;

        // Get Valyu access token if available
        const valyuTokens = loadValyuTokens();
        const valyuAccessToken = valyuTokens?.accessToken;

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: researchPrompt,
              },
            ],
            location,
            valyuAccessToken,
            excludedSources,
          }),
        });

        if (!response.ok) {
          // Handle auth required errors
          if (response.status === 401) {
            const errorData = await response.json();
            if (errorData.error === 'AUTH_REQUIRED') {
              // Show auth modal
              window.dispatchEvent(new CustomEvent('show-auth-modal'));
              setStatus('idle');
              onClose();
              return;
            }
          }
          // Handle credit errors
          if (response.status === 402) {
            const errorData = await response.json();
            const creditError = new Error(errorData.message || 'Insufficient credits');
            (creditError as any).isCredit = true;
            throw creditError;
          }
          throw new Error('Failed to start research');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                switch (data.type) {
                  case 'task_created':
                    setTaskId(data.taskId);
                    // Notify parent to update URL
                    if (onTaskCreated && data.taskId) {
                      onTaskCreated(data.taskId);
                    }
                    break;
                  case 'status':
                    setStatus(data.status);
                    break;
                  case 'continue_polling':
                    setShouldContinuePolling(true);
                    setTaskId(data.taskId);
                    break;
                  case 'progress':
                    setStatus('running');
                    setProgress({
                      current: data.current_step || 0,
                      total: data.total_steps || 10,
                    });
                    break;
                  case 'message_update':
                    // Handle individual message updates from streaming
                    if (data.data && data.content_type) {
                      setMessages((prev) => {
                        const newMessages = [...prev];

                        // Get the role from the message (assistant or tool)
                        const messageRole = data.message_role || 'assistant';

                        // Find or create the last message with matching role
                        let lastMessageIndex = -1;
                        for (let i = newMessages.length - 1; i >= 0; i--) {
                          if (newMessages[i].role === messageRole) {
                            lastMessageIndex = i;
                            break;
                          }
                        }

                        if (lastMessageIndex === -1) {
                          // Create new message with the appropriate role
                          newMessages.push({
                            role: messageRole as 'assistant' | 'tool',
                            content: [data.data],
                          });
                        } else {
                          // Append to existing message
                          const existing = newMessages[lastMessageIndex];
                          if (Array.isArray(existing.content)) {
                            existing.content = [...existing.content, data.data];
                          }
                        }

                        return newMessages;
                      });
                      setMessagesVersion(v => v + 1);
                    }
                    break;
                  case 'content':
                    setContent(data.content || '');
                    // Don't set status to completed yet - wait for 'done' event
                    // This ensures all data (sources, images) are received before showing completed state
                    break;
                  case 'sources':
                    setSources(data.sources || []);
                    break;
                  case 'images':
                    setImages(data.images || []);
                    break;
                  case 'error':
                    setError(data.error || 'Unknown error');
                    setStatus('error');
                    break;
                  case 'done':
                    // SSE stream is done - poll to get final status and content
                    // Don't set status yet - let polling handle it to ensure we have content
                    setShouldContinuePolling(true);
                    break;
                }
              } catch (e) {
                // Fail silently - non-critical operation
              }
            }
          }
        }
      } catch (err) {
        // Handle credit errors by showing a user-friendly message
        if ((err as any).isCredit) {
          setError('Insufficient Valyu credits. Add credits at platform.valyu.ai');
        } else {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
        setStatus('error');
      }
    };

    runResearch();
  }, [location, initialTaskId]);

  useEffect(() => {
    if (!shouldContinuePolling || !taskId) return;

    let pollingInterval: NodeJS.Timeout;

    const startPolling = async () => {
      const poll = async () => {
        try {
          const result = await pollTaskStatus(taskId);

          if (result.completed) {
            setShouldContinuePolling(false);
            if (pollingInterval) {
              clearInterval(pollingInterval);
            }
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Polling error');
          setStatus('error');
          setShouldContinuePolling(false);
          if (pollingInterval) {
            clearInterval(pollingInterval);
          }
        }
      };
      await poll();
      pollingInterval = setInterval(poll, 2000);
    };

    startPolling();

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [shouldContinuePolling, taskId, pollTaskStatus]);
  const [imageGenerationAttempted, setImageGenerationAttempted] = useState(false);

  useEffect(() => {
    if (status === 'running' && heroImages.length === 0 && !isGeneratingImage && !imageGenerationAttempted) {
      setImageGenerationAttempted(true);
      generateHeroImage();
    }
  }, [status, heroImages.length, isGeneratingImage, imageGenerationAttempted, generateHeroImage]);
  const timeline = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    const items: any[] = [];
    const toolResults = new Map<string, any>();
    let messageIndex = 0;

    // First pass: collect all tool results by toolCallId
    messages.forEach((message) => {
      if (!message || !message.role) return;

      if (message.role === 'tool' && Array.isArray(message.content)) {
        message.content.forEach((item: any) => {
          if (item?.type === 'tool-result' && item.toolCallId) {
            toolResults.set(item.toolCallId, {
              type: 'tool-result' as const,
              toolCallId: item.toolCallId,
              output: item.output,
            });
          }
        });
      }
    });

    // Second pass: build timeline with tool-calls, tool-results, and text
    const seenTexts = new Set<string>();

    messages.forEach((message) => {
      if (!message || !message.role) return;

      if (message.role === 'assistant' && Array.isArray(message.content)) {
        message.content.forEach((item: any) => {
          if (!item || !item.type) return;

          if (item.type === 'text' || item.type === 'reasoning') {
            if (item.text) {
              // Deduplicate text items by content
              const textKey = `${item.type}:${item.text}`;
              if (!seenTexts.has(textKey)) {
                seenTexts.add(textKey);
                items.push({
                  type: 'text' as const,
                  text: item.text,
                  contentType: item.type,
                  messageIndex,
                });
              }
            }
          } else if (item.type === 'tool-call') {
            if (item.toolCallId && item.toolName) {
              // Add the tool-call
              items.push({
                type: 'tool-call' as const,
                toolCallId: item.toolCallId,
                toolName: item.toolName,
                input: item.input,
                messageIndex,
              });

              // Immediately add its result if it exists
              const result = toolResults.get(item.toolCallId);
              if (result) {
                items.push(result);
              }
            }
          }
        });
        messageIndex++;
      } else if (message.role === 'tool' && Array.isArray(message.content)) {
        // Also process tool messages to show standalone tool results
        message.content.forEach((item: any) => {
          if (!item || !item.type) return;

          if (item.type === 'tool-result' && item.toolCallId) {
            // Only add if not already added via assistant message tool-call
            const alreadyAdded = items.some(
              (existingItem: any) =>
                existingItem.type === 'tool-result' &&
                existingItem.toolCallId === item.toolCallId
            );

            if (!alreadyAdded) {
              items.push({
                type: 'tool-result' as const,
                toolCallId: item.toolCallId,
                output: item.output,
                messageIndex,
              });
            }
          }
        });
        messageIndex++;
      }
    });

    return items;
  }, [messages, messagesVersion]);


  if (!displayLocation) return null;

  return (
    <div className="fixed inset-0 bg-background/70 backdrop-blur-md z-50 flex flex-col lg:flex-row overflow-hidden">
      {/* Mini Globe - Desktop Left Side Collapsible */}
      <AnimatePresence>
        {showMiniGlobe && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 384 }}
            exit={{ width: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="hidden lg:block h-full border-r border-border/30 bg-background/20 backdrop-blur-sm overflow-hidden relative"
          >
            <div className="h-full p-4 flex flex-col">
              <div className="flex items-center mb-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</div>
              </div>
              <div className="flex-1 rounded-lg overflow-hidden border border-border/50 shadow-xl">
                <Globe
                  onLocationClick={handleGlobeLocationClick}
                  theme="satellite-streets-v12"
                  initialCenter={globeInitialCenter}
                  initialZoom={globeInitialCenter ? 4 : undefined}
                  marker={globeMarker}
                  disableInteraction={false}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini Globe Toggle Button - Middle Left */}
      <div className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-20" style={{ left: showMiniGlobe ? '384px' : '0px', transition: 'left 0.3s ease-in-out' }}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowMiniGlobe(!showMiniGlobe)}
          className="rounded-l-none rounded-r-lg h-16 w-6 px-0 border-l-0 shadow-md"
          title={showMiniGlobe ? "Hide map" : "Show map"}
        >
          {showMiniGlobe ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 sm:h-16 border-b border-border/30 bg-background/30 backdrop-blur-xl flex items-center justify-between px-3 sm:px-6 z-10 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
          <div className="min-w-0 flex-1 flex items-center">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-semibold truncate">{displayLocation.name}</h2>
              {displayLocation.lat !== 0 && displayLocation.lng !== 0 && (
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {displayLocation.lat.toFixed(4)}, {displayLocation.lng.toFixed(4)}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {status === 'completed' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="gap-1.5 sm:gap-2 min-h-11 px-2 sm:px-3"
            >
              {downloadingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">PDF</span>
            </Button>
          )}
          {user && status === 'completed' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              disabled={sharing}
              className="gap-1.5 sm:gap-2 min-h-11 px-2 sm:px-3"
            >
              {sharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="min-h-11 min-w-11">
            <X className="h-5 w-5" />
          </Button>
        </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full will-change-scroll" style={{ WebkitOverflowScrolling: 'touch' } as any}>
          <div className="max-w-4xl mx-auto p-3 sm:p-6 pb-safe space-y-4 sm:space-y-6 overflow-x-hidden transform-gpu">
            {/* Status */}
            {status === 'queued' && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Clock className="h-8 w-8 text-yellow-500 mx-auto mb-4" />
                  </motion.div>
                  <p className="text-sm font-medium mb-1">Research Queued</p>
                  <p className="text-xs text-muted-foreground">Your request will begin shortly...</p>
                </div>
              </div>
            )}

            {(status === 'running' || status === 'completed') && (
              <div className="space-y-4">
                {/* Location Title */}
                <div className="text-center py-3 sm:py-6">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight font-serif italic text-foreground/95 px-2">
                    {displayLocation.name}<AnimatedDots isActive={status === 'running'} />
                  </h1>
                  {displayLocation.lat !== 0 && displayLocation.lng !== 0 && (
                    <p className="text-xs sm:text-sm text-muted-foreground/70 mt-1 sm:mt-2 font-light tracking-wide">
                      {displayLocation.lat.toFixed(4)}, {displayLocation.lng.toFixed(4)}
                    </p>
                  )}
                </div>

                {/* Hero Images Gallery */}
                {isGeneratingImage ? (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
                    <Skeleton className="h-32 sm:h-48 w-full rounded-lg" />
                    <Skeleton className="h-32 sm:h-48 w-full rounded-lg" />
                    <Skeleton className="h-32 sm:h-48 w-full rounded-lg" />
                    <Skeleton className="h-32 sm:h-48 w-full rounded-lg" />
                    <Skeleton className="h-32 sm:h-48 w-full rounded-lg" />
                  </div>
                ) : (
                  <PhotoGallery images={heroImages} />
                )}

                {/* Report skeleton while waiting for first content */}
                {timeline.length === 0 && status === 'running' && (
                  <div className="space-y-4 sm:space-y-6">
                    <div className="bg-background/60 backdrop-blur-sm rounded-lg p-3 sm:p-6 border shadow-sm space-y-2 sm:space-y-3">
                      <Skeleton className="h-6 sm:h-8 w-3/4" />
                      <Skeleton className="h-3 sm:h-4 w-full" />
                      <Skeleton className="h-3 sm:h-4 w-full" />
                      <Skeleton className="h-3 sm:h-4 w-5/6" />
                      <div className="pt-1 sm:pt-2" />
                      <Skeleton className="h-5 sm:h-6 w-2/3" />
                      <Skeleton className="h-3 sm:h-4 w-full" />
                      <Skeleton className="h-3 sm:h-4 w-full" />
                      <Skeleton className="h-3 sm:h-4 w-4/5" />
                    </div>
                    <div className="flex items-center justify-center py-3 sm:py-4">
                      <div className="text-center">
                        <p className="text-xs sm:text-sm font-light text-foreground/60">
                          Generating report...
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Activity Feed - Show only during running AND not completed */}
                {timeline.length > 0 && status === 'running' && !content && (
                  <div className="space-y-3 sm:space-y-4" key={`timeline-${messages.length}-${timeline.length}`}>
                    <div className="text-[10px] sm:text-xs font-light text-muted-foreground/60 uppercase tracking-wider">
                      Research Trace
                    </div>
                    {timeline.map((item, idx) => (
                      <TimelineItem key={`timeline-${idx}`} item={item} idx={idx} timeline={timeline} animated={true} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {status === 'error' && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-destructive mb-2">Research Failed</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            )}

            {/* Research Content - show when we have content AND status is completed */}
            {status === 'completed' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-3 sm:space-y-4"
              >
                {status === 'completed' && (
                  <>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-between gap-2 text-xs sm:text-sm font-semibold text-green-700 bg-green-500/10 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 border border-green-500/20 shadow-sm"
                    >
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        <span>Research Complete</span>
                      </div>
                      {messages && messages.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 sm:h-9 gap-1 sm:gap-1.5 bg-background hover:bg-accent border-green-500/30 px-2 sm:px-3 flex-shrink-0"
                          onClick={() => setShowReasoningDialog(true)}
                        >
                          <Brain className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          <span className="text-[10px] sm:text-xs">View Reasoning</span>
                        </Button>
                      )}
                    </motion.div>
                    {content && (
                      <div className="prose prose-sm dark:prose-invert max-w-none bg-background/60 backdrop-blur-sm rounded-lg p-3 sm:p-6 border shadow-sm prose-headings:font-semibold prose-headings:break-words prose-h1:text-xl sm:prose-h1:text-2xl prose-h2:text-lg sm:prose-h2:text-xl prose-h3:text-base sm:prose-h3:text-lg prose-p:text-sm sm:prose-p:text-base prose-p:leading-relaxed prose-p:break-words prose-a:text-primary prose-a:no-underline prose-a:break-words hover:prose-a:underline prose-code:text-xs sm:prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:break-all prose-pre:bg-muted prose-pre:border prose-pre:text-xs sm:prose-pre:text-sm prose-pre:overflow-x-auto prose-li:break-words prose-td:break-words prose-th:break-words">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ node, ...props }) => (
                              <a {...props} target="_blank" rel="noopener noreferrer" />
                            )
                          }}
                        >
                          {content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* Images */}
            {images.length > 0 && (
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold">Research Images</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {images.map((image, index) => (
                    <div key={index} className="border rounded-lg overflow-hidden">
                      <img
                        src={image.image_url}
                        alt={image.title || `Research image ${index + 1}`}
                        className="w-full h-auto"
                      />
                      {image.title && (
                        <div className="p-3 bg-muted">
                          <p className="text-sm font-medium">{image.title}</p>
                          {image.image_type && (
                            <p className="text-xs text-muted-foreground capitalize">{image.image_type}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sources Summary */}
            {sources.length > 0 && status === 'completed' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-semibold">All Sources</h3>
                  <span className="text-xs sm:text-sm text-muted-foreground">{sources.length} total</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                  {sources.map((source, index) => {
                    return (
                      <a
                        key={index}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-2 p-2.5 bg-muted/30 rounded-lg border hover:border-primary transition-colors"
                      >
                        {source.url && (
                          <Favicon url={source.url} className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium line-clamp-2 group-hover:text-primary transition-colors">
                            {source.title}
                          </div>
                          {source.snippet && (
                            <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                              {source.snippet}
                            </div>
                          )}
                          {source.doi && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded font-medium">
                                DOI
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate">
                                {source.doi}
                              </span>
                            </div>
                          )}
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Research Stats */}
            {status === 'completed' && timeline.length > 0 && (() => {
              const metrics = calculateAgentMetrics(messages);
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="grid grid-cols-3 gap-2 sm:gap-4 p-3 sm:p-5 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20 shadow-sm"
                >
                  <div className="text-center">
                    <motion.p
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                      className="text-xl sm:text-3xl font-bold text-primary mb-0.5 sm:mb-1"
                    >
                      {metrics.wordsRead.toLocaleString()}
                    </motion.p>
                    <p className="text-[9px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Words Read</p>
                  </div>
                  <div className="text-center">
                    <motion.p
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.3 }}
                      className="text-xl sm:text-3xl font-bold text-primary mb-0.5 sm:mb-1"
                    >
                      {metrics.sourcesRead}
                    </motion.p>
                    <p className="text-[9px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Sources</p>
                  </div>
                  <div className="text-center">
                    <motion.p
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.4 }}
                      className="text-xl sm:text-3xl font-bold text-primary mb-0.5 sm:mb-1"
                    >
                      {metrics.hoursActuallySaved.toFixed(1)}h
                    </motion.p>
                    <p className="text-[9px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Time Saved</p>
                  </div>
                </motion.div>
              );
            })()}
          </div>
        </ScrollArea>
        </div>

        {/* Mini Globe - Mobile Bottom */}
        <div className="lg:hidden h-48 border-t border-border/30 bg-background/20 backdrop-blur-sm flex-shrink-0">
          <div className="h-full p-2">
            <div className="h-full rounded-lg overflow-hidden border border-border/50 shadow-xl">
              <Globe
                onLocationClick={handleGlobeLocationClick}
                theme="satellite-streets-v12"
                initialCenter={globeInitialCenter}
                initialZoom={globeInitialCenter ? 3 : undefined}
                marker={globeMarker}
                disableInteraction={false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reasoning Dialog */}
      <ReasoningDialog
        open={showReasoningDialog}
        onOpenChange={setShowReasoningDialog}
        stepCount={messages?.length}
      >
        {timeline.length > 0 ? (
          timeline.map((item, idx) => (
            <TimelineItem key={`dialog-timeline-${idx}`} item={item} idx={idx} timeline={timeline} animated={false} />
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No activity data available for this task.
          </div>
        )}
      </ReasoningDialog>
    </div>
  );
}
