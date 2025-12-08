// Polling endpoint for long-running research tasks
// This endpoint can be called repeatedly from the client to check task status

import * as db from '@/lib/db';
import { isDevelopmentMode } from '@/lib/local-db/local-auth';

const VALYU_APP_URL = process.env.VALYU_APP_URL || 'https://platform.valyu.ai';
const VALYU_OAUTH_PROXY_URL = `${VALYU_APP_URL}/api/oauth/proxy`;
const DEEPRESEARCH_API_URL = 'https://api.valyu.ai/v1/deepresearch';
const VALYU_API_KEY = process.env.VALYU_API_KEY;

export const maxDuration = 60; // Short timeout for polling endpoint

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return new Response(
        JSON.stringify({ error: 'Missing taskId parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const isDevelopment = isDevelopmentMode();

    // Get Valyu access token from Authorization header if present
    const authHeader = req.headers.get('Authorization');
    const valyuAccessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    console.log('[Poll] taskId:', taskId, 'hasToken:', !!valyuAccessToken, 'isDev:', isDevelopment);

    let statusResponse: Response;

    // Use OAuth proxy if we have a token, otherwise fall back to API key (dev mode)
    if (valyuAccessToken) {
      console.log('[Poll] Using OAuth proxy');
      statusResponse = await fetch(VALYU_OAUTH_PROXY_URL, {
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
    } else if (isDevelopment && VALYU_API_KEY) {
      // Dev mode fallback with API key
      console.log('[Poll] Using dev API key');
      statusResponse = await fetch(
        `${DEEPRESEARCH_API_URL}/tasks/${taskId}/status`,
        {
          headers: {
            'X-API-Key': VALYU_API_KEY,
          },
        }
      );
    } else {
      console.log('[Poll] No auth available');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Poll] Response status:', statusResponse.status);

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.log('[Poll] Error response:', errorText);
      throw new Error(`Failed to get task status: ${statusResponse.status} ${errorText}`);
    }

    const statusData = await statusResponse.json();
    console.log('[Poll] Status data:', statusData.status, 'hasOutput:', !!statusData.output);

    // Update database status based on DeepResearch API status
    if (!isDevelopment) {
      try {
        if (statusData.status === 'running') {
          await db.updateResearchTaskByDeepResearchId(taskId, {
            status: 'running',
          });
        } else if (statusData.status === 'completed') {
          await db.updateResearchTaskByDeepResearchId(taskId, {
            status: 'completed',
            completed_at: new Date(),
          });
        } else if (statusData.status === 'failed') {
          await db.updateResearchTaskByDeepResearchId(taskId, {
            status: 'failed',
            completed_at: new Date(),
          });
        }
      } catch (error) {
        // Don't fail the request if database update fails
      }
    }

    return new Response(
      JSON.stringify(statusData),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
