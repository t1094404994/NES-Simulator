'use client';

import { Dialog, Flex } from '@radix-ui/themes';
import { createContext, useContext, useState, type ReactElement, type ReactNode } from 'react';

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
  trigger: ReactElement;
  children: ReactNode;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger>{trigger}</Dialog.Trigger>
      <Dialog.Content
        ref={setContainer}
        className="app-drawer"
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <DrawerContainerContext.Provider value={container}>
          <Dialog.Title>{title}</Dialog.Title>
          {description ? <Dialog.Description color="gray" size="2">{description}</Dialog.Description> : null}
          <Flex direction="column" gap="4" mt="4">
            {children}
          </Flex>
        </DrawerContainerContext.Provider>
      </Dialog.Content>
    </Dialog.Root>
  );
}
