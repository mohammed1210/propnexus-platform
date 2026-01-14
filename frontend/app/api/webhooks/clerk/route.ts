// frontend/app/api/webhooks/clerk/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createClient } from '@supabase/supabase-js';

type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkUserEventData = {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
};

type WebhookEvent = {
  type: string;
  data: ClerkUserEventData;
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Clerk Webhook Handler
 *
 * This webhook syncs Clerk user events to Supabase users table.
 *
 * Events handled:
 * - user.created: Creates a new user in Supabase with default 'free' plan
 * - user.updated: Updates user email if changed in Clerk
 * - user.deleted: Optionally handle user deletion
 *
 * Setup in Clerk Dashboard:
 * 1. Go to Webhooks section
 * 2. Add endpoint: https://your-domain.vercel.app/api/webhooks/clerk
 * 3. Subscribe to: user.created, user.updated
 * 4. Copy webhook secret to CLERK_WEBHOOK_SECRET env var
 */
export async function POST(req: Request) {
  // Get webhook secret
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Clerk Webhook] CLERK_WEBHOOK_SECRET not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  // Get Supabase credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Clerk Webhook] Supabase credentials not configured');
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    );
  }

  // Get headers
  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('[Clerk Webhook] Missing svix headers');
    return NextResponse.json(
      { error: 'Missing webhook headers' },
      { status: 400 }
    );
  }

  // Get body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verify webhook signature
  const wh = new Webhook(webhookSecret);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent;
  } catch (err: any) {
    console.error('[Clerk Webhook] Verification failed:', err.message);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Handle different event types
  const eventType = evt.type;
  console.log(`[Clerk Webhook] Processing event: ${eventType}`);

  try {
    switch (eventType) {
      case 'user.created': {
        const { id, email_addresses, primary_email_address_id } = evt.data;

        const emailAddresses = email_addresses ?? [];

        // Get primary email
        const primaryEmail = emailAddresses.find(
          (e) => e.id === primary_email_address_id
        );

        if (!primaryEmail?.email_address) {
          console.error('[Clerk Webhook] No primary email found for user:', id);
          return NextResponse.json(
            { error: 'No email address found' },
            { status: 400 }
          );
        }

        const email = primaryEmail.email_address;
        console.log(`[Clerk Webhook] Creating user: ${email}`);

        // Check if user already exists
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id, email, plan')
          .eq('email', email)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          // PGRST116 is "not found" which is fine
          throw checkError;
        }

        if (existingUser) {
          console.log(`[Clerk Webhook] User already exists: ${email}, skipping`);
          return NextResponse.json({ success: true, action: 'skip' });
        }

        // Create new user with free plan
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            email,
            plan: 'free',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          throw insertError;
        }

        console.log(`[Clerk Webhook] User created successfully: ${email}`);
        return NextResponse.json({ success: true, action: 'created' });
      }

      case 'user.updated': {
        const { id, email_addresses, primary_email_address_id } = evt.data;

        const emailAddresses = email_addresses ?? [];

        // Get primary email
        const primaryEmail = emailAddresses.find(
          (e) => e.id === primary_email_address_id
        );

        if (!primaryEmail?.email_address) {
          console.warn('[Clerk Webhook] No primary email found for user update:', id);
          return NextResponse.json({ success: true, action: 'skip' });
        }

        const email = primaryEmail.email_address;
        console.log(`[Clerk Webhook] User updated: ${email}`);

        // Update user record if it exists
        const { error: updateError } = await supabase
          .from('users')
          .update({
            email,
            updated_at: new Date().toISOString(),
          })
          .eq('email', email);

        if (updateError) {
          console.warn('[Clerk Webhook] User update failed:', updateError);
          // Don't fail the webhook for update errors
        }

        return NextResponse.json({ success: true, action: 'updated' });
      }

      case 'user.deleted': {
        const { id } = evt.data;
        console.log(`[Clerk Webhook] User deleted with ID: ${id}`);

        // Note: user.deleted event doesn't include email_addresses
        // If you need to handle deletions, you'll need to look up by Clerk user ID
        // or maintain a mapping in your database
        // For now, we'll just log the event

        return NextResponse.json({ success: true, action: 'logged' });
      }

      default:
        console.log(`[Clerk Webhook] Unhandled event type: ${eventType}`);
        return NextResponse.json({ success: true, action: 'ignored' });
    }
  } catch (error: any) {
    console.error('[Clerk Webhook] Error processing event:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
