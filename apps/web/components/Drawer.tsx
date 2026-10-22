'use client';

import { Dialog, Flex } from '@radix-ui/themes';
import { createContext, useContext, useState, type ReactElement, type ReactNode } from 'react';
import { useI18n } from '@/app/providers';

const DrawerContainerContext = createContext<HTMLDivElement | null>(null);

export function useDrawerContainer(): HTMLDivElement | null {
  return useContext(DrawerContainerContext);
}

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  trigger?: ReactElement;
  children: ReactNode;
}) {
  const { m } = useI18n();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger>{trigger}</Dialog.Trigger> : null}
      <Dialog.Content
        ref={setContainer}
        className="app-drawer"
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <DrawerContainerContext.Provider value={container}>
          <div className="drawer-head">
            <div className="drawer-copy">
              <Dialog.Title>{title}</Dialog.Title>
              {description ? <Dialog.Description color="gray" size="2">{description}</Dialog.Description> : null}
            </div>
            <button type="button" className="drawer-close" aria-label={m.closeAria} onClick={() => onOpenChange(false)}>
              ×
            </button>
          </div>
          <Flex direction="column" gap="4" mt="4">
            {children}
          </Flex>
        </DrawerContainerContext.Provider>
      </Dialog.Content>
    </Dialog.Root>
  );
}
