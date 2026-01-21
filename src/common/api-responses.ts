export class ApiResponses {
  // ----------------------------------
  // Success Response
  // ----------------------------------
  static success<T>(
    data: T,
    message = 'Success',
    meta?: Record<string, any>,
  ) {
    return {
      success: true,
      message,
      data,
      meta,
    } as const;
  }

  // ----------------------------------
  // Error Response
  // ----------------------------------
  static error(
    message: string, // must always provide a meaningful message
    options?: {
      code?: string;           // programmatic error code
      statusCode?: number;     // HTTP status code
      details?: any;           // extra contextual info
      errors?: Record<string, string[]>; // field-specific errors
      traceId?: string;        // optional trace ID for logs/debugging
    },
  ) {
    return {
      success: false,
      message,
      error: {
        code: options?.code ?? 'ERROR',
        statusCode: options?.statusCode ?? 500,
        details: options?.details ?? null,
        errors: options?.errors ?? null,
        traceId: options?.traceId ?? null,
      },
    } as const;
  }
}
