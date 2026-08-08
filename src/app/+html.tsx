import { ScrollViewStyleReset } from 'expo-router/html';

// Overrides Expo Router's default web document so we can add the PWA
// manifest link and register the offline service worker. The meta tags and
// <ScrollViewStyleReset /> below reproduce exactly what Expo generates by
// default (confirmed against a built dist/index.html) so native-parity
// scroll/layout behavior on web is unaffected.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#166534" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <ScrollViewStyleReset />
        <script
          // Only in production builds — during local `expo start --web` dev,
          // a service worker would intercept requests and serve stale
          // bundles instead of Metro's live-reloaded ones.
          dangerouslySetInnerHTML={{
            __html: `
              if (!location.hostname.match(/^(localhost|127\\.0\\.0\\.1)$/) && 'serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
