import * as db from '@/lib/db';
import { isSelfHostedMode } from '@/lib/local-db/local-auth';
import { saveChatMessages } from '@/lib/db';

// Vercel Pro plan allows up to 800s (13.3 minutes)
export const maxDuration = 800;

// Valyu OAuth Proxy configuration - uses /deepresearch endpoint
const VALYU_APP_URL = process.env.VALYU_APP_URL || 'https://platform.valyu.ai';
const VALYU_OAUTH_PROXY_URL = `${VALYU_APP_URL}/api/oauth/proxy`;

// Fallback for self-hosted mode only
const VALYU_API_KEY = process.env.VALYU_API_KEY;
const DEEPRESEARCH_API_URL = 'https://api.valyu.ai/v1/deepresearch';

interface DeepResearchMessage {
  role: 'user' | 'assistant';
  content: string | any[];
}

/**
 * Make a DeepResearch API call via Valyu OAuth Proxy
 * Credits are handled by Valyu Platform
 */
async function callDeepResearchApi(
  body: any,
  valyuAccessToken: string
): Promise<Response> {
  const response = await fetch(VALYU_OAUTH_PROXY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${valyuAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: '/v1/deepresearch/tasks',
      method: 'POST',
      body,
    }),
  });
  return response;
}

/**
 * Fallback for self-hosted mode - direct API call
 */
async function callDeepResearchApiDev(body: any): Promise<Response> {
  const response = await fetch(`${DEEPRESEARCH_API_URL}/tasks`, {
    method: 'POST',
    headers: {
      'X-API-Key': VALYU_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return response;
}

/**
 * Get task status from DeepResearch API
 */
async function getTaskStatus(taskId: string, valyuAccessToken?: string): Promise<Response> {
  if (valyuAccessToken) {
    const response = await fetch(VALYU_OAUTH_PROXY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${valyuAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: `/v1/deepresearch/tasks/${taskId}/status`,
        method: 'GET',
      }),
    });
    return response;
  } else {
    // Dev mode fallback
    const response = await fetch(
      `${DEEPRESEARCH_API_URL}/tasks/${taskId}/status`,
      {
        headers: {
          'X-API-Key': VALYU_API_KEY!,
        },
      }
    );
    return response;
  }
}

export async function POST(req: Request) {
  try {
    const { messages, sessionId, location, valyuAccessToken }: {
      messages: DeepResearchMessage[],
      sessionId?: string,
      location?: { name: string; lat: number; lng: number },
      valyuAccessToken?: string
    } = await req.json();

    const lastMessage = messages[messages.length - 1];
    const isSelfHosted = isSelfHostedMode();

    // REQUIRE Valyu sign-in for all queries (except self-hosted mode)
    if (!isSelfHosted && !valyuAccessToken) {
      return new Response(
        JSON.stringify({
          error: "AUTH_REQUIRED",
          message: "Sign in with Valyu to continue",
          action: "sign_in"
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get authenticated user (for saving to database)
    const { data: { user } } = await db.getUser();

    // Track processing start time
    const processingStartTime = Date.now();

    // Save user message immediately (before processing starts)
    if (user && sessionId && messages.length > 0) {
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
      }
    }

    // Construct the research query
    let researchQuery = typeof lastMessage.content === 'string' ? lastMessage.content : '';

    // Use default prompt if message is just the location name
    const isDefaultMessage = location && (
      researchQuery === `Research the history of ${location.name}` ||
      researchQuery === location.name
    );

    if (isDefaultMessage) {
      researchQuery = `Provide a comprehensive historical overview of this location, covering major events, cultural significance, and key developments throughout history.\n\nLocation: ${location.name}`;
    }

    // Create DeepResearch task - always use 'fast' model (credits managed by Valyu)
    const taskResponse = isSelfHosted && !valyuAccessToken
      ? await callDeepResearchApiDev({
          input: researchQuery,
          model: 'fast',
          output_formats: ['markdown']
        })
      : await callDeepResearchApi({
          input: researchQuery,
          model: 'fast',
          output_formats: ['markdown']
        }, valyuAccessToken!);

    if (!taskResponse.ok) {
      const errorData = await taskResponse.json().catch(() => ({}));

      // Handle Valyu credit errors
      if (taskResponse.status === 402) {
        return new Response(
          JSON.stringify({
            error: "INSUFFICIENT_CREDITS",
            message: "Insufficient Valyu credits. Add credits at platform.valyu.ai",
            action: "add_credits"
          }),
          { status: 402, headers: { 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`DeepResearch API error: ${errorData.error || taskResponse.statusText}`);
    }

    const taskData = await taskResponse.json();
    const taskId = taskData.deepsearch_id || taskData.deepresearch_id;

    // Save research task to database
    if (!isSelfHosted && user) {
      try {
        const taskRecord = {
          id: crypto.randomUUID(),
          user_id: user.id,
          deepresearch_id: taskId,
          location_name: location?.name || 'Unknown',
          location_lat: location?.lat || 0,
          location_lng: location?.lng || 0,
          status: 'queued',
        };

        await db.createResearchTask(taskRecord);
      } catch (error) {
        // Don't fail the request if database save fails
      }
    }

    // Helper function to stream messages
    const streamMessages = (controller: any, encoder: TextEncoder, messages: any[], lastLength: number) => {
      if (!messages || !Array.isArray(messages)) return lastLength;

      const newMessages = messages.slice(lastLength);
      if (newMessages.length > 0) {
        for (const message of newMessages) {
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
          // Send task ID immediately
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
          const maxPolls = 840; // 14 minutes
          let lastMessagesLength = 0;
          let hasSetRunning = false;

          while (!completed && pollCount < maxPolls) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            pollCount++;

            const statusResponse = await getTaskStatus(taskId, valyuAccessToken);

            if (!statusResponse.ok) {
              throw new Error('Failed to get task status');
            }

            const statusData = await statusResponse.json();

            if (statusData.status === 'running') {
              if (!isSelfHosted && !hasSetRunning) {
                hasSetRunning = true;
                try {
                  await db.updateResearchTaskByDeepResearchId(taskId, {
                    status: 'running',
                  });
                } catch (error) {
                  // Fail silently
                }
              }

              // Progress info is in statusData.progress object
              const progress = statusData.progress || {};
              const currentStep = progress.current_step || progress.step || 0;
              const totalSteps = progress.total_steps || progress.total || 10;
              const progressMessage = progress.message || `Researching... (${currentStep}/${totalSteps} steps)`;

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'progress',
                    status: 'running',
                    message: progressMessage,
                    current_step: currentStep,
                    total_steps: totalSteps,
                  })}\n\n`
                )
              );

              lastMessagesLength = streamMessages(controller, encoder, statusData.messages, lastMessagesLength);
            } else if (statusData.status === 'completed') {
              completed = true;

              lastMessagesLength = streamMessages(controller, encoder, statusData.messages, lastMessagesLength);

              const output = statusData.output || '';
              const sources = statusData.sources || [];
              const images = statusData.images || [];

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'content',
                    content: output,
                  })}\n\n`
                )
              );

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

              if (!isSelfHosted) {
                try {
                  await db.updateResearchTaskByDeepResearchId(taskId, {
                    status: 'completed',
                    completed_at: new Date(),
                  });
                } catch (error) {
                  // Fail silently
                }
              }

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'done',
                  })}\n\n`
                )
              );
            } else if (statusData.status === 'failed') {
              if (!isSelfHosted) {
                try {
                  await db.updateResearchTaskByDeepResearchId(taskId, {
                    status: 'failed',
                    completed_at: new Date(),
                  });
                } catch (error) {
                  // Fail silently
                }
              }

              throw new Error(statusData.error || 'Research task failed');
            }
          }

          if (!completed) {
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

    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    if (isSelfHosted) {
      headers.set("X-Development-Mode", "true");
    }

    return new Response(stream, { headers });
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'An unexpected error occurred';

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
