import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { UserRepository } from '../user/user.repository';
import { TracingService } from '../common/tracing/tracing.service';

@Injectable()
export class AuthService {
  constructor(private users: UserRepository, private tracing: TracingService) {}

  async login(email?: string, password?: string, traceId?: string) {
    traceId = traceId || 'unknown-trace';
    this.tracing.logEvent(traceId, 'service', 'validation_started', 'success', { email });

    if (!email || !password) {
      this.tracing.logEvent(traceId, 'service', 'validation_error', 'error', { message: 'Missing email or password' });
      throw new HttpException('Missing email or password', HttpStatus.BAD_REQUEST);
    }

    this.tracing.logEvent(traceId, 'service', 'validation_success', 'success');

    this.tracing.logEvent(traceId, 'service', 'auth_logic_started', 'success');
    const user = await this.users.findByEmail(email, traceId);
    if (!user) {
      this.tracing.logEvent(traceId, 'service', 'password_check', 'error', { message: 'user_not_found' });
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // For this demo, compare plaintext passwords (in reality, hash+salt)
    const passwordOk = user.password === password;
    this.tracing.logEvent(traceId, 'service', 'password_check', passwordOk ? 'success' : 'error');

    if (!passwordOk) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }

    // Return mock token
    const token = `mock-jwt-token-for-${user.id}`;
    this.tracing.logEvent(traceId, 'service', 'auth_success', 'success', { userId: user.id });
    return { token };
  }
}
