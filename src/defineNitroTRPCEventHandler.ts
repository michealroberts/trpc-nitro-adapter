/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/trpc-nitro-adapter
// @license        Copyright © 2021-2023 observerly

/*****************************************************************************************************************/

import {
  type AnyRouter,
  type ProcedureType,
  type TRPCError,
  type inferRouterContext
} from '@trpc/server'

import { type ResponseMeta } from '@trpc/server/http'
import { type TRPCResponse } from '@trpc/server/rpc'

// Use the http APIs from tRPC server
import { resolveResponse } from '@trpc/server/unstable-core-do-not-import'

import { createURL } from 'ufo'

import {
  type EventHandler,
  type EventHandlerRequest,
  type H3Event,
  defineEventHandler,
  readBody,
  setHeader,
  isMethod,
  setResponseStatus
} from 'h3'

/*****************************************************************************************************************/

// Internals:

import { type MaybePromise } from './internals/types'

import { getPath } from './internals/utils'

/*****************************************************************************************************************/

export type CreateContextFn<TRouter extends AnyRouter> = (
  event: H3Event
) => MaybePromise<inferRouterContext<TRouter>>

/*****************************************************************************************************************/

export interface ResponseMetaFnPayload<TRouter extends AnyRouter> {
  data: TRPCResponse[]
  ctx?: inferRouterContext<TRouter>
  paths?: readonly string[]
  type: ProcedureType | 'unknown'
  errors: TRPCError[]
  eagerGeneration: boolean
}

export type ResponseMetaFn<TRouter extends AnyRouter> = (
  opts: ResponseMetaFnPayload<TRouter>
) => ResponseMeta

/*****************************************************************************************************************/

export interface OnErrorPayload<TRouter extends AnyRouter> {
  error: TRPCError
  type: ProcedureType | 'unknown'
  path: string | undefined
  req: Request
  input: unknown
  ctx: undefined | inferRouterContext<TRouter>
}

export type OnErrorFn<TRouter extends AnyRouter> = (opts: OnErrorPayload<TRouter>) => void

/*****************************************************************************************************************/

export type NitroRequestHandler = <
  TRouter extends AnyRouter,
  TRequest extends EventHandlerRequest
>({
  router,
  createContext,
  responseMeta,
  onError
}: {
  router: TRouter
  createContext?: CreateContextFn<TRouter>
  responseMeta?: ResponseMetaFn<TRouter>
  onError?: OnErrorFn<TRouter>
}) => EventHandler<TRequest, Promise<string>>

/*****************************************************************************************************************/

export const defineNitroTRPCEventHandler: NitroRequestHandler = <TRouter extends AnyRouter>({
  router,
  createContext,
  responseMeta,
  onError
}: {
  router: TRouter
  createContext?: CreateContextFn<TRouter>
  responseMeta?: ResponseMetaFn<TRouter>
  onError?: OnErrorFn<TRouter>
}) => {
  return defineEventHandler(async event => {
    // Extract the request and response objects from the H3 event:
    const { req: request } = event.node

    // Create a URL object from the request URL:
    const url = createURL(request.url!)

    // Obtain the URL path:
    const path = getPath(event)

    // Construct a fetch-compatible Request object for tRPC v11
    const reqBody = isMethod(event, 'GET') ? undefined : JSON.stringify(await readBody(event))
    const req = new Request(url.toString(), {
      method: request.method || 'GET',
      headers: new Headers(request.headers as HeadersInit),
      body: reqBody
    })

    // Create wrapper for context function to match v11 API
    const wrappedCreateContext = async (_: { info: any }) => {
      return createContext ? await createContext(event) : undefined
    }

    // Wrapper for response meta to match v11 signature
    const wrappedResponseMeta = responseMeta
      ? (opts: {
          data: TRPCResponse[]
          ctx?: inferRouterContext<TRouter>
          paths: readonly string[] | undefined
          info: any | undefined
          type: ProcedureType | 'unknown'
          errors: TRPCError[]
          eagerGeneration: boolean
        }) => {
          // Transform to match our adapter's expected format
          return responseMeta({
            data: opts.data,
            ctx: opts.ctx,
            paths: opts.paths,
            type: opts.type,
            errors: opts.errors,
            eagerGeneration: opts.eagerGeneration
          })
        }
      : undefined

    // Wrapper for onError to match v11 signature
    const wrappedOnError = onError
      ? (opts: {
          error: TRPCError
          type: ProcedureType | 'unknown'
          path: string | undefined
          input: unknown
          ctx: inferRouterContext<TRouter> | undefined
        }) => {
          onError({
            ...opts,
            req
          })
        }
      : undefined

    // Resolve the tRPC response using the new v11 API:
    const response = await resolveResponse({
      router,
      req,
      path,
      error: null,
      createContext: wrappedCreateContext,
      responseMeta: wrappedResponseMeta,
      onError: wrappedOnError
    })

    // Extract response properties
    const status = response.status
    const headers = response.headers
    const body = await response.text()

    // Set the status code accordingly:
    setResponseStatus(event, status)

    // Merge response headers accordingly:
    if (headers) {
      headers.forEach((value, key) => {
        if (value) {
          setHeader(event, key, value)
        }
      })
    }

    // Return the response body as string:
    return body
  })
}

/*****************************************************************************************************************/
