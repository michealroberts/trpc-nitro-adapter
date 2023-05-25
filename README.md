# tRPC.io Nitro Adapter

A [tRPC](https://trpc.io) adapter for the [nitro](https://nitro.unjs.io) web server framework.

## Requirements

- [tRPC](https://trpc.io) v10._._
- [nitro](https://nitro.unjs.io) v.2.4.\* or higher
- [h3](https://github.com/unjs/h3) v.1.6.\* or higher

## Installation

```bash
npm install trpc-nitro-adapter
```

```bash
pnpm add trpc-nitro-adapter
```

```bash
yarn add trpc-nitro-adapter
```

## Usage

First of all you need a router to handle your queries, mutations and subscriptions.

A sample router is given below, saved in in a file named `.trpc/router.ts`\*. Note, if your router file starts getting too big, split your router into several subrouters each implemented in its own file. Then merge them into a single root appRouter.

To read more about how to define a router, please consult the [tRPC router documentation](https://trpc.io/docs/server/routers#defining-a-router).

```typescript
// file: ./trpc/router.ts

import { initTRPC } from '@trpc/server'

export const t = initTRPC.create()

export const appRouter = t.router({
  // ... define your routes here
})

// Export your type definition for use in the adapter:
export type AppRouter = typeof appRouter
```

Please consult the [tRPC documentation](https://trpc.io/docs/server/routers#defining-a-router) for more information on how to create a router.

Then, in your nitro server, create a file in your routes directory named `[...trpc].ts` to ensure that the trpc param is passed to your nitro eventHandler.

```typescript
// file: /routes/[...trpc].ts

// Import your router:
import { appRouter } from './trpc/router.ts'

import { defineNitroTRPCEventHandler } from 'trpc-nitro-adapter'

// Export as default the defineNitroTRPCEventHandler function:
export default defineNitroTRPCEventHandler({
  router: appRouter,
  createContext: () => {
    // Return your custom defined context here:
    return {}
  }
})
```
