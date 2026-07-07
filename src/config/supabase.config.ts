import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

/**
 * Provides a Supabase Admin client (using the service role key) for
 * server-side operations: auth admin, storage, and bypassing RLS.
 */
@Injectable()
export class SupabaseConfigService {
  private readonly _client: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const url = this.config.getOrThrow<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');

    this._client = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  get client(): SupabaseClient {
    return this._client;
  }
}
