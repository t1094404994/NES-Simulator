'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';
import { trackEvent } from '@/lib/track';

/** 主站打开时上报一次访问。同一浏览器每天只计一人，由后台去重。 */
export function TrackVisit() {
  useEffect(() => {
    void trackEvent(api.trackVisit()).catch(() => {});
  }, []);
  return null;
}
