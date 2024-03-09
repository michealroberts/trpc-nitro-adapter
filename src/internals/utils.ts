/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/trpc-nitro-adapter
// @license        Copyright © 2021-2023 observerly

/*****************************************************************************************************************/

import { TRPCError } from '@trpc/server'

import { type H3Event } from 'h3'

/*****************************************************************************************************************/

export const getPath = (event: H3Event): string => {
  const params = event.context.params

  if (!params) {
    // Throw an error if the trpc parameter is not a string or an array:
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message:
        'Please ensure that the trpc parameter is defined in your routes file e.g., ./routes/[trpc].ts',
      cause: 'Nitro Routing Configuration'
    })
  }

  if (typeof params.trpc === 'string') {
    return params.trpc
  }

  if (typeof params.trpc === 'string') {
    return params.trpc
  }

  // Throw an error if the trpc parameter is not a string or an array:
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message:
      'Please ensure that the trpc parameter is defined in your routes file e.g., ./routes/[trpc].ts',
    cause: 'Nitro Routing Configuration'
  })
}

/*****************************************************************************************************************/
