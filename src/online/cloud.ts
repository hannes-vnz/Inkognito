import { supabase } from './supabase';
import { migrate, SAVE_VERSION, type Save } from '../systems/save';

export interface CloudUser {
  id: string;
  email: string | null;
}

export interface Profile {
  name: string;
  avatarColor: string;
  reefLevel: number;
  friendCode: string;
}

export interface Friend {
  id: string;
  name: string;
  avatarColor: string;
  reefLevel: number;
  direction: 'friend' | 'incoming' | 'outgoing';
}

export type FriendRequestResult = 'sent' | 'accepted' | 'already' | 'self' | 'unknown';

export const onlineAvailable = (): boolean => supabase !== null;

function client() {
  if (!supabase) throw new Error('Supabase ist nicht eingerichtet');
  return supabase;
}

export async function currentUser(): Promise<CloudUser | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  return u ? { id: u.id, email: u.email ?? null } : null;
}

export function onAuthChange(cb: (user: CloudUser | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const u = session?.user;
    cb(u ? { id: u.id, email: u.email ?? null } : null);
  });
  return () => data.subscription.unsubscribe();
}

/** Schickt eine Mail mit Login-Link und sechsstelligem Code. */
export async function sendLoginEmail(email: string): Promise<void> {
  const redirect = `${window.location.origin}${window.location.pathname}`;
  const { error } = await client().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect } });
  if (error) throw error;
}

/** Code aus der Mail eingeben: klappt auch, wenn die Mail auf einem anderen Gerät oder in einer anderen App geöffnet wurde. */
export async function verifyLoginCode(email: string, code: string): Promise<void> {
  const { error } = await client().auth.verifyOtp({ email: email.trim(), token: code, type: 'email' });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}

export async function fetchRemoteSave(userId: string): Promise<{ save: Save; updatedAt: number } | null> {
  const { data, error } = await client().from('saves').select('data, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { save: migrate(data.data, Date.now()), updatedAt: Date.parse(data.updated_at as string) };
}

export async function pushSave(userId: string, save: Save): Promise<void> {
  const { error } = await client()
    .from('saves')
    .upsert({ user_id: userId, data: save, version: SAVE_VERSION, updated_at: new Date(save.updatedAt).toISOString(), synced_at: new Date().toISOString() });
  if (error) throw error;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await client().from('profiles').select('name, avatar_color, reef_level, friend_code').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { name: data.name, avatarColor: data.avatar_color, reefLevel: data.reef_level, friendCode: data.friend_code };
}

export async function updateProfile(userId: string, patch: { name?: string; reefLevel?: number }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.reefLevel !== undefined) row.reef_level = patch.reefLevel;
  const { error } = await client().from('profiles').update(row).eq('id', userId);
  if (error) throw error;
}

export async function sendFriendRequest(code: string): Promise<FriendRequestResult> {
  const { data, error } = await client().rpc('send_friend_request', { code });
  if (error) throw error;
  return data as FriendRequestResult;
}

export async function acceptFriendRequest(requester: string): Promise<boolean> {
  const { data, error } = await client().rpc('accept_friend_request', { requester });
  if (error) throw error;
  return data as boolean;
}

export async function listFriends(): Promise<Friend[]> {
  const { data, error } = await client().rpc('list_friends');
  if (error) throw error;
  return (data as { id: string; name: string; avatar_color: string; reef_level: number; direction: Friend['direction'] }[]).map((f) => ({
    id: f.id,
    name: f.name,
    avatarColor: f.avatar_color,
    reefLevel: f.reef_level,
    direction: f.direction,
  }));
}
