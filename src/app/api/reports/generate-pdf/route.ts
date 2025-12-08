import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { remark } from 'remark';
import html from 'remark-html';
import { isDevelopmentMode } from '@/lib/local-db/local-auth';

const VALYU_APP_URL = process.env.VALYU_APP_URL || 'https://platform.valyu.ai';
const VALYU_OAUTH_PROXY_URL = `${VALYU_APP_URL}/api/oauth/proxy`;
const DEEPRESEARCH_API_URL = 'https://api.valyu.ai/v1/deepresearch';
const VALYU_API_KEY = process.env.VALYU_API_KEY;

export const maxDuration = 300; // 5 minutes max for PDF generation

// Dynamic import of chromium for Vercel production
let chromium: any = null;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  try {
    chromium = require('@sparticuz/chromium');
  } catch (e) {
    console.warn('[PDF Generation] @sparticuz/chromium not available');
  }
}

async function markdownToHtml(markdown: string): Promise<string> {
  const result = await remark().use(html).process(markdown);
  return result.toString();
}

function generatePdfStyles(): string {
  return `
    <style>
      @page {
        margin: 2cm;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #1a1a1a;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }

      .letterhead {
        text-align: center;
        border-bottom: 2px solid #e5e7eb;
        padding-bottom: 20px;
        margin-bottom: 40px;
      }

      .letterhead h1 {
        margin: 0;
        font-size: 32px;
        font-weight: 700;
        color: #111827;
      }

      .letterhead .subtitle {
        color: #6b7280;
        font-size: 14px;
        margin-top: 8px;
      }

      .metadata {
        display: flex;
        justify-content: space-between;
        padding: 16px 0;
        border-bottom: 1px solid #e5e7eb;
        margin-bottom: 32px;
        font-size: 14px;
        color: #6b7280;
      }

      .content h1 {
        font-size: 28px;
        margin-top: 32px;
        margin-bottom: 16px;
        color: #111827;
        font-weight: 700;
      }

      .content h2 {
        font-size: 22px;
        margin-top: 28px;
        margin-bottom: 14px;
        color: #1f2937;
        font-weight: 600;
      }

      .content h3 {
        font-size: 18px;
        margin-top: 24px;
        margin-bottom: 12px;
        color: #374151;
        font-weight: 600;
      }

      .content p {
        margin-bottom: 16px;
        text-align: justify;
      }

      .content ul, .content ol {
        margin-bottom: 16px;
        padding-left: 32px;
      }

      .content li {
        margin-bottom: 8px;
      }

      .content blockquote {
        border-left: 4px solid #e5e7eb;
        padding-left: 16px;
        margin: 24px 0;
        color: #6b7280;
        font-style: italic;
      }

      .content code {
        background-color: #f3f4f6;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'Courier New', monospace;
        font-size: 14px;
      }

      .content pre {
        background-color: #f3f4f6;
        padding: 16px;
        border-radius: 8px;
        overflow-x: auto;
        margin-bottom: 16px;
      }

      .content pre code {
        background-color: transparent;
        padding: 0;
      }

      .content a {
        color: #2563eb;
        text-decoration: none;
      }

      .content a:hover {
        text-decoration: underline;
      }

      .sources {
        margin-top: 48px;
        padding-top: 24px;
        border-top: 2px solid #e5e7eb;
      }

      .sources h2 {
        font-size: 22px;
        margin-bottom: 16px;
        color: #111827;
      }

      .source-item {
        margin-bottom: 12px;
        padding-left: 24px;
        position: relative;
        font-size: 14px;
      }

      .source-item::before {
        content: '•';
        position: absolute;
        left: 8px;
        color: #6b7280;
      }

      .footer {
        margin-top: 64px;
        padding-top: 24px;
        border-top: 1px solid #e5e7eb;
        text-align: center;
        font-size: 12px;
        color: #9ca3af;
      }

      .page-break {
        page-break-after: always;
      }
    </style>
  `;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, locationName, valyuAccessToken } = body;

    if (!taskId || !locationName) {
      return NextResponse.json(
        { error: 'Missing required fields: taskId and locationName' },
        { status: 400 }
      );
    }

    const isDevelopment = isDevelopmentMode();

    // Require auth token in production
    if (!isDevelopment && !valyuAccessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    let response: Response;

    // Fetch research data via OAuth proxy or direct API (dev mode)
    if (valyuAccessToken) {
      response = await fetch(VALYU_OAUTH_PROXY_URL, {
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
      response = await fetch(
        `${DEEPRESEARCH_API_URL}/tasks/${taskId}/status`,
        {
          method: 'GET',
          headers: {
            'X-API-Key': VALYU_API_KEY,
          },
          cache: 'no-store',
        }
      );
    } else {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch research data' },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.status !== 'completed' || !data.output) {
      return NextResponse.json(
        { error: 'Research is not completed or has no output' },
        { status: 400 }
      );
    }

    // Convert markdown to HTML
    const contentHtml = await markdownToHtml(data.output);

    // Extract sources from the research if available
    let sourcesHtml = '';
    if (data.sources && Array.isArray(data.sources) && data.sources.length > 0) {
      sourcesHtml = `
        <div class="sources">
          <h2>Sources & References</h2>
          ${data.sources
            .map(
              (source: any) => `
            <div class="source-item">
              ${source.title || source.url || 'Unnamed source'}
              ${source.url ? ` - <a href="${source.url}">${source.url}</a>` : ''}
            </div>
          `
            )
            .join('')}
        </div>
      `;
    }

    // Generate HTML document
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Historical Research: ${locationName}</title>
          ${generatePdfStyles()}
        </head>
        <body>
          <div class="letterhead">
            <h1>History</h1>
            <div class="subtitle">AI-Powered Deep Historical Research</div>
          </div>

          <div class="metadata">
            <div><strong>Location:</strong> ${locationName}</div>
            <div><strong>Generated:</strong> ${currentDate}</div>
          </div>

          <div class="content">
            ${contentHtml}
          </div>

          ${sourcesHtml}

          <div class="footer">
            <p>Generated by History - AI Deep Research</p>
            <p>https://history.valyu.ai</p>
          </div>
        </body>
      </html>
    `;

    // Launch Puppeteer and generate PDF
    let browser;
    if (isProduction && chromium) {
      // Use @sparticuz/chromium for Vercel serverless
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      // Local development
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
    });

    await browser.close();

    // Generate filename
    const sanitizedLocationName = locationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    const filename = `history-${sanitizedLocationName}-${taskId.substring(0, 8)}.pdf`;

    // Return PDF as response - convert Buffer to Uint8Array for NextResponse
    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
