# tRPC.io Nitro Adapter

A [tRPC](https://trpc.io) adapter for the [nitro](https://nitro.unjs.io) web server framework.

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

```typescript
// file: ./trpc/router.ts

import { z } from 'zod'

import { initTRPC } from '@trpc/server'

type Telescope = {
  uid: string
  name: string
}

const telescopes: Record<string, Telescope> = {}

export const t = initTRPC.create()

export const appRouter = t.router({
  getTelescopeById: t.procedure.input(z.string()).query(opts => {
    return telescopes[opts.input] // input type is string
  }),
  createTelescope: t.procedure
    .input(
      z.object({
        name: z.string().min(3)
      })
    )
    .mutation(opts => {
      const id = Date.now().toString()
      const telescope: telescope = { id, ...opts.input }
      telescopes[telescope.id] = telescope
      return telescope
    })
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

import { defineTRPCNitroEventHandler } from 'trpc-nitro-adapter'

// Export as default the defineTRPCNitroEventHandler function:
export default defineTRPCNitroEventHandler({
  router: appRouter,
  createContext: () => {
    // Return your custom defined context here:
    return {}
  }
})
```
