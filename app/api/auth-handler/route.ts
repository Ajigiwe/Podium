import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(request: NextRequest) {
  const url = new URL(request.url);
  // Reconstruct target URL pointing to Firebase Auth handler
  const targetUrl = new URL('/__/auth/handler' + url.search, 'https://lite-class.firebaseapp.com');

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey !== 'host' &&
      lowerKey !== 'origin' &&
      lowerKey !== 'accept-encoding' &&
      lowerKey !== 'content-length'
    ) {
      headers.set(key, value);
    }
  });

  const method = request.method;
  const init: RequestInit = {
    method,
    headers,
  };

  if (method === 'POST') {
    try {
      const bodyText = await request.text();
      init.body = bodyText;
    } catch (e) {
      console.warn('[auth-handler] Could not parse POST body:', e);
    }
  }

  try {
    const res = await fetch(targetUrl.toString(), init);
    const contentType = res.headers.get('content-type') || '';

    const responseHeaders = new Headers(res.headers);
    responseHeaders.delete('content-length');
    responseHeaders.delete('content-encoding');

    if (contentType.includes('text/html')) {
      let html = await res.text();
      
      // Inject <title>Podium</title> to prevent showing the URL with API key in the popup title bar
      if (html.includes('<head>')) {
        html = html.replace('<head>', '<head><title>Podium</title>');
      } else if (html.includes('</head>')) {
        html = html.replace('</head>', '<title>Podium</title></head>');
      } else {
        html = `<title>Podium</title>${html}`;
      }
      
      responseHeaders.set('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

      return new NextResponse(html, {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
      });
    }

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[auth-handler] Error proxying to Firebase Auth handler:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
