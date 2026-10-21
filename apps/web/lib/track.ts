const STORAGE_KEY = 'nes_vid';

function clientVisitorId(): string | null {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return null;
  }
}

function rememberVisitor(id: string | undefined) {
  if (!id) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // 隐私模式写不进去时，仍靠 cookie 识别回访。
  }
}

/** 上报访问或游玩。同一浏览器共用一个访客 id，避免并发请求被记成两个人。 */
export async function trackEvent(url: string, body?: Record<string, string>): Promise<void> {
  const visitorId = clientVisitorId();
  const headers: Record<string, string> = {};
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  if (visitorId) {
    headers['X-Nes-Visitor'] = visitorId;
  }
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null) as { visitorId?: string } | null;
  rememberVisitor(data?.visitorId);
}
