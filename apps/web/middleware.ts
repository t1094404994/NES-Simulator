import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, type Locale } from '@/lib/i18n';

function nextWithLocale(request: NextRequest, locale: Locale, url?: URL) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-locale', locale);
  if (url) {
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/zh' || pathname.startsWith('/zh/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/zh/, '') || '/';
    return NextResponse.redirect(url, 308);
  }
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    return nextWithLocale(request, 'en');
  }
  const url = request.nextUrl.clone();
  url.pathname = pathname === '/' ? '/zh' : `/zh${pathname}`;
  return nextWithLocale(request, defaultLocale, url);
}

export const config = {
  matcher: ['/((?!_next|api|apple-icon|.*\\..*).*)'],
};
