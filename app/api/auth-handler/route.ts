import { NextRequest, NextResponse } from 'next/server';

const STATIC_HTML = `<!DOCTYPE html>
<html>
<head>
<title>Podium</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<script type="text/javascript">
// Intercept beforeinstallprompt to hide Chrome's download/install icon from the popup address bar
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
});
</script>
<script type="text/javascript" src="experiments.js"></script>
<script type="text/javascript" src="handler.js"></script>
<script type="text/javascript" nonce="firebase-auth-helper">
var POST_BODY = '{{POST_BODY}}';
fireauth.oauthhelper.widget.initialize();
</script>
</head>
<body>
</body>
</html>`;

export async function GET(request: NextRequest) {
  // Return the static HTML immediately for GET requests to make the popup load instantly
  // and minimize the brief moment the URL is visible.
  const responseHeaders = new Headers();
  responseHeaders.set('content-type', 'text/html; charset=utf-8');
  responseHeaders.set('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return new NextResponse(STATIC_HTML, {
    status: 200,
    headers: responseHeaders,
  });
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
      
      // Inject <title>Podium</title> and PWA installation prevention script
      const injectScript = `<title>Podium</title>
<script type="text/javascript">
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
});
</script>`;

      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${injectScript}`);
      } else if (html.includes('</head>')) {
        html = html.replace('</head>', `${injectScript}</head>`);
      } else {
        html = `${injectScript}${html}`;
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
