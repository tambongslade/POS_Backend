import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse(); // Get response for status code
    const { method, url, body, headers, params, query } = request;
    const controllerName = context.getClass().name;
    const handlerName = context.getHandler().name;

    const logPrefix = `[${controllerName}#${handlerName}]`;

    this.logger.log(`${logPrefix} ==> ${method} ${url} - Incoming Request`);

    if (params && Object.keys(params).length > 0) {
      this.logger.debug(`${logPrefix} Request Params: ${JSON.stringify(params)}`);
    }
    if (query && Object.keys(query).length > 0) {
      this.logger.debug(`${logPrefix} Request Query: ${JSON.stringify(query)}`);
    }
    if (body && Object.keys(body).length > 0) {
      // Be cautious about logging sensitive information in the body
      this.logger.debug(`${logPrefix} Request Body: ${JSON.stringify(body)}`);
    }
    // Optional: Log headers if needed, be very cautious about sensitive information like authorization tokens
    // if (headers) {
    //   this.logger.debug(`${logPrefix} Request Headers: ${JSON.stringify(headers)}`);
    // }

    const now = Date.now();
    return next
      .handle()
      .pipe(
        tap((data) => {
          const statusCode = response.statusCode;
          this.logger.log(
            `${logPrefix} <== ${method} ${url} - Status: ${statusCode} - Response Time: ${Date.now() - now}ms - Outgoing Response`,
          );
          // Only log response data if it exists and is not too large or sensitive
          if (data && process.env.NODE_ENV !== 'production') { // Example: Avoid logging full responses in production
            this.logger.debug(`${logPrefix} Response Body: ${JSON.stringify(data)}`);
          }
        }),
      );
  }
} 