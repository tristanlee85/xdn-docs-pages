# Next.js

This guide shows you how to deploy a Next.js application on the Moovweb XDN:

## Getting Started

If you don't already have a Next.js application, you can create one using:

```bash
npm create next-app my-next-app
```

To prepare your Next.js application for deployment on the Moovweb XDN:

1. Install the XDN CLI globally:

```bash
npm install -g @xdn/cli
```

2. Run `xdn init`

This will automatically add all of the required dependencies and files to your project. These include:

- The `@xdn/core` package - Allows you to declare routes and deploy your application on the Moovweb XDN
- The `@xdn/next` package - Provides router middleware that automatically adds Next.js pages and api routes to the XDN router.
- The `@xdn/prefetch` package - Allows you to configure a service worker to prefetch and cache pages to improve browsing speed
- The `@xdn/react` package - Provides a `Prefetch` component for prefetching pages
- `xdn.config.js`
- `routes.js` - A default routes file that sends all requests to Next.js. Update this file to add caching or proxy some URLs to a different origin.
- `sw/service-worker.js` A service worker implemented using Workbox.

3. Add the `withXDN` and `withServiceWorker` plugins to `next.config.js`. If this file doesn't exist, create it with the following content:

```js
// next.config.js

const { withXDN, withServiceWorker } = require('@xdn/next/config')

module.exports = withXDN(withServiceWorker())
```

The `withXDN` plugin ensures that your app is bundled properly for running on the XDN, and `withServiceWorker` provides a service worker based on `sw/service-worker.js`.

If you're already using `next-offline`, you should remove it in favor of `withServiceWorker`, which itself uses `next-offline`.

## Running Locally

To simulate your app within the XDN locally, run:

```bash
npm run xdn:start
```

## Deploying

To deploy your app to the XDN, run:

```bash
npm run xdn:deploy
```

See [deploying](deploying) for more information.

## Prefetching

The `xdn init` command adds a service worker based on [Workbox](https://developers.google.com/web/tools/workbox) at `sw/service-worker.js`. If you have an existing service worker that uses workbox, you can copy its contents into `sw/service-worker.js` and simply add the following to your service worker:

```js
import { Prefetcher } from '@xdn/prefetch/sw'

new Prefetcher().route()
```

The above allows you to prefetch pages from the XDN's edge cache to greatly improve browsing speed. To prefetch a page, add the `Prefetch` component from `@xdn/react` to any Next `Link` element:

```js
import { Prefetch } from '@xdn/react'
import Link from 'next/link'

export default function ProductListing({ products }) {
  return (
    <ul>
      {products.map((product, i) => (
        <li key={i}>
          <Link as={product.url} href="/p/[productId]" passHref>
            <Prefetch>
              <a>
                <img src={product.thumbnail} />
              </a>
            </Prefetch>
          </Link>
        </li>
      ))}
    </ul>
  )
}
```

The `Prefetch` component fetches data for the linked page from the XDN's edge cache and adds it to the service worker's cache when the link becomes visible in the viewport. When the user taps on the link, the page transition will be instantaneous because the browser won't need to fetch data from the network.

The `Prefetch` component assumes you're using `getServerSideProps` and will prefetch the data URL corresponding to the target page. If you need to prefetch a different url, you can do so using the `url` prop:

```js
<Link as={product.url} href="/p/[productId]">
  <Prefetch url="/some/url/to/prefetch">
    <a>
      <img src={product.thumbnail} />
    </a>
  </Prefetch>
</Link>
```

Note that if you don't provide a `url` prop to `Prefetch`, you must specify the `passHref` prop on `Link` in order for the `Prefetch` component to know what URL to prefetch.

## Routing

The XDN supports Next.js's built-in routing scheme for both page and api routes, including Next.js 9's clean dynamic routes. The default `routes.js` file created by `xdn init` sends all requests to Next.js via a fallback route:

```js
// This file was automatically added by xdn deploy.
// You should commit this file to source control.
const { Router } = require('@xdn/core/router')
const { nextRoutes } = require('@xdn/next')

module.exports = new Router()
  .get('/service-worker.js', ({ cache, serveStatic }) => {
    cache({
      edge: {
        maxAgeSeconds: 60 * 60 * 24 * 365,
      },
      browser: {
        maxAgeSeconds: 0,
      },
    })
    serveStatic('.next/static/service-worker.js')
  })
  .use(nextRoutes)
```

### nextRoutes middleware

In the code above, the `nextRoutes` middleware adds all Next.js routes to the router based on the `/pages` directory. You can add additional routes before and after the middleware, for example to send some URLs to an alternate backend. This is useful for gradually replacing an existing site with a new Next.js app.

A popular use case is to fallback to a legacy site for any route that your Next.js app isn't configured to handle:

```js
new Router().use(nextRoutes).fallback(({ proxy }) => proxy('legacy'))
```

To configure the legacy backend, use xdn.config.js:

```js
module.exports = {
  backends: {
    legacy: {
      domainOrIp: process.env.LEGACY_BACKEND_DOMAIN || 'legacy.my-site.com',
      hostHeader: process.env.LEGACY_BACKEND_HOST_HEADER || 'legacy.my-site.com',
    },
  },
}
```

Using environment variables here allows you to configure different legacy domains for each XDN environment.

### rewrites and redirects

The `nextRoutes` middleware automatically adds routes for [rewrites](https://nextjs.org/docs/api-reference/next.config.js/rewrites) and [redirects](https://nextjs.org/docs/api-reference/next.config.js/redirects) specified in `next.config.js`. Redirects are served directly from the network edge to maximize performance.

### Explicit Routes

To render a specific page, use the `renderNextPage` function:

```js
const { Router } = require('@xdn/core/router')
const { renderNextPage, nextRoutes } = require('@xdn/next')

module.exports = new Router()
  .get('/some/vanity/url/:p', res => {
    renderNextPage('/p/[productId]', res, params => ({ productId: params.p }))
  })
  .use(nextRoutes)
```

The `renderNextPage` function takes the following parameters:

- nextRoute - `String` The next.js route path
- res - `ResponseWriter` The ResponseWriter passed to your route handler
- params - `Object|Function` An object containing query params to provide to the next page, or a function that takes the route's path params and the request and returns a params object.

### Caching

The easiest way to add edge caching to your Next.js app is to add caching routes before the middleware. For example,
imagine you have `/pages/p/[productId].js`. Here's how you can SSR responses as well as cache calls to `getServerSideProps`:

```js
new Router()
  // Products - SSR
  .get('/p/:productId', ({ cache }) => {
    cache({
      browser: {
        maxAgeSeconds: 0,
      },
      edge: {
        maxAgeSeconds: 60 * 60 * 24,
        staleWhileRevalidateSeconds: 60 * 60,
      },
    })
  })
  // Products - getServerSideProps
  .get('/_next/data/:version/p/:productId.json', ({ cache }) => {
    cache({
      browser: {
        maxAgeSeconds: 0,
        serviceWorkerSeconds: 60 * 60 * 24,
      },
      edge: {
        maxAgeSeconds: 60 * 60 * 24,
        staleWhileRevalidateSeconds: 60 * 60,
      },
    })
  })
  .use(nextRoutes)
```

### Preventing Next.js pages from being cached by other CDNs

By default, Next.js adds a `cache-control: private, no-cache, no-store, must-revalidate` header to all responses from `getServerSideProps`. The presence of `private` would prevent the XDN from caching the response, so `nextRoutes` middleware from `@xdn/next` automatically removes the `private` portion of the header to enable caching at edge. If you want your responses to be private, you need to specify a `cache-control` header using the router:

```js
new Router()
  .get('/my-private-page', ({ setResponseHeader }) => {
    setResponseHeader('cache-control', 'private, no-cache, no-store, must-revalidate')
  })
```

Doing so will prevent other CDNs running in front of the XDN from caching the response.
