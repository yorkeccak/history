import { checkAnonymousRateLimit, incrementRateLimit } from "@/lib/rate-limit";
import { checkUserRateLimit } from '@/lib/rate-limit';
import { validateAccess } from '@/lib/polar-access-validation';
import { PolarEventTracker } from '@/lib/polar-events';
import * as db from '@/lib/db';
import { isDevelopmentMode } from '@/lib/local-db/local-auth';
import { saveChatMessages } from '@/lib/db';

// Vercel Pro plan allows up to 800s (13.3 minutes)
// For longer tasks, we need to use polling pattern
export const maxDuration = 800;

// DeepResearch API configuration
const DEEPRESEARCH_API_URL = 'https://api.valyu.ai/v1/deepresearch';
const DEEPRESEARCH_API_KEY = process.env.VALYU_API_KEY;

interface DeepResearchMessage {
  role: 'user' | 'assistant';
  content: string | any[];
}

export async function POST(req: Request) {
  try {
    const { messages, sessionId, location }: {
      messages: DeepResearchMessage[],
      sessionId?: string,
      location?: { name: string; lat: number; lng: number }
    } = await req.json();

    console.log("[Chat API] ========== NEW REQUEST ==========");
    console.log("[Chat API] Received sessionId:", sessionId);
    console.log("[Chat API] Location:", location);
    console.log("[Chat API] Number of messages:", messages.length);

    // Determine if this is a user-initiated message (should count towards rate limit)
    const lastMessage = messages[messages.length - 1];
    const isUserMessage = lastMessage?.role === 'user';
    const userMessageCount = messages.filter(m => m.role === 'user').length;
    const isUserInitiated = isUserMessage && userMessageCount === 1;

    console.log("[Chat API] Rate limit check:", {
      isUserMessage,
      userMessageCount,
      isUserInitiated,
      totalMessages: messages.length
    });

    // Check app mode and configure accordingly
    const isDevelopment = isDevelopmentMode();
    console.log("[Chat API] App mode:", isDevelopment ? 'development' : 'production');

    // Get authenticated user
    const { data: { user } } = await db.getUser();
    console.log("[Chat API] Authenticated user:", user?.id || 'anonymous');

    // Validate access for authenticated users
    if (user && !isDevelopment) {
      const accessValidation = await validateAccess(user.id);

      if (!accessValidation.hasAccess && accessValidation.requiresPaymentSetup) {
        console.log("[Chat API] Access validation failed - payment required");
        return new Response(
          JSON.stringify({
            error: "PAYMENT_REQUIRED",
            message: "Payment method setup required",
            tier: accessValidation.tier,
            action: "setup_payment"
          }),
          { status: 402, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (accessValidation.hasAccess) {
        console.log("[Chat API] Access validated for tier:", accessValidation.tier);
      }
    }

    // Check rate limit for user-initiated messages
    if (isUserInitiated && !isDevelopment) {
      if (!user) {
        const cookieHeader = req.headers.get('cookie') || '';
        const rateLimitStatus = await checkAnonymousRateLimit(cookieHeader);
        console.log("[Chat API] Anonymous rate limit status:", rateLimitStatus);

        if (!rateLimitStatus.allowed) {
          console.log("[Chat API] Anonymous rate limit exceeded");
          return new Response(
            JSON.stringify({
              error: "RATE_LIMIT_EXCEEDED",
              message: "You have used your free query. Sign up to get 3 queries per day for free!",
              resetTime: rateLimitStatus.resetTime.toISOString(),
              remaining: rateLimitStatus.remaining,
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "X-RateLimit-Limit": rateLimitStatus.limit.toString(),
                "X-RateLimit-Remaining": rateLimitStatus.remaining.toString(),
                "X-RateLimit-Reset": rateLimitStatus.resetTime.toISOString(),
              },
            }
          );
        }
      } else {
        const rateLimitResult = await checkUserRateLimit(user.id);
        console.log("[Chat API] User rate limit status:", rateLimitResult);

        if (!rateLimitResult.allowed) {
          return new Response(JSON.stringify({
            error: "RATE_LIMIT_EXCEEDED",
            message: "Daily query limit reached. Upgrade to continue.",
            resetTime: rateLimitResult.resetTime.toISOString(),
            tier: rateLimitResult.tier
          }), {
            status: 429,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
    } else if (isUserInitiated && isDevelopment) {
      console.log("[Chat API] Development mode: Rate limiting disabled");
    }

    // Track processing start time
    const processingStartTime = Date.now();

    // Save user message immediately (before processing starts)
    if (user && sessionId && messages.length > 0) {
      console.log('[Chat API] Saving user message immediately before processing');
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        const { randomUUID } = await import('crypto');
        const userMessageToSave = {
          id: randomUUID(),
          role: 'user' as const,
          content: [{ type: 'text', text: typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content) }],
        };

        const { data: existingMessages } = await db.getChatMessages(sessionId);
        const allMessages = [...(existingMessages || []), userMessageToSave];

        await saveChatMessages(sessionId, allMessages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content,
        })));

        await db.updateChatSession(sessionId, user.id, {
          last_message_at: new Date()
        });
        console.log('[Chat API] User message saved');
      }
    }

    // Construct the research query
    // Use the user's message content (which includes custom instructions or preset prompts)
    let researchQuery = typeof lastMessage.content === 'string' ? lastMessage.content : '';

    // Only add default comprehensive prompt if no custom instructions were provided
    // (If location is provided but message looks like a simple location name, use default prompt)
    if (location && researchQuery.length < 100) {
      researchQuery = `Provide a comprehensive historical analysis of ${location.name}. Include:
- Major historical events and periods
- Key historical figures and their contributions
- Cultural and architectural heritage
- Economic and political development through history
- Social and demographic changes over time
- Important archaeological findings or historical sites
- Timeline of significant dates and events

Please be thorough and well-researched, citing historical sources where possible.`;
    }

    // Get user tier for model selection
    let userTier = 'free';
    if (user) {
      const { data: userData } = await db.getUserProfile(user.id);
      userTier = userData?.subscription_tier || userData?.subscriptionTier || 'free';
      console.log("[Chat API] User tier:", userTier);
    }

    // Select DeepResearch model based on tier
    const model = userTier === 'unlimited' || userTier === 'pay_per_use' ? 'heavy' : 'lite';
    console.log("[Chat API] Using DeepResearch model:", model);

    // Create DeepResearch task
    const taskResponse = await fetch(`${DEEPRESEARCH_API_URL}/tasks`, {
      method: 'POST',
      headers: {
        'X-API-Key': DEEPRESEARCH_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: researchQuery,
        model: model,
        output_formats: ['markdown'],
        search: {
          search_type: 'all',
        },
      }),
    });

    if (!taskResponse.ok) {
      throw new Error(`DeepResearch API error: ${taskResponse.statusText}`);
    }

    const taskData = await taskResponse.json();
    const taskId = taskData.deepresearch_id;
    console.log("[Chat API] Created DeepResearch task:", taskId);

    // Track usage for pay-per-use customers via Polar events
    if (!isDevelopment && user) {
      try {
        // Get user tier to check if they're on pay-per-use plan
        const { data: userData } = await db.getUserProfile(user.id);
        const tier = userData?.subscription_tier || userData?.subscriptionTier || 'free';

        if (tier === 'pay_per_use') {
          console.log("[Chat API] Tracking pay-per-use deep research event for user:", user.id);
          const eventTracker = new PolarEventTracker();
          await eventTracker.trackDeepResearch(
            user.id,
            taskId,
            location?.name || 'Unknown',
            {
              location_lat: location?.lat || 0,
              location_lng: location?.lng || 0,
              model: model
            }
          );
        }
      } catch (error) {
        console.error("[Chat API] Failed to track deep research event:", error);
        // Don't fail the request if event tracking fails
      }
    }

    // Save research task to database
    if (!isDevelopment) {
      try {
        const taskRecord = {
          id: crypto.randomUUID(),
          user_id: user?.id,
          deepresearch_id: taskId,
          location_name: location?.name || 'Unknown',
          location_lat: location?.lat || 0,
          location_lng: location?.lng || 0,
          status: 'queued',
          anonymous_id: !user ? req.headers.get('x-anonymous-id') || undefined : undefined,
        };

        await db.createResearchTask(taskRecord);
        console.log("[Chat API] Research task saved to database");
      } catch (error) {
        console.error("[Chat API] Failed to save research task:", error);
        // Don't fail the request if database save fails
      }
    }

    // Helper function to stream messages
    const streamMessages = (controller: any, encoder: TextEncoder, messages: any[], lastLength: number) => {
      if (!messages || !Array.isArray(messages)) return lastLength;

      const newMessages = messages.slice(lastLength);
      if (newMessages.length > 0) {
        for (const message of newMessages) {
          // Stream assistant AND tool messages (tool messages contain tool-results with sources)
          if ((message.role === 'assistant' || message.role === 'tool') && message.content) {
            for (const contentItem of message.content) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'message_update',
                    content_type: contentItem.type,
                    data: contentItem,
                    message_role: message.role,
                  })}\n\n`
                )
              );
            }
          }
        }
      }
      return messages.length;
    };

    // Poll for task completion and stream results
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send task ID immediately so client can continue polling if needed
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'task_created',
                taskId: taskId,
              })}\n\n`
            )
          );

          // Send initial status
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'status',
                status: 'queued',
                message: 'Research task queued...',
              })}\n\n`
            )
          );

          let completed = false;
          let pollCount = 0;
          const maxPolls = 840; // 14 minutes at 1 second intervals
          let lastMessagesLength = 0;
          let hasSetRunning = false;

          while (!completed && pollCount < maxPolls) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            pollCount++;

            const statusResponse = await fetch(
              `${DEEPRESEARCH_API_URL}/tasks/${taskId}/status`,
              {
                headers: {
                  'X-API-Key': DEEPRESEARCH_API_KEY!,
                },
              }
            );

            if (!statusResponse.ok) {
              throw new Error('Failed to get task status');
            }

            const statusData = await statusResponse.json();
            console.log("[Chat API] Task status:", statusData.status);

            if (statusData.status === 'running') {
              // Update database status to running on first detection
              if (!isDevelopment && !hasSetRunning) {
                hasSetRunning = true;
                try {
                  await db.updateResearchTaskByDeepResearchId(taskId, {
                    status: 'running',
                  });
                  console.log("[Chat API] Research task status updated to running");
                } catch (error) {
                  console.error("[Chat API] Failed to update research task status to running:", error);
                }
              }

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'progress',
                    status: 'running',
                    message: `Researching... (${statusData.current_step || 0}/${statusData.total_steps || 10} steps)`,
                    current_step: statusData.current_step,
                    total_steps: statusData.total_steps,
                  })}\n\n`
                )
              );

              // Stream new messages
              lastMessagesLength = streamMessages(controller, encoder, statusData.messages, lastMessagesLength);
            } else if (statusData.status === 'completed') {
              completed = true;

              // Stream any remaining messages
              lastMessagesLength = streamMessages(controller, encoder, statusData.messages, lastMessagesLength);

              // Stream the final output
              const output = statusData.output || '';
              const sources = statusData.sources || [];
              const images = statusData.images || [];

              // Send the main content
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'content',
                    content: output,
                  })}\n\n`
                )
              );

              // Send sources
              if (sources.length > 0) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'sources',
                      sources: sources,
                    })}\n\n`
                  )
                );
              }

              // Send images
              if (images.length > 0) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'images',
                      images: images,
                    })}\n\n`
                  )
                );
              }

              // Save assistant message to database
              if (user && sessionId) {
                const processingEndTime = Date.now();
                const processingTimeMs = processingEndTime - processingStartTime;

                const { randomUUID } = await import('crypto');
                const assistantMessage = {
                  id: randomUUID(),
                  role: 'assistant' as const,
                  content: [{ type: 'text', text: output }],
                  processing_time_ms: processingTimeMs,
                };

                const { data: existingMessages } = await db.getChatMessages(sessionId);
                const allMessages = [...(existingMessages || []), assistantMessage];

                await saveChatMessages(sessionId, allMessages.map((msg: any) => ({
                  id: msg.id,
                  role: msg.role,
                  content: typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content,
                  processing_time_ms: msg.processing_time_ms,
                })));

                await db.updateChatSession(sessionId, user.id, {
                  last_message_at: new Date()
                });
              }

              // Update research task status in database
              if (!isDevelopment) {
                try {
                  await db.updateResearchTaskByDeepResearchId(taskId, {
                    status: 'completed',
                    completed_at: new Date(),
                  });
                  console.log("[Chat API] Research task status updated to completed");
                } catch (error) {
                  console.error("[Chat API] Failed to update research task status:", error);
                }
              }

              // Send completion signal
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'done',
                  })}\n\n`
                )
              );
            } else if (statusData.status === 'failed') {
              // Update research task status in database
              if (!isDevelopment) {
                try {
                  await db.updateResearchTaskByDeepResearchId(taskId, {
                    status: 'failed',
                    completed_at: new Date(),
                  });
                  console.log("[Chat API] Research task status updated to failed");
                } catch (error) {
                  console.error("[Chat API] Failed to update research task status:", error);
                }
              }

              throw new Error(statusData.error || 'Research task failed');
            }
          }

          if (!completed) {
            // Task is still running - send continue polling message
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'continue_polling',
                  taskId: taskId,
                  message: 'Research is still in progress. Client will continue polling...',
                })}\n\n`
              )
            );
          }
        } catch (error) {
          console.error("[Chat API] Streaming error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
              })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    // Increment rate limit after successful validation
    let anonymousCookieValue: string | undefined;
    if (isUserInitiated && !isDevelopment) {
      console.log("[Chat API] Incrementing rate limit for user-initiated message");
      try {
        const cookieHeader = req.headers.get('cookie') || '';
        const rateLimitResult = await incrementRateLimit(user?.id, cookieHeader);
        console.log("[Chat API] Rate limit incremented:", rateLimitResult);

        // Store cookie value for anonymous users to set in response
        if (!user && rateLimitResult.cookieValue) {
          anonymousCookieValue = rateLimitResult.cookieValue;
        }
      } catch (error) {
        console.error("[Chat API] Failed to increment rate limit:", error);
      }
    }

    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Set anonymous rate limit cookie
    if (anonymousCookieValue) {
      const expires = new Date();
      expires.setTime(expires.getTime() + 365 * 10 * 24 * 60 * 60 * 1000); // 10 years
      headers.set('Set-Cookie', `$dekcuf_teg=${anonymousCookieValue}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`);
    }

    if (isDevelopment) {
      headers.set("X-Development-Mode", "true");
      headers.set("X-RateLimit-Limit", "unlimited");
      headers.set("X-RateLimit-Remaining", "unlimited");
    }

    return new Response(stream, { headers });
  } catch (error) {
    console.error("[Chat API] Error:", error);

    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'An unexpected error occurred';

    console.error("[Chat API] Error details:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return new Response(
      JSON.stringify({
        error: "CHAT_ERROR",
        message: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
