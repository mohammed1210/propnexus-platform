import { NextRequest, NextResponse } from 'next/server';

/**
 * Admin proxy for property import operations
 * 
 * This server-side route forwards import requests to the backend API
 * with admin authentication, keeping the admin token secure.
 * 
 * POST /api/admin/import
 * Body: { location: string }
 * 
 * Security: Uses OFF_MARKET_ADMIN_TOKEN from server environment
 * No caching to ensure fresh data
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { location } = body;

    // Validate location
    if (!location || typeof location !== 'string') {
      return NextResponse.json(
        { error: 'Location is required and must be a string' },
        { status: 400 }
      );
    }

    // Get configuration from environment
    const apiBase = process.env.NEXT_PUBLIC_API_BASE;
    const adminToken = process.env.OFF_MARKET_ADMIN_TOKEN;

    if (!apiBase) {
      console.error('NEXT_PUBLIC_API_BASE is not configured');
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }

    if (!adminToken) {
      console.error('OFF_MARKET_ADMIN_TOKEN is not configured');
      return NextResponse.json(
        { error: 'Admin authentication not configured' },
        { status: 500 }
      );
    }

    // Forward request to backend
    const backendUrl = `${apiBase}/import/all`;
    console.log(`Forwarding import request to: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': adminToken,
      },
      body: JSON.stringify({ location }),
    });

    // Get response data
    const data = await response.json();

    // Return upstream status and body
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Admin import proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
