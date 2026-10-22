import { Button, Flex, Heading, Text } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import { Theme } from '@radix-ui/themes';
import './globals.css';

export default function RootNotFound() {
  return (
    <html lang="zh-CN">
      <body>
        <Theme appearance="dark" accentColor="orange" grayColor="sand" radius="medium">
          <Flex className="page-shell error-page" direction="column" align="center" justify="center" gap="4">
            <Heading size="9" color="orange">404</Heading>
            <Heading size="5">页面不存在 / Page not found</Heading>
            <Text size="3" color="gray" align="center">这个地址没有对应的页面。 This address does not match a page.</Text>
            <Flex gap="3">
              <Button asChild size="3">
                <a href="/">中文</a>
              </Button>
              <Button asChild size="3" variant="soft">
                <a href="/en">English</a>
              </Button>
            </Flex>
          </Flex>
        </Theme>
      </body>
    </html>
  );
}
