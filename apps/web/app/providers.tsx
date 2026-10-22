'use client';

import { Theme } from '@radix-ui/themes';
import { createContext, useContext, type ReactNode } from 'react';
import { messagesFor, type Locale, type Messages } from '@/lib/i18n';

const I18nContext = createContext<{ locale: Locale; m: Messages }>({
  locale: 'zh',
  m: messagesFor('zh'),
});

export function useI18n() {
  return useContext(I18nContext);
}

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <I18nContext.Provider value={{ locale, m: messagesFor(locale) }}>
      <Theme appearance="dark" accentColor="orange" grayColor="sand" radius="medium">
        {children}
      </Theme>
    </I18nContext.Provider>
  );
}
