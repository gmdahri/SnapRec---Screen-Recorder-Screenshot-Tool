import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vitePrerender from 'vite-plugin-prerender'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    vitePrerender({
      staticDir: path.join(__dirname, 'dist'),
      routes: [
        '/',
        '/how-it-works',
        '/changelog',
        '/privacy',
        '/blog',
        '/blog/how-to-record-screen-chrome-free',
        '/blog/best-free-screen-recorders-no-watermark',
        '/blog/how-to-take-full-page-screenshot-chrome',
        '/blog/snaprec-vs-loom-free-alternative',
        '/blog/record-screen-with-audio-webcam-chrome',
        '/blog/how-to-screenshot-on-chromebook',
        '/blog/screen-record-google-meet-free',
        '/blog/best-screenshot-chrome-extensions-2026',
        '/blog/how-to-blur-sensitive-info-screenshot',
        '/blog/screen-recording-tips-remote-work',
        '/blog/how-to-annotate-screenshots-chrome',
        '/blog/screencastify-vs-snaprec-free-alternative',
        '/blog/how-to-record-presentation-with-webcam',
        '/blog/how-to-capture-scrolling-screenshot',
        '/blog/obs-vs-browser-screen-recorder',
        '/blog/screen-recorder-for-teachers-free',
      ],
      renderer: new vitePrerender.PuppeteerRenderer({
        renderAfterTime: 3000,
      }),
      postProcess(renderedRoute) {
        renderedRoute.route = renderedRoute.originalRoute;
        return renderedRoute;
      },
    }),
  ],
})
