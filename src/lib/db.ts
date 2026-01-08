/**
 * Unified database interface that switches between Supabase (valyu mode)
 * and SQLite (self-hosted mode) based on NEXT_PUBLIC_APP_MODE
 */

import { createClient as createSupabaseClient } from "@/utils/supabase/server";
import { getLocalDb, DEV_USER_ID } from "./local-db/client";
import { getDevUser, isSelfHostedMode } from "./local-db/local-auth";
import { eq, desc, and } from "drizzle-orm";
import * as schema from "./local-db/schema";

// ============================================================================
// AUTH FUNCTIONS
// ============================================================================

export async function getUser() {
  if (isSelfHostedMode()) {
    return { data: { user: getDevUser() }, error: null };
  }

  const supabase = await createSupabaseClient();
  return await supabase.auth.getUser();
}

export async function getSession() {
  if (isSelfHostedMode()) {
    return {
      data: {
        session: {
          user: getDevUser(),
          access_token: "dev-access-token",
        },
      },
      error: null,
    };
  }

  const supabase = await createSupabaseClient();
  return await supabase.auth.getSession();
}

// ============================================================================
// USER PROFILE FUNCTIONS
// ============================================================================

export async function getUserProfile(userId: string) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });
    return { data: user || null, error: null };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();
  return { data, error };
}

// ============================================================================
// RATE LIMIT FUNCTIONS
// ============================================================================

export async function getUserRateLimit(userId: string) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    const rateLimit = await db.query.userRateLimits.findFirst({
      where: eq(schema.userRateLimits.userId, userId),
    });
    return { data: rateLimit || null, error: null };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("user_rate_limits")
    .select("*")
    .eq("user_id", userId)
    .single();
  return { data, error };
}

export async function updateUserRateLimit(
  userId: string,
  updates: { usage_count?: number; reset_date?: string; last_request_at?: Date }
) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    await db
      .update(schema.userRateLimits)
      .set({
        usageCount: updates.usage_count,
        resetDate: updates.reset_date,
        lastRequestAt: updates.last_request_at,
      })
      .where(eq(schema.userRateLimits.userId, userId));
    return { error: null };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("user_rate_limits")
    .update(updates)
    .eq("user_id", userId);
  return { error };
}

// ============================================================================
// CHAT SESSION FUNCTIONS
// ============================================================================

export async function getChatSessions(userId: string) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    const sessions = await db.query.chatSessions.findMany({
      where: eq(schema.chatSessions.userId, userId),
      orderBy: [desc(schema.chatSessions.updatedAt)],
    });
    return { data: sessions, error: null };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  return { data, error };
}

export async function getChatSession(sessionId: string, userId: string) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    const session = await db.query.chatSessions.findFirst({
      where: and(
        eq(schema.chatSessions.id, sessionId),
        eq(schema.chatSessions.userId, userId)
      ),
    });
    return { data: session || null, error: null };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();
  return { data, error };
}

export async function createChatSession(session: {
  id: string;
  user_id: string;
  title: string;
}) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    await db.insert(schema.chatSessions).values({
      id: session.id,
      userId: session.user_id,
      title: session.title,
    });
    return { error: null };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("chat_sessions").insert(session);
  return { error };
}

export async function updateChatSession(
  sessionId: string,
  userId: string,
  updates: { title?: string; last_message_at?: Date }
) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    const updateData: any = {
      updatedAt: new Date(),
    };
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.last_message_at !== undefined)
      updateData.lastMessageAt = updates.last_message_at;

    await db
      .update(schema.chatSessions)
      .set(updateData)
      .where(
        and(
          eq(schema.chatSessions.id, sessionId),
          eq(schema.chatSessions.userId, userId)
        )
      );
    return { error: null };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("chat_sessions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId);
  return { error };
}

export async function deleteChatSession(sessionId: string, userId: string) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    await db
      .delete(schema.chatSessions)
      .where(
        and(
          eq(schema.chatSessions.id, sessionId),
          eq(schema.chatSessions.userId, userId)
        )
      );
    return { error: null };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);
  return { error };
}

// ============================================================================
// CHAT MESSAGE FUNCTIONS
// ============================================================================

export async function getChatMessages(sessionId: string) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    const messages = await db.query.chatMessages.findMany({
      where: eq(schema.chatMessages.sessionId, sessionId),
      orderBy: [schema.chatMessages.createdAt],
    });
    return { data: messages, error: null };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  return { data, error };
}

export async function saveChatMessages(
  sessionId: string,
  messages: Array<{
    id: string;
    role: string;
    content: any;
    processing_time_ms?: number;
  }>
) {

  if (isSelfHostedMode()) {
    const db = getLocalDb();

    // Delete existing messages
    await db
      .delete(schema.chatMessages)
      .where(eq(schema.chatMessages.sessionId, sessionId));

    // Insert new messages
    if (messages.length > 0) {
      await db.insert(schema.chatMessages).values(
        messages.map((msg) => ({
          id: msg.id,
          sessionId: sessionId,
          role: msg.role,
          content: JSON.stringify(msg.content),
          processingTimeMs: msg.processing_time_ms,
        }))
      );
    }
    return { error: null };
  }

  const supabase = await createSupabaseClient();

  // Delete existing messages
  const deleteResult = await supabase.from("chat_messages").delete().eq("session_id", sessionId);
  if (deleteResult.error) {
  }

  // Insert new messages
  if (messages.length > 0) {
    const messagesToInsert = messages.map((msg) => ({
      id: msg.id,
      session_id: sessionId,
      role: msg.role,
      content: msg.content,
      processing_time_ms: msg.processing_time_ms,
    }));

    const { error } = await supabase.from("chat_messages").insert(messagesToInsert);
    if (error) {
    } else {
    }
    return { error };
  }

  return { error: null };
}

export async function deleteChatMessages(sessionId: string) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    await db
      .delete(schema.chatMessages)
      .where(eq(schema.chatMessages.sessionId, sessionId));
    return { error: null };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("session_id", sessionId);
  return { error };
}

// ============================================================================
// CHART FUNCTIONS
// ============================================================================

export async function getChart(chartId: string) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    const chart = await db.query.charts.findFirst({
      where: eq(schema.charts.id, chartId),
    });
    return { data: chart || null, error: null };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("charts")
    .select("*")
    .eq("id", chartId)
    .single();
  return { data, error };
}

export async function createChart(chart: {
  id: string;
  user_id?: string;
  anonymous_id?: string;
  session_id: string;
  chart_data: any;
}) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    await db.insert(schema.charts).values({
      id: chart.id,
      userId: chart.user_id || null,
      anonymousId: chart.anonymous_id || null,
      sessionId: chart.session_id,
      chartData: JSON.stringify(chart.chart_data),
    });
    return { error: null };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("charts").insert(chart);
  return { error };
}

// ============================================================================
// CSV FUNCTIONS
// ============================================================================

export async function getCSV(csvId: string) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    const csv = await db.query.csvs.findFirst({
      where: eq(schema.csvs.id, csvId),
    });
    return { data: csv || null, error: null };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("csvs")
    .select("*")
    .eq("id", csvId)
    .single();
  return { data, error };
}

export async function createCSV(csv: {
  id: string;
  user_id?: string;
  anonymous_id?: string;
  session_id: string;
  title: string;
  description?: string;
  headers: string[];
  rows: any[][];
}) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    await db.insert(schema.csvs).values({
      id: csv.id,
      userId: csv.user_id || null,
      anonymousId: csv.anonymous_id || null,
      sessionId: csv.session_id,
      title: csv.title,
      description: csv.description || null,
      headers: JSON.stringify(csv.headers),
      rows: JSON.stringify(csv.rows),
    });
    return { error: null };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("csvs").insert(csv);
  return { error };
}

// ============================================================================
// RESEARCH TASKS FUNCTIONS
// ============================================================================

export async function getResearchTasks(userId: string) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    const tasks = await db.query.researchTasks.findMany({
      where: eq(schema.researchTasks.userId, userId),
      orderBy: [desc(schema.researchTasks.createdAt)],
      limit: 50,
    });
    return { data: tasks || [], error: null };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("research_tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return { data: data || [], error };
}

export async function getResearchTask(taskId: string) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    const task = await db.query.researchTasks.findFirst({
      where: eq(schema.researchTasks.id, taskId),
    });
    return { data: task || null, error: null };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("research_tasks")
    .select("*")
    .eq("id", taskId)
    .single();
  return { data, error };
}

export async function createResearchTask(task: {
  id: string;
  user_id?: string;
  deepresearch_id: string;
  location_name: string;
  location_lat: number;
  location_lng: number;
  status?: string;
  anonymous_id?: string;
}) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    await db.insert(schema.researchTasks).values({
      id: task.id,
      userId: task.user_id || null,
      deepresearchId: task.deepresearch_id,
      locationName: task.location_name,
      locationLat: task.location_lat,
      locationLng: task.location_lng,
      status: task.status || "queued",
      anonymousId: task.anonymous_id || null,
    });
    return { error: null };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("research_tasks").insert(task);
  return { error };
}

export async function updateResearchTask(
  taskId: string,
  updates: {
    status?: string;
    completed_at?: Date | null;
    location_images?: string;
  }
) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    const updateData: any = {
      updatedAt: new Date(),
    };
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.completed_at !== undefined)
      updateData.completedAt = updates.completed_at;
    if (updates.location_images !== undefined)
      updateData.locationImages = updates.location_images;

    await db
      .update(schema.researchTasks)
      .set(updateData)
      .where(eq(schema.researchTasks.id, taskId));
    return { error: null };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("research_tasks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", taskId);
  return { error };
}

export async function updateResearchTaskByDeepResearchId(
  deepresearchId: string,
  updates: {
    status?: string;
    completed_at?: Date | null;
  }
) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    const updateData: any = {
      updatedAt: new Date(),
    };
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.completed_at !== undefined)
      updateData.completedAt = updates.completed_at;

    await db
      .update(schema.researchTasks)
      .set(updateData)
      .where(eq(schema.researchTasks.deepresearchId, deepresearchId));
    return { error: null };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("research_tasks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("deepresearch_id", deepresearchId);
  return { error };
}

// Helper function to create URL-friendly slug from location name
function createLocationSlug(locationName: string): string {
  return locationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
}

// Share a research task publicly
export async function shareResearchTask(taskId: string, userId: string) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();

    // Get the task to access location_name
    const [task] = await db.select()
      .from(schema.researchTasks)
      .where(eq(schema.researchTasks.id, taskId));

    if (!task) {
      return { data: null, error: new Error('Task not found') };
    }

    const locationSlug = createLocationSlug(task.locationName);
    const randomId = Math.random().toString(36).substring(2, 10); // 8 chars
    const shareToken = `${locationSlug}-${randomId}`;

    await db.update(schema.researchTasks)
      .set({
        isPublic: true,
        shareToken: shareToken,
        sharedAt: new Date(),
      })
      .where(eq(schema.researchTasks.id, taskId));
    return { data: { share_token: shareToken }, error: null };
  }

  const supabase = await createSupabaseClient();

  // Get the task to access location_name
  const { data: task } = await supabase
    .from("research_tasks")
    .select('location_name')
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();

  if (!task) {
    return { data: null, error: new Error('Task not found or unauthorized') };
  }

  // Create slug from location name + random ID
  const locationSlug = createLocationSlug(task.location_name);
  const randomId = Math.random().toString(36).substring(2, 10); // 8 chars
  const shareToken = `${locationSlug}-${randomId}`;

  // Update the task to be public with the share token
  const { data, error } = await supabase
    .from("research_tasks")
    .update({
      is_public: true,
      share_token: shareToken,
      shared_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("user_id", userId) // Ensure user owns this task
    .select('share_token')
    .single();

  return { data, error };
}

// Unshare a research task
export async function unshareResearchTask(taskId: string, userId: string) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    await db.update(schema.researchTasks)
      .set({
        isPublic: false,
        shareToken: null,
        sharedAt: null,
      })
      .where(eq(schema.researchTasks.id, taskId));
    return { error: null };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("research_tasks")
    .update({
      is_public: false,
      share_token: null,
      shared_at: null,
    })
    .eq("id", taskId)
    .eq("user_id", userId);

  return { error };
}

// Get a public research task by share token (no auth required)
export async function getPublicResearchTask(shareToken: string) {
  if (isSelfHostedMode()) {
    const db = getLocalDb();
    const [task] = await db.select()
      .from(schema.researchTasks)
      .where(eq(schema.researchTasks.shareToken, shareToken));
    return { data: task || null, error: null };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("research_tasks")
    .select('*')
    .eq("share_token", shareToken)
    .eq("is_public", true)
    .single();

  return { data, error };
}
