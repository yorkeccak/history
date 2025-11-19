import { createClient } from '@supabase/supabase-js';

// Consistent environment check as per spec
const isDevelopment = process.env.NEXT_PUBLIC_APP_MODE === 'development';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetTime: Date;
  tier: string;
  used: number;
}

// Constants for rate limiting
const ANONYMOUS_LIMIT = 1; // Lifetime limit for anonymous users (not per day)
const FREE_LIMIT = 3; // Per day limit for signed-up free users
const SUBSCRIPTION_MONTHLY_LIMIT = 100; // Monthly limit for subscription users ($20/month)
const UNLIMITED_LIMIT = 999999; // For pay-per-use users (tracked via Polar events)

// Obfuscated cookie name
const COOKIE_NAME = '$dekcuf_teg';

/**
 * Anonymous users (before signup) - Cookie-based rate limiting (LIFETIME, not daily)
 */
export async function checkAnonymousRateLimit(): Promise<RateLimitResult> {
  if (isDevelopment) {
    return {
      allowed: true,
      remaining: UNLIMITED_LIMIT,
      limit: UNLIMITED_LIMIT,
      resetTime: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Far future
      tier: 'development',
      used: 0
    };
  }

  // Decode cookie data (no longer checking date for daily reset)
  const decodeCookieData = (encoded: string | null): number => {
    if (!encoded) return 0;
    try {
      const decoded = atob(encoded);
      return parseInt(decoded) || 0;
    } catch {
      return 0;
    }
  };

  const used = decodeCookieData(getCookie(COOKIE_NAME));
  const remaining = Math.max(0, ANONYMOUS_LIMIT - used);
  const allowed = used < ANONYMOUS_LIMIT;

  return {
    allowed,
    remaining,
    limit: ANONYMOUS_LIMIT,
    resetTime: new Date('2099-12-31'), // No reset - lifetime limit
    tier: 'anonymous',
    used
  };
}

/**
 * Authenticated users - Database-based rate limiting
 */
export async function checkUserRateLimit(userId: string): Promise<RateLimitResult> {
  if (isDevelopment) {
    return {
      allowed: true,
      remaining: UNLIMITED_LIMIT,
      limit: UNLIMITED_LIMIT,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      tier: 'development',
      used: 0
    };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get user subscription info from database
  const { data: user } = await supabase
    .from('users')
    .select('subscription_tier, subscription_status')
    .eq('id', userId)
    .single();

  // Determine tier from database subscription info
  const tier = (user?.subscription_status === 'active' && user?.subscription_tier)
    ? user.subscription_tier
    : 'free';

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM format

  const { data: rateLimitRecord } = await supabase
    .from('user_rate_limits')
    .select('usage_count, reset_date, monthly_usage_count, monthly_reset_date')
    .eq('user_id', userId)
    .single();

  // Calculate limits based on tier
  let used = 0;
  let limit = FREE_LIMIT;
  let remaining = 0;
  let resetTime = getNextMidnight();
  let allowed = true;

  if (tier === 'free') {
    // Free tier: 3 per day
    used = (rateLimitRecord && rateLimitRecord.reset_date === today)
      ? (rateLimitRecord.usage_count || 0)
      : 0;
    limit = FREE_LIMIT;
    remaining = Math.max(0, limit - used);
    allowed = used < limit;
    resetTime = getNextMidnight();
  } else if (tier === 'subscription') {
    // Subscription tier: 100 per month ($20/month)
    used = (rateLimitRecord && rateLimitRecord.monthly_reset_date === currentMonth)
      ? (rateLimitRecord.monthly_usage_count || 0)
      : 0;
    limit = SUBSCRIPTION_MONTHLY_LIMIT;
    remaining = Math.max(0, limit - used);
    allowed = used < limit;
    resetTime = getNextMonthStart();
  } else if (tier === 'pay_per_use') {
    // Pay-per-use: Unlimited (charged $0.25 per run via Polar events)
    used = rateLimitRecord?.usage_count || 0;
    limit = UNLIMITED_LIMIT;
    remaining = UNLIMITED_LIMIT;
    allowed = true;
    resetTime = new Date('2099-12-31');
  } else {
    // Unknown tier defaults to free
    used = 0;
    limit = FREE_LIMIT;
    remaining = FREE_LIMIT;
    allowed = true;
  }

  return {
    allowed,
    remaining,
    limit,
    resetTime,
    tier,
    used
  };
}

/**
 * Transfer anonymous usage to user account (called once on signup)
 */
export async function transferAnonymousToUser(userId: string): Promise<void> {
  if (isDevelopment) {
    return;
  }

  try {
    // Get current anonymous usage from cookies
    const anonymousUsage = getAnonymousUsage();
    
    if (anonymousUsage.used === 0) {
      return;
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = new Date().toISOString().split('T')[0];

    // Get existing record
    const { data: existingRecord } = await supabase
      .from('user_rate_limits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingRecord) {
      // Update existing record - add anonymous usage
      const newUsageCount = (existingRecord.usage_count || 0) + anonymousUsage.used;
      
      await supabase
        .from('user_rate_limits')
        .update({
          usage_count: newUsageCount,
          last_request_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

    } else {
      // Create new record with transferred usage
      await supabase
        .from('user_rate_limits')
        .insert({
          user_id: userId,
          usage_count: anonymousUsage.used,
          reset_date: today,
          last_request_at: new Date().toISOString(),
          tier: 'free',
        });
    }

    // Clear anonymous cookies
    clearAnonymousCookies();

  } catch (error) {
    throw error;
  }
}

/**
 * Increment usage (handles both anonymous and authenticated)
 */
export async function incrementRateLimit(userId?: string): Promise<RateLimitResult> {
  if (isDevelopment) {
    return userId 
      ? await checkUserRateLimit(userId)
      : await checkAnonymousRateLimit();
  }

  if (userId) {
    // Authenticated user - increment in database
    return await incrementUserRateLimit(userId);
  } else {
    // Anonymous user - increment cookies
    return await incrementAnonymousRateLimit();
  }
}

/**
 * Increment user rate limit in database
 * Handles both daily (free tier) and monthly (subscription tier) increments
 */
async function incrementUserRateLimit(userId: string): Promise<RateLimitResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM format

  // Get user subscription info
  const { data: user } = await supabase
    .from('users')
    .select('subscription_tier, subscription_status')
    .eq('id', userId)
    .single();

  const tier = (user?.subscription_status === 'active' && user?.subscription_tier)
    ? user.subscription_tier
    : 'free';

  // Get current record
  const { data: existingRecord } = await supabase
    .from('user_rate_limits')
    .select('*')
    .eq('user_id', userId)
    .single();

  let updates: any = {
    last_request_at: new Date().toISOString(),
  };

  if (tier === 'free') {
    // Free tier: Daily limit - increment usage_count
    if (existingRecord) {
      if (existingRecord.reset_date !== today) {
        // Reset for new day
        updates.usage_count = 1;
        updates.reset_date = today;
      } else {
        // Increment existing usage
        updates.usage_count = (existingRecord.usage_count || 0) + 1;
      }
    } else {
      // Create new record
      await supabase
        .from('user_rate_limits')
        .insert({
          user_id: userId,
          usage_count: 1,
          reset_date: today,
          monthly_usage_count: 0,
          monthly_reset_date: currentMonth,
          last_request_at: new Date().toISOString(),
        });
      return await checkUserRateLimit(userId);
    }
  } else if (tier === 'subscription') {
    // Subscription tier: Monthly limit - increment monthly_usage_count
    if (existingRecord) {
      if (existingRecord.monthly_reset_date !== currentMonth) {
        // Reset for new month
        updates.monthly_usage_count = 1;
        updates.monthly_reset_date = currentMonth;
      } else {
        // Increment existing monthly usage
        updates.monthly_usage_count = (existingRecord.monthly_usage_count || 0) + 1;
      }
    } else {
      // Create new record
      await supabase
        .from('user_rate_limits')
        .insert({
          user_id: userId,
          usage_count: 0,
          reset_date: today,
          monthly_usage_count: 1,
          monthly_reset_date: currentMonth,
          last_request_at: new Date().toISOString(),
        });
      return await checkUserRateLimit(userId);
    }
  } else if (tier === 'pay_per_use') {
    // Pay-per-use: Just track total count (billed via Polar events)
    if (existingRecord) {
      updates.usage_count = (existingRecord.usage_count || 0) + 1;
    } else {
      await supabase
        .from('user_rate_limits')
        .insert({
          user_id: userId,
          usage_count: 1,
          reset_date: today,
          monthly_usage_count: 0,
          monthly_reset_date: currentMonth,
          last_request_at: new Date().toISOString(),
        });
      return await checkUserRateLimit(userId);
    }
  }

  // Update existing record
  if (existingRecord) {
    await supabase
      .from('user_rate_limits')
      .update(updates)
      .eq('user_id', userId);
  }

  // Return updated rate limit status
  return await checkUserRateLimit(userId);
}

/**
 * Increment anonymous rate limit in cookies (lifetime limit, not daily)
 */
async function incrementAnonymousRateLimit(): Promise<RateLimitResult> {
  // Decode cookie data (simple count, no date)
  const decodeCookieData = (encoded: string | null): number => {
    if (!encoded) return 0;
    try {
      const decoded = atob(encoded);
      return parseInt(decoded) || 0;
    } catch {
      return 0;
    }
  };

  const encodeCookieData = (count: number): string => {
    return btoa(count.toString());
  };

  const currentCount = decodeCookieData(getCookie(COOKIE_NAME));
  const newCount = currentCount + 1;

  // Update cookie with encoded data (lifetime cookie - 10 years)
  const encodedData = encodeCookieData(newCount);
  setCookieWithExpiry(COOKIE_NAME, encodedData, 365 * 10); // 10 years

  const remaining = Math.max(0, ANONYMOUS_LIMIT - newCount);
  const allowed = newCount <= ANONYMOUS_LIMIT;

  return {
    allowed,
    remaining,
    limit: ANONYMOUS_LIMIT,
    resetTime: new Date('2099-12-31'), // No reset - lifetime limit
    tier: 'anonymous',
    used: newCount
  };
}

/**
 * Get current anonymous usage from cookies (lifetime count)
 */
function getAnonymousUsage(): { used: number; remaining: number } {
  if (typeof window === 'undefined') {
    return { used: 0, remaining: ANONYMOUS_LIMIT };
  }

  // Decode cookie data (simple count)
  const decodeCookieData = (encoded: string | null): number => {
    if (!encoded) return 0;
    try {
      const decoded = atob(encoded);
      return parseInt(decoded) || 0;
    } catch {
      return 0;
    }
  };

  const used = decodeCookieData(getCookie(COOKIE_NAME));
  const remaining = Math.max(0, ANONYMOUS_LIMIT - used);

  return { used, remaining };
}

/**
 * Clear anonymous rate limit cookies
 */
function clearAnonymousCookies(): void {
  if (typeof window === 'undefined') return;

  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

/**
 * Helper functions for cookie management
 */
function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

function setCookie(name: string, value: string): void {
  if (typeof window === 'undefined') return;

  const expires = new Date();
  expires.setTime(expires.getTime() + 24 * 60 * 60 * 1000); // 24 hours
  document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

function setCookieWithExpiry(name: string, value: string, days: number): void {
  if (typeof window === 'undefined') return;

  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

function getNextMidnight(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

function getNextMonthStart(): Date {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);
  return nextMonth;
}

/**
 * Rate limit display helper
 */
export function getRateLimitDisplay(rateLimit: RateLimitResult | null): string {
  if (!rateLimit) return 'Loading...';

  if (isDevelopment) return 'Dev Mode';

  if (rateLimit.tier === 'pay_per_use') {
    return `${rateLimit.used}/∞ queries (pay-per-use)`;
  }

  if (rateLimit.tier === 'subscription') {
    return `${rateLimit.used}/${rateLimit.limit} queries this month`;
  }

  if (rateLimit.tier === 'anonymous') {
    return `${rateLimit.used}/${rateLimit.limit} lifetime queries`;
  }

  return `${rateLimit.used}/${rateLimit.limit} queries today`;
}