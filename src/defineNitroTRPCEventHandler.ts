/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/trpc-nitro-adapter
// @license        Copyright © 2021-2023 observerly

/*****************************************************************************************************************/

import {
  type AnyRouter,
  type ProcedureType,
  type TRPCError,
  type inferRouterContext,
  type inferRouterError
} from '@trpc/server'

import { type TRPCResponse } from '@trpc/server/dist/rpc'

import {
  type HTTPRequest,
  type ResponseMeta,
  resolveHTTPResponse,
  getBatchStreamFormatter
} from '@trpc/server/http'

import { createURL } from 'ufo'

import {
  type EventHandler,
  type H3Event,
  defineEventHandler,
  isMethod,
  readBody,
  setHeader
} from 'h3'

/*****************************************************************************************************************/

// Internals:

import { type MaybePromise } from './internals/types'

import { getPath } from './internals/utils'
import { getHeader } from 'h3'

/*****************************************************************************************************************/

export interface HTTPResponse {
  status: number
  headers?: Record<string, string | string[] | undefined>
  body?: string
}

/*****************************************************************************************************************/

export type ResponseChunk = [procedureIndex: number, responseBody: string]

/*****************************************************************************************************************/

export type CreateContextFn<TRouter extends AnyRouter> = (
  event: H3Event
) => MaybePromise<inferRouterContext<TRouter>>

/*****************************************************************************************************************/

export interface ResponseMetaFnPayload<TRouter extends AnyRouter> {
  data: TRPCResponse<unknown, inferRouterError<TRouter>>[]
  ctx?: inferRouterContext<TRouter>
  paths?: string[]
  type: ProcedureType | 'unknown'
  errors: TRPCError[]
}

export type ResponseMetaFn<TRouter extends AnyRouter> = (
  opts: ResponseMetaFnPayload<TRouter>
) => ResponseMeta

/*****************************************************************************************************************/

export interface OnErrorPayload<TRouter extends AnyRouter> {
  error: TRPCError
  type: ProcedureType | 'unknown'
  path: string | undefined
  req: HTTPRequest
  input: unknown
  ctx: undefined | inferRouterContext<TRouter>
}

export type OnErrorFn<TRouter extends AnyRouter> = (opts: OnErrorPayload<TRouter>) => void

/*****************************************************************************************************************/

export interface RequestHandlerOptions {
  wss?: boolean
}

/*****************************************************************************************************************/

export type NitroRequestHandler = <TRouter extends AnyRouter>({
  router,
  createContext,
  responseMeta,
  onError,
  options
}: {
  router: TRouter
  createContext?: CreateContextFn<TRouter>
  responseMeta?: ResponseMetaFn<TRouter>
  onError?: OnErrorFn<TRouter>
  options: RequestHandlerOptions
}) => EventHandler<string | undefined>

/*****************************************************************************************************************/

export const defineNitroTRPCEventHandler: NitroRequestHandler = <TRouter extends AnyRouter>({
  router,
  createContext,
  responseMeta,
  onError,
  options
}: {
  router: TRouter
  createContext?: CreateContextFn<TRouter>
  responseMeta?: ResponseMetaFn<TRouter>
  onError?: OnErrorFn<TRouter>
  options?: RequestHandlerOptions
}) => {
  return defineEventHandler(async event => {
    // Extract the request and response objects from the H3 event:
    const { req: request, res: response } = event.node

    // const { wss = false } = options

    // Create a URL object from the request URL:
    const url = createURL(request.url!)

    // Obtain the URL query paramaters:
    const query = url.searchParams

    // Obtain the URL path:
    const path = getPath(event)

    // Construct the native tRPC HTTPReqest object:
    const req: HTTPRequest = {
      query,
      method: request.method || 'GET',
      headers: request.headers,
      body: isMethod(event, 'GET') ? null : await readBody(event)
    }

    let body = ''

    // Is this a WebSocket stream:
    let isStream = false

    // Is this a WebSocket request:
    let formatter: ReturnType<typeof getBatchStreamFormatter>

    const unstable_onHead = (head: HTTPResponse, isStreaming: boolean) => {
      if ('body' in head && head.body) {
        body = head.body
      }

      // Set the response status code:
      if ('status' in head && (!response.statusCode || response.statusCode === 200)) {
        response.statusCode = head.status
      }

      // Ensure we forward any and all headers, if they are defined:
      for (const [key, value] of Object.entries(head.headers ?? {})) {
        if (value !== undefined) {
          setHeader(event, key, value)
        }
      }

      if (isStreaming) {
        // Set the transfer encoding header to chunked to enable streaming:
        setHeader(event, 'Transfer-Encoding', 'chunked')

        // Get the `Vary` header:
        const vary = getHeader(event, 'Vary')
        /**
         *
         * The Vary HTTP response header describes the parts of the request
         * message aside from the method and URL that influenced the content
         * of the response it occurs in. Most often, this is used to create
         * a cache key when content negotiation is in use.
         *
         */
        setHeader(event, 'Vary', vary ? `trpc-batch-mode ${vary}` : 'trpc-batch-mode')
        isStream = true
        formatter = getBatchStreamFormatter()
        /**
         *
         * It is usually desired (it saves a TCP round-trip), but not when
         * the first data is not sent until possibly much later.
         * flushHeaders() bypasses the optimization and kickstarts the message.
         *
         */
        response.flushHeaders()
      }
    }

    const unstable_onChunk = ([index, string]: ResponseChunk) => {
      if (index === -1) {
        /**
         *
         * Full response, no streaming. This can happen if the response
         * is an error or if response is empty (HEAD request)
         *
         */
        response.end(string)
      } else {
        response.write(formatter!(index, string))
        response.destroy()
      }
    }

    // Resolve the native tRPC HTTP response:
    await resolveHTTPResponse({
      router,
      req,
      path,
      createContext: async () => createContext?.(event),
      responseMeta,
      onError: opts => {
        onError?.({
          ...opts,
          req
        })
      },
      unstable_onHead,
      unstable_onChunk
    })

    if (isStream) {
      // If this is a stream, we need to end the response:
      response.write(formatter!.end())
      response.end()
    }

    // Return the response body "as is", JSON "stringified":
    return body
  })
}

/*****************************************************************************************************************/
