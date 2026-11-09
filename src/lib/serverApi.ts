/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserAccount, Team, PerformancePlan, Activity, AdminLog, DatabaseTableInfo } from '../types';

export async function verifyUserLogin(email: string, password: string, roleRequested: 'admin' | 'pegawai'): Promise<{ success: boolean; user?: UserAccount; message?: string; code?: string }> {
  try {
    const res = await fetch('/api/auth/verify-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, roleRequested })
    });
    const data = await res.json();
    return data;
  } catch (error: any) {
    return { success: false, message: 'Gagal terhubung ke Database Server OneInAPP.' };
  }
}

// --- USERS API ---
export async function fetchUsers(): Promise<UserAccount[]> {
  try {
    const res = await fetch('/api/users');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function createUser(user: Partial<UserAccount>, adminEmail: string, adminName: string): Promise<{ success: boolean; user?: UserAccount; message?: string }> {
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, adminEmail, adminName })
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal menambahkan pengguna.' };
  }
}

export async function updateUser(id: string, user: Partial<UserAccount>, adminEmail: string, adminName: string): Promise<{ success: boolean; user?: UserAccount; message?: string }> {
  try {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, adminEmail, adminName })
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal mengubah data pengguna.' };
  }
}

export async function deleteUser(id: string, adminEmail: string, adminName: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminEmail, adminName })
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal menghapus pengguna.' };
  }
}

// --- TEAMS API ---
export async function fetchTeams(): Promise<Team[]> {
  try {
    const res = await fetch('/api/teams');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function createTeam(team: Partial<Team>, adminEmail: string, adminName: string): Promise<{ success: boolean; team?: Team; message?: string }> {
  try {
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...team, adminEmail, adminName })
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal menambahkan tim.' };
  }
}

export async function updateTeam(id: string, team: Partial<Team>, adminEmail: string, adminName: string): Promise<{ success: boolean; team?: Team; message?: string }> {
  try {
    const res = await fetch(`/api/teams/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...team, adminEmail, adminName })
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal mengubah data tim.' };
  }
}

export async function deleteTeam(id: string, adminEmail: string, adminName: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`/api/teams/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminEmail, adminName })
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal menghapus tim.' };
  }
}

// --- PERFORMANCE PLANS API ---
export async function fetchPerformancePlans(year?: number, team?: string): Promise<PerformancePlan[]> {
  try {
    const params = new URLSearchParams();
    if (year) params.append('year', String(year));
    if (team && team !== 'All') params.append('team', team);

    const res = await fetch(`/api/performance-plans?${params.toString()}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function createPerformancePlan(plan: Partial<PerformancePlan>, adminEmail: string, adminName: string): Promise<{ success: boolean; plan?: PerformancePlan; message?: string }> {
  try {
    const res = await fetch('/api/performance-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...plan, adminEmail, adminName })
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal menambahkan rencana kinerja.' };
  }
}

export async function updatePerformancePlan(id: string, plan: Partial<PerformancePlan>, adminEmail: string, adminName: string): Promise<{ success: boolean; plan?: PerformancePlan; message?: string }> {
  try {
    const res = await fetch(`/api/performance-plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...plan, adminEmail, adminName })
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal mengubah data rencana kinerja.' };
  }
}

export async function deletePerformancePlan(id: string, adminEmail: string, adminName: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`/api/performance-plans/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminEmail, adminName })
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal menghapus rencana kinerja.' };
  }
}

export async function uploadPerformancePlans(plans: Partial<PerformancePlan>[], adminEmail: string, adminName: string): Promise<{ success: boolean; count?: number; message?: string }> {
  try {
    const res = await fetch('/api/performance-plans/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plans, adminEmail, adminName })
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal mengunggah rencana kinerja via Excel.' };
  }
}



// --- ACTIVITIES API ---
export async function fetchServerActivities(filters?: { email?: string; month?: string; year?: string | number; team?: string }): Promise<Activity[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.email) params.append('email', filters.email);
    if (filters?.month) params.append('month', filters.month);
    if (filters?.year) params.append('year', String(filters.year));
    if (filters?.team && filters.team !== 'All') params.append('team', filters.team);

    const res = await fetch(`/api/activities?${params.toString()}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function createServerActivity(activity: Partial<Activity>): Promise<{ success: boolean; activity?: Activity; message?: string }> {
  try {
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activity)
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal menyimpan aktivitas ke server database.' };
  }
}

export async function createBulkServerActivities(activities: Partial<Activity>[]): Promise<{ success: boolean; count?: number; message?: string }> {
  try {
    const res = await fetch('/api/activities/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activities })
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal menyimpan bulk aktivitas ke database.' };
  }
}

export async function updateServerActivity(id: string, activity: Partial<Activity>): Promise<{ success: boolean; activity?: Activity; message?: string }> {
  try {
    const res = await fetch(`/api/activities/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activity)
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal memperbarui aktivitas di server database.' };
  }
}

export async function deleteServerActivity(id: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`/api/activities/${id}`, {
      method: 'DELETE'
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal menghapus aktivitas.' };
  }
}

// --- ADMIN AUDIT LOGS ---
export async function fetchAdminLogs(): Promise<AdminLog[]> {
  try {
    const res = await fetch('/api/admin/logs');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// --- PHPMYADMIN DATABASE EXPLORER ---
export interface DatabaseExplorerResponse {
  engine: string;
  serverStatus: string;
  databaseName: string;
  totalTables: number;
  totalRows: number;
  totalSizeKb: number;
  tables: DatabaseTableInfo[];
  data: {
    users: UserAccount[];
    teams: Team[];
    performance_plans: PerformancePlan[];
    activities: Activity[];
    admin_logs: AdminLog[];
  };
}

export async function fetchDatabaseExplorer(): Promise<DatabaseExplorerResponse | null> {
  try {
    const res = await fetch('/api/admin/db-explorer');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function seedDefaultDatabase(adminEmail: string, adminName: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/admin/seed-default', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminEmail, adminName })
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal inisialisasi ulang database.' };
  }
}
