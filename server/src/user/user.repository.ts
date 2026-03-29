import { Injectable } from '@nestjs/common';
import { TracingService } from '../common/tracing/tracing.service';

export interface UserRecord {
  id: string;
  email: string;
  password: string; // plaintext for demo only
}

@Injectable()
export class UserRepository {
  private users: UserRecord[] = [
    { id: '1', email: 'alice@example.com', password: 'password123' },
    { id: '2', email: 'bob@example.com', password: 'hunter2' }
  ];

  constructor(private tracing: TracingService) {}

  async findByEmail(email: string, traceId: string) {
    this.tracing.logEvent(traceId, 'repository', 'user_lookup_started', 'success', { email });
    // simulate database query (no delays)
    this.tracing.logEvent(traceId, 'database', 'db_query_started', 'success', { query: 'findByEmail' });
    const user = this.users.find(u => u.email === email) || null;
    this.tracing.logEvent(traceId, 'database', 'db_query_completed', 'success', { found: !!user });

    if (user) {
      this.tracing.logEvent(traceId, 'repository', 'user_lookup_success', 'success', { userId: user.id });
    } else {
      this.tracing.logEvent(traceId, 'repository', 'user_not_found', 'error', { email });
    }

    return user;
  }
}
