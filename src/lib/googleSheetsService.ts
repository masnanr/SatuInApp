/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Activity, PerformancePlan, UserAccount } from '../types';

export const DEFAULT_MASTER_SPREADSHEET_ID = '1YIFcJxjt2flsClWeU2emocR2Nglc0-tgl1xkXk16goI';
export const DEFAULT_MASTER_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_MASTER_SPREADSHEET_ID}/edit?usp=sharing`;

export const ACTIVITY_HEADERS = [
  'ID Aktivitas',
  'Nama Pegawai',
  'Email',
  'Tim',
  'Tanggal',
  'Jenis Kegiatan',
  'Sub Kegiatan',
  'Rencana Kinerja',
  'Progress (%)',
  'Link Google Drive PDF',
  'ID File Drive',
  'Status',
  'Catatan / Capaian',
  'Waktu Dibuat',
  'Waktu Diubah'
];

export const PLAN_HEADERS = [
  'ID Rencana Kinerja',
  'Tahun',
  'Tim',
  'Sasaran / Indikator Kinerja Kegiatan',
  'Target Output',
  'Satuan',
  'Bobot (%)',
  'Status'
];

export const USER_HEADERS = [
  'ID User',
  'Username',
  'Nama Pegawai',
  'Role',
  'Status',
  'Link Google Drive',
  'Tab Pegawai',
  'Waktu Dibuat'
];

/**
 * Ensures a specific Tab/Sheet exists inside the target Google Spreadsheet.
 * If it does not exist, it creates the tab via batchUpdate (addSheet) and writes headers.
 */
export async function ensureSheetTabExists(
  token: string,
  spreadsheetId: string = DEFAULT_MASTER_SPREADSHEET_ID,
  tabTitle: string,
  headers: string[] = ACTIVITY_HEADERS
): Promise<boolean> {
  if (!token || !spreadsheetId || !tabTitle) return false;

  const sanitizedTabTitle = tabTitle.trim();

  try {
    // 1. Get current list of sheets/tabs in the spreadsheet
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
    const res = await fetch(metadataUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      console.warn(`Could not fetch metadata for spreadsheet ${spreadsheetId}`);
      return false;
    }

    const data = await res.json();
    const existingSheetTitles: string[] = (data.sheets || []).map(
      (s: any) => s.properties?.title
    );

    // 2. If tab already exists, return true
    if (existingSheetTitles.includes(sanitizedTabTitle)) {
      return true;
    }

    // 3. Create tab if it does not exist
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const addSheetRes = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: sanitizedTabTitle
              }
            }
          }
        ]
      })
    });

    if (!addSheetRes.ok) {
      const errText = await addSheetRes.text();
      console.error(`Failed to add sheet tab "${sanitizedTabTitle}":`, errText);
      return false;
    }

    // 4. Populate headers in the new tab (A1:O1)
    const headerRange = `'${sanitizedTabTitle}'!A1:O1`;
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(headerRange)}?valueInputOption=USER_ENTERED`;
    await fetch(headerUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: headerRange,
        majorDimension: 'ROWS',
        values: [headers]
      })
    });

    return true;
  } catch (error) {
    console.error(`ensureSheetTabExists error for tab "${sanitizedTabTitle}":`, error);
    return false;
  }
}

/**
 * Synchronizes an activity row into a specific tab of a Google Spreadsheet (append or update)
 */
export async function syncActivityRowToSpreadsheetTab(
  token: string,
  spreadsheetId: string = DEFAULT_MASTER_SPREADSHEET_ID,
  sheetTitle: string,
  activity: Activity
): Promise<boolean> {
  if (!spreadsheetId || !token) return false;

  const sanitizedTabTitle = sheetTitle.trim();

  // Ensure tab exists first
  await ensureSheetTabExists(token, spreadsheetId, sanitizedTabTitle, ACTIVITY_HEADERS);

  const rowData = [
    activity.id,
    activity.employeeName,
    activity.email,
    activity.team,
    activity.date,
    activity.activityType || 'Kegiatan Kinerja',
    activity.subActivity,
    activity.rencana_kinerja || activity.performancePlanTitle || '-',
    activity.progress,
    activity.driveLink || '-',
    activity.driveFileId || '-',
    activity.status || 'Submitted',
    activity.capaian || activity.notes || '-',
    activity.createdAt || new Date().toISOString(),
    activity.updatedAt || new Date().toISOString()
  ];

  try {
    // 1. Check if activity ID already exists in Column A
    const searchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sanitizedTabTitle)}'!A:A`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.values) {
        const rowIndex = searchData.values.findIndex((v: any[]) => v[0] === activity.id);
        if (rowIndex !== -1) {
          const rowNum = rowIndex + 1;
          const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sanitizedTabTitle)}'!A${rowNum}:O${rowNum}?valueInputOption=USER_ENTERED`;
          const updateRes = await fetch(updateUrl, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              range: `'${sanitizedTabTitle}'!A${rowNum}:O${rowNum}`,
              majorDimension: 'ROWS',
              values: [rowData]
            })
          });
          return updateRes.ok;
        }
      }
    }

    // 2. If not found, append row to bottom
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sanitizedTabTitle)}'!A:O:append?valueInputOption=USER_ENTERED`;
    const appendRes = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: `'${sanitizedTabTitle}'!A:O`,
        majorDimension: 'ROWS',
        values: [rowData]
      })
    });

    return appendRes.ok;
  } catch (error) {
    console.error(`syncActivityRowToSpreadsheetTab (${sanitizedTabTitle}) error:`, error);
    return false;
  }
}

/**
 * Syncs a single activity to BOTH tab 'Semua Kegiatan' AND the employee's personal tab (e.g. 'Masna Fitria')
 */
export async function syncActivityToGoogleSheets(
  token: string,
  activity: Activity,
  spreadsheetId: string = DEFAULT_MASTER_SPREADSHEET_ID
): Promise<{ success: boolean; masterSynced: boolean; employeeSynced: boolean }> {
  if (!token || !activity) return { success: false, masterSynced: false, employeeSynced: false };

  try {
    // 1. Sync to Master Tab: 'Semua Kegiatan'
    const masterSynced = await syncActivityRowToSpreadsheetTab(
      token,
      spreadsheetId,
      'Semua Kegiatan',
      activity
    );

    // 2. Sync to Employee Tab: e.g. 'Masna Fitria'
    const empTabTitle = activity.employeeName?.trim() || 'Pegawai';
    const employeeSynced = await syncActivityRowToSpreadsheetTab(
      token,
      spreadsheetId,
      empTabTitle,
      activity
    );

    return {
      success: masterSynced || employeeSynced,
      masterSynced,
      employeeSynced
    };
  } catch (error) {
    console.error('syncActivityToGoogleSheets error:', error);
    return { success: false, masterSynced: false, employeeSynced: false };
  }
}

/**
 * Bulk syncs an array of activities to BOTH 'Semua Kegiatan' tab and individual employee tabs
 */
export async function syncBulkActivitiesToGoogleSheets(
  token: string,
  activities: Activity[],
  spreadsheetId: string = DEFAULT_MASTER_SPREADSHEET_ID
): Promise<{ total: number; successCount: number }> {
  if (!token || !activities || activities.length === 0) {
    return { total: 0, successCount: 0 };
  }

  let count = 0;
  for (const act of activities) {
    const res = await syncActivityToGoogleSheets(token, act, spreadsheetId);
    if (res.success) count++;
  }

  return { total: activities.length, successCount: count };
}

/**
 * Fetches all activity records from a spreadsheet tab (default: 'Semua Kegiatan')
 */
export async function fetchActivitiesFromMasterSpreadsheet(
  token: string,
  spreadsheetId: string = DEFAULT_MASTER_SPREADSHEET_ID,
  sheetTitle: string = 'Semua Kegiatan'
): Promise<Activity[]> {
  if (!spreadsheetId || !token) return [];

  try {
    const range = `'${sheetTitle}'!A:O`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    if (!data.values || data.values.length <= 1) {
      return [];
    }

    const rows = data.values.slice(1); // skip headers
    const activities: Activity[] = rows.map((row: any[]) => ({
      id: row[0] || '',
      employeeName: row[1] || '',
      email: row[2] || '',
      team: row[3] || '',
      date: row[4] || '',
      activityType: row[5] || 'Kegiatan Kinerja',
      subActivity: row[6] || '',
      rencana_kinerja: row[7] || '',
      performancePlanTitle: row[7] || '',
      progress: Number(row[8]) || 0,
      driveLink: row[9] || '',
      driveFileId: row[10] || '',
      status: (row[11] || 'Submitted') as Activity['status'],
      notes: row[12] || '',
      capaian: row[12] || '',
      createdAt: row[13] || new Date().toISOString(),
      updatedAt: row[14] || new Date().toISOString()
    }));

    return activities.filter(act => act.id && act.status !== 'Deleted');
  } catch (error) {
    console.error(`fetchActivitiesFromMasterSpreadsheet (${spreadsheetId}) error:`, error);
    return [];
  }
}

/**
 * Initializes tabs for all registered employees in the single spreadsheet
 */
export async function initializeAllEmployeeTabs(
  token: string,
  spreadsheetId: string = DEFAULT_MASTER_SPREADSHEET_ID,
  employeeNames: string[]
): Promise<{ success: boolean; createdCount: number }> {
  if (!token || !spreadsheetId) return { success: false, createdCount: 0 };

  let created = 0;
  // Ensure Master tab
  await ensureSheetTabExists(token, spreadsheetId, 'Semua Kegiatan', ACTIVITY_HEADERS);

  for (const name of employeeNames) {
    if (!name) continue;
    const ok = await ensureSheetTabExists(token, spreadsheetId, name.trim(), ACTIVITY_HEADERS);
    if (ok) created++;
  }

  return { success: true, createdCount: created };
}

/**
 * Syncs a user account to Google Spreadsheet tab 'Master Pengguna' AND creates their personal tab (e.g. 'Masna Fitria')
 */
export async function syncUserToGoogleSheets(
  token: string,
  user: UserAccount,
  spreadsheetId: string = DEFAULT_MASTER_SPREADSHEET_ID
): Promise<boolean> {
  if (!token || !user) return false;

  try {
    // 1. Ensure tab 'Master Pengguna' exists
    await ensureSheetTabExists(token, spreadsheetId, 'Master Pengguna', USER_HEADERS);

    // 2. Ensure personal employee tab exists (e.g. 'Masna Fitria')
    if (user.name) {
      await ensureSheetTabExists(token, spreadsheetId, user.name.trim(), ACTIVITY_HEADERS);
    }

    const rowData = [
      user.id || `usr-${Date.now()}`,
      user.username || (user.email ? user.email.split('@')[0] : '-'),
      user.name || '-',
      user.role || 'pegawai',
      user.status || 'active',
      user.driveSkripsiLink || '-',
      user.name ? user.name.trim() : '-',
      user.createdAt || new Date().toISOString()
    ];

    // 3. Search if ID exists in Column A of 'Master Pengguna'
    const searchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Master Pengguna'!A:A`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.values) {
        const rowIndex = searchData.values.findIndex((v: any[]) => v[0] === user.id);
        if (rowIndex !== -1) {
          const rowNum = rowIndex + 1;
          const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Master Pengguna'!A${rowNum}:H${rowNum}?valueInputOption=USER_ENTERED`;
          const updateRes = await fetch(updateUrl, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              range: `'Master Pengguna'!A${rowNum}:H${rowNum}`,
              majorDimension: 'ROWS',
              values: [rowData]
            })
          });
          return updateRes.ok;
        }
      }
    }

    // 4. Append user row to 'Master Pengguna'
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Master Pengguna'!A:H:append?valueInputOption=USER_ENTERED`;
    const appendRes = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: `'Master Pengguna'!A:H`,
        majorDimension: 'ROWS',
        values: [rowData]
      })
    });

    return appendRes.ok;
  } catch (error) {
    console.error('syncUserToGoogleSheets error:', error);
    return false;
  }
}

/**
 * Fully populates all tabs (Semua Kegiatan, Master Pengguna, Master Tim, Master Rencana Kinerja, and Employee Tabs)
 * in target Google Spreadsheet ID 1YIFcJxjt2flsClWeU2emocR2Nglc0-tgl1xkXk16goI
 */
export async function seedFullMasterSpreadsheet(
  token: string,
  spreadsheetId: string = DEFAULT_MASTER_SPREADSHEET_ID,
  users: UserAccount[] = [],
  activities: Activity[] = [],
  plans: PerformancePlan[] = [],
  teams: any[] = []
): Promise<{ success: boolean; message: string }> {
  if (!token || !spreadsheetId) return { success: false, message: 'OAuth token atau Spreadsheet ID tidak ditemukan.' };

  try {
    // 1. Ensure all 4 Master Tabs exist
    await ensureSheetTabExists(token, spreadsheetId, 'Semua Kegiatan', ACTIVITY_HEADERS);
    await ensureSheetTabExists(token, spreadsheetId, 'Master Pengguna', USER_HEADERS);
    await ensureSheetTabExists(token, spreadsheetId, 'Master Tim', ['ID Tim', 'Kode', 'Nama Tim', 'Deskripsi', 'Nama Ketua', 'Email Ketua', 'Waktu Dibuat']);
    await ensureSheetTabExists(token, spreadsheetId, 'Master Rencana Kinerja', PLAN_HEADERS);

    // 2. Write Master Pengguna
    if (users.length > 0) {
      const userRows = users.map(u => [
        u.id,
        u.username || (u.email ? u.email.split('@')[0] : '-'),
        u.name,
        u.role,
        u.status,
        u.driveSkripsiLink || '-',
        u.name,
        u.createdAt || new Date().toISOString()
      ]);
      const userRange = `'Master Pengguna'!A1:H${userRows.length + 1}`;
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(userRange)}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: userRange, majorDimension: 'ROWS', values: [USER_HEADERS, ...userRows] })
      });
    }

    // 3. Write Master Tim
    if (teams.length > 0) {
      const teamHeaders = ['ID Tim', 'Kode', 'Nama Tim', 'Deskripsi', 'Nama Ketua', 'Email Ketua', 'Waktu Dibuat'];
      const teamRows = teams.map(t => [
        t.id,
        t.code,
        t.name,
        t.description,
        t.leaderName,
        t.leaderEmail,
        t.createdAt || new Date().toISOString()
      ]);
      const teamRange = `'Master Tim'!A1:G${teamRows.length + 1}`;
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(teamRange)}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: teamRange, majorDimension: 'ROWS', values: [teamHeaders, ...teamRows] })
      });
    }

    // 4. Write Master Rencana Kinerja
    if (plans.length > 0) {
      const planRows = plans.map(p => [
        p.id,
        p.year,
        p.team,
        p.indicator,
        p.targetOutput,
        p.unit,
        p.weight,
        p.status
      ]);
      const planRange = `'Master Rencana Kinerja'!A1:H${planRows.length + 1}`;
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(planRange)}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: planRange, majorDimension: 'ROWS', values: [PLAN_HEADERS, ...planRows] })
      });
    }

    // 5. Write Semua Kegiatan
    if (activities.length > 0) {
      const actRows = activities.map(a => [
        a.id,
        a.employeeName,
        a.email,
        a.team,
        a.date,
        a.activityType || 'Kegiatan Kinerja',
        a.subActivity,
        a.rencana_kinerja || a.performancePlanTitle || '-',
        a.progress,
        a.driveLink || '-',
        a.driveFileId || '-',
        a.status || 'Submitted',
        a.capaian || a.notes || '-',
        a.createdAt || new Date().toISOString(),
        a.updatedAt || new Date().toISOString()
      ]);
      const actRange = `'Semua Kegiatan'!A1:O${actRows.length + 1}`;
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(actRange)}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: actRange, majorDimension: 'ROWS', values: [ACTIVITY_HEADERS, ...actRows] })
      });
    }

    // 6. Ensure and write Employee Tabs for every registered user
    for (const u of users) {
      if (!u.name) continue;
      const empTabName = u.name.trim();
      await ensureSheetTabExists(token, spreadsheetId, empTabName, ACTIVITY_HEADERS);

      const empActs = activities.filter(a =>
        (a.employeeName && a.employeeName.toLowerCase().trim() === empTabName.toLowerCase()) ||
        (a.email && u.email && a.email.toLowerCase().trim() === u.email.toLowerCase().trim())
      );

      const empRows = empActs.map(a => [
        a.id,
        a.employeeName,
        a.email,
        a.team,
        a.date,
        a.activityType || 'Kegiatan Kinerja',
        a.subActivity,
        a.rencana_kinerja || a.performancePlanTitle || '-',
        a.progress,
        a.driveLink || '-',
        a.driveFileId || '-',
        a.status || 'Submitted',
        a.capaian || a.notes || '-',
        a.createdAt || new Date().toISOString(),
        a.updatedAt || new Date().toISOString()
      ]);

      const empRange = `'${encodeURIComponent(empTabName)}'!A1:O${empRows.length + 1}`;
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${empRange}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: `'${empTabName}'!A1:O${empRows.length + 1}`, majorDimension: 'ROWS', values: [ACTIVITY_HEADERS, ...empRows] })
      });
    }

    return { success: true, message: `Berhasil mengunggah seluruh data & tab pegawai ke Google Spreadsheet (ID: ${spreadsheetId})!` };
  } catch (err: any) {
    console.error('seedFullMasterSpreadsheet error:', err);
    return { success: false, message: 'Gagal sinkronisasi data ke Google Spreadsheet: ' + err.message };
  }
}
