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

import { type HTTPRequest, type ResponseMeta, resolveHTTPResponse } from '@trpc/server/http'

import { createURL } from 'ufo'

import {
  type EventHandler,
  type EventHandlerRequest,
  type EventHandlerResponse,
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
}) => EventHandler<TRequest, EventHandlerResponse<string | undefined>>

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

    // Obtain the URL query parameters:
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

    // Resolve the native tRPC HTTP response:
    const { status, headers, body } = await resolveHTTPResponse({
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
      }
    })

    // Set the status code accordingly:
    setResponseStatus(event, status)

    // Merge response headers accordingly:
    headers &&
      Object.keys(headers).forEach(key => {
        if (headers[key]) {
          setHeader(event, key, headers[key]!)
        }
      })

    // Return the response body "as is", JSON "stringified":
    return body
  })
}

/*****************************************************************************************************************/
