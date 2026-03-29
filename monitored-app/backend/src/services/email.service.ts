import { withBusinessSpan } from '../observability/span-utils';
import type { RequestTraceMeta, User } from '../types/users';

export class EmailService {
  async sendWelcomeEmail(user: User, subscribeToNewsletter: boolean, meta: RequestTraceMeta) {
    return withBusinessSpan('email_service_send_welcome', {
      layer: 'external',
      resource: 'smtp_provider',
      operation: 'send_email',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      // simulate network wait to third party
      await new Promise(r => setTimeout(r, 150));

      if (subscribeToNewsletter) {
        throw new Error('SMTP Timeout - third-party email provider failed to sync subscriber list. Rolling back.');
      }

      return true;
    });
  }
}

export const emailService = new EmailService();
