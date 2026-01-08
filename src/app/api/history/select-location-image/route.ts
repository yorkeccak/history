import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { isSelfHostedMode } from '@/lib/local-db/local-auth';

const VALYU_APP_URL = process.env.VALYU_APP_URL || 'https://platform.valyu.ai';
const VALYU_OAUTH_PROXY_URL = `${VALYU_APP_URL}/api/oauth/proxy`;
const VALYU_API_KEY = process.env.VALYU_API_KEY;

const LocationImageSelectionSchema = z.object({
  selectedImageIndices: z.array(z.number()).describe('Array of image indices to select (0-based), ordered by preference. Select 3-5 images.'),
  reasoning: z.string().describe('Brief explanation of why these images were selected'),
});

async function filterValidImageUrls(urls: string[]): Promise<string[]> {
  const validUrls: string[] = [];

  for (const url of urls) {
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        continue;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ImageValidator/1.0)',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) {
          validUrls.push(url);
        }
      }
    } catch {
      continue;
    }
  }

  return validUrls;
}

async function searchValyuViaProxy(query: string, valyuAccessToken: string): Promise<any> {
  const response = await fetch(VALYU_OAUTH_PROXY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${valyuAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: '/v1/deepsearch',
      method: 'POST',
      body: {
        query,
        max_num_results: 10,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Valyu deepsearch failed: ${response.status}`);
  }

  return response.json();
}

async function searchValyuDirect(query: string): Promise<any> {
  const response = await fetch('https://api.valyu.ai/v1/deepsearch', {
    method: 'POST',
    headers: {
      'X-API-Key': VALYU_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      max_num_results: 10,
    }),
  });

  if (!response.ok) {
    throw new Error(`Valyu deepsearch failed: ${response.status}`);
  }

  return response.json();
}

export async function POST(req: NextRequest) {
  try {
    const { locationName, valyuAccessToken } = await req.json();

    const isSelfHosted = isSelfHostedMode();

    // Check OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ images: [], source: 'none', reason: 'OpenAI API key not configured' });
    }

    // Require auth in valyu mode
    if (!isSelfHosted && !valyuAccessToken) {
      return NextResponse.json({ images: [], source: 'none', reason: 'Authentication required' });
    }

    // Simple search query: just location name
    const searchQuery = locationName;

    // Search Valyu API
    try {
      let searchResponse;

      if (valyuAccessToken) {
        searchResponse = await searchValyuViaProxy(searchQuery, valyuAccessToken);
      } else if (isSelfHosted && VALYU_API_KEY) {
        searchResponse = await searchValyuDirect(searchQuery);
      } else {
        return NextResponse.json({ images: [], source: 'none', reason: 'No Valyu credentials available' });
      }

      if (!searchResponse || !searchResponse.results || searchResponse.results.length === 0) {
        return NextResponse.json({ images: [], source: 'none', reason: 'No search results' });
      }

      // Extract TOP image from each result (not all images)
      const imageUrls: string[] = [];
      searchResponse.results.forEach((result: any) => {
        // Priority: get the first/main image from each result
        if (result.image_url) {
          if (typeof result.image_url === 'string') {
            imageUrls.push(result.image_url);
          } else if (typeof result.image_url === 'object') {
            // Get first image from object
            const firstImage = Object.values(result.image_url)[0];
            if (typeof firstImage === 'string' && firstImage.trim()) {
              imageUrls.push(firstImage);
            }
          }
        }
      });

      if (imageUrls.length === 0) {
        return NextResponse.json({ images: [], source: 'none', reason: 'No image URLs in results' });
      }

      // Take first 15 for AI selection (not all 50)
      const urlsForSelection = imageUrls.slice(0, 15);

      // AI-powered image selection (select first, then validate)
      let result;
      try {
        result = await generateObject({
          model: openai('gpt-4o'),
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Select 3-5 high-quality images of: ${locationName}

Requirements:
✓ ACCEPT: Clear photographs of landmarks, landscapes, buildings, cultural scenes
✓ ACCEPT: High-resolution, well-composed images
✓ ACCEPT: Authentic documentary or travel photography

✗ REJECT: News logos (BBC, CNN, etc.), graphics, overlays
✗ REJECT: Blurry, pixelated, or low-quality images
✗ REJECT: Screenshots, memes, or text-heavy images
✗ REJECT: Generic flags, icons, or clip art
✗ REJECT: Watermarked or heavily branded images

Select the 3-5 BEST quality images that show ${locationName}. Return indices (0-based).`,
                },
                ...urlsForSelection.map((url) => ({
                  type: 'image' as const,
                  image: url,
                })),
              ],
            },
          ],
          schema: LocationImageSelectionSchema as any,
        });
      } catch (error: any) {
        // Fallback: validate and return first 3 images
        const validUrls = await filterValidImageUrls(urlsForSelection.slice(0, 5));
        return NextResponse.json({
          images: validUrls.slice(0, 3),
          source: 'valyu',
          reasoning: 'Automatic selection (AI unavailable)',
        });
      }

      const selection = result.object as any;

      if (!selection || selection.selectedImageIndices.length === 0) {
        return NextResponse.json({ images: [], source: 'none', reason: selection?.reasoning || 'No images selected' });
      }

      // Get selected image URLs
      const selectedUrls = selection.selectedImageIndices
        .filter((idx: number) => idx >= 0 && idx < urlsForSelection.length)
        .map((idx: number) => urlsForSelection[idx]);

      // Now validate only the selected images
      const validUrls = await filterValidImageUrls(selectedUrls);

      if (validUrls.length === 0) {
        return NextResponse.json({ images: [], source: 'none', reason: 'Selected images failed validation' });
      }

      return NextResponse.json({
        images: validUrls,
        source: 'valyu',
        reasoning: selection.reasoning,
      });
    } catch (error: any) {
      return NextResponse.json({ images: [], source: 'none', reason: error.message || 'Valyu API error' });
    }
  } catch (error: any) {
    return NextResponse.json({ images: [], source: 'none', reason: error.message || 'Unknown error' });
  }
}
