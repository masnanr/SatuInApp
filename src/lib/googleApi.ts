/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Activity } from '../types';

// Columns:
// 0: ID Aktivitas (Activity ID)
// 1: Nama Pegawai (Employee Name)
// 2: Email
// 3: Tim (Team)
// 4: Tanggal (Date)
// 5: Jenis Kegiatan (Activity Type)
// 6: Sub Kegiatan (Sub Activity)
// 7: Progress (0-100)
// 8: Link Google Drive
// 9: ID File Google Drive
// 10: Status (Draft / Submitted)
// 11: Waktu dibuat (Created At)
// 12: Waktu terakhir diubah (Updated At)

const HEADERS = [
  'ID Aktivitas',
  'Nama Pegawai',
  'Email',
  'Tim',
  'Tanggal',
  'Jenis Kegiatan',
  'Sub Kegiatan',
  'Progress',
  'Link Google Drive',
  'ID File Google Drive',
  'Status',
  'Waktu dibuat',
  'Waktu terakhir diubah'
];

/**
 * Searches for KIPAPP spreadsheet in Google Drive
 */
export async function searchSpreadsheet(token: string): Promise<{ id: string; name: string } | null> {
  const q = encodeURIComponent("name = 'KIPAPP Admin Metadata' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`;
  
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      throw new Error(`Search failed: ${res.statusText}`);
    }
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0];
    }
    return null;
  } catch (error) {
    console.error('searchSpreadsheet error:', error);
    return null;
  }
}

/**
 * Creates KIPAPP spreadsheet and writes headers
 */
export async function createSpreadsheet(token: string): Promise<string> {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets';
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: 'KIPAPP Admin Metadata'
        }
      })
    });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gagal membuat spreadsheet: ${errText}`);
    }
    
    const spreadsheet = await res.json();
    const spreadsheetId = spreadsheet.spreadsheetId;
    const sheetTitle = spreadsheet.sheets?.[0]?.properties?.title || 'Sheet1';
    
    // Write headers
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}!A1:M1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: `${sheetTitle}!A1:M1`,
        majorDimension: 'ROWS',
        values: [HEADERS]
      })
    });
    
    // Seed initial dummy team members data so that Head of Office Monitoring looks beautiful right away!
    await seedDemoData(token, spreadsheetId, sheetTitle);
    
    return spreadsheetId;
  } catch (error) {
    console.error('createSpreadsheet error:', error);
    throw error;
  }
}

/**
 * Fetches the first sheet title from a spreadsheet
 */
export async function getFirstSheetTitle(token: string, spreadsheetId: string): Promise<string> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title))`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      return 'Sheet1';
    }
    const data = await res.json();
    return data.sheets?.[0]?.properties?.title || 'Sheet1';
  } catch {
    return 'Sheet1';
  }
}

/**
 * Helper to fetch all activities from the Spreadsheet
 */
export async function fetchAllActivities(token: string, spreadsheetId: string): Promise<Activity[]> {
  try {
    const sheetTitle = await getFirstSheetTitle(token, spreadsheetId);
    const range = `${sheetTitle}!A:M`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch spreadsheet rows: ${res.statusText}`);
    }
    
    const data = await res.json();
    if (!data.values || data.values.length <= 1) {
      return [];
    }
    
    const rows = data.values.slice(1); // skip headers
    const activities: Activity[] = rows.map((row: any[]) => {
      return {
        id: row[0] || '',
        employeeName: row[1] || '',
        email: row[2] || '',
        team: row[3] || '',
        date: row[4] || '',
        activityType: row[5] || '',
        subActivity: row[6] || '',
        progress: Number(row[7]) || 0,
        driveLink: row[8] || '',
        driveFileId: row[9] || '',
        status: (row[10] || 'Draft') as Activity['status'],
        createdAt: row[11] || '',
        updatedAt: row[12] || ''
      };
    });
    
    // Filter out deleted ones if any, or return all depending on status
    return activities.filter(act => act.id && act.status !== 'Deleted');
  } catch (error) {
    console.error('fetchAllActivities error:', error);
    return [];
  }
}

/**
 * Adds a new activity row to the Spreadsheet
 */
export async function addActivityRow(token: string, spreadsheetId: string, activity: Activity): Promise<boolean> {
  try {
    const sheetTitle = await getFirstSheetTitle(token, spreadsheetId);
    const range = `${sheetTitle}!A:M`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
    
    const row = [
      activity.id,
      activity.employeeName,
      activity.email,
      activity.team,
      activity.date,
      activity.activityType,
      activity.subActivity,
      activity.progress,
      activity.driveLink,
      activity.driveFileId,
      activity.status,
      activity.createdAt,
      activity.updatedAt
    ];
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: [row]
      })
    });
    
    return res.ok;
  } catch (error) {
    console.error('addActivityRow error:', error);
    return false;
  }
}

/**
 * Updates an existing activity row in the Spreadsheet
 */
export async function updateActivityRow(token: string, spreadsheetId: string, activity: Activity): Promise<boolean> {
  try {
    const sheetTitle = await getFirstSheetTitle(token, spreadsheetId);
    // 1. Fetch all rows of column A to find the row index matching the activity ID
    const urlGet = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}!A:A`;
    const resGet = await fetch(urlGet, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!resGet.ok) return false;
    const dataGet = await resGet.json();
    if (!dataGet.values) return false;
    
    const index = dataGet.values.findIndex((val: any[]) => val[0] === activity.id);
    if (index === -1) {
      // Not found, append instead
      return await addActivityRow(token, spreadsheetId, activity);
    }
    
    const rowNumber = index + 1; // 1-based index
    const urlPut = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}!A${rowNumber}:M${rowNumber}?valueInputOption=USER_ENTERED`;
    
    const row = [
      activity.id,
      activity.employeeName,
      activity.email,
      activity.team,
      activity.date,
      activity.activityType,
      activity.subActivity,
      activity.progress,
      activity.driveLink,
      activity.driveFileId,
      activity.status,
      activity.createdAt,
      activity.updatedAt
    ];
    
    const resPut = await fetch(urlPut, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: `${sheetTitle}!A${rowNumber}:M${rowNumber}`,
        majorDimension: 'ROWS',
        values: [row]
      })
    });
    
    return resPut.ok;
  } catch (error) {
    console.error('updateActivityRow error:', error);
    return false;
  }
}

/**
 * Performs a client-side multipart file upload to Google Drive
 */
export async function uploadFileToDrive(
  token: string,
  file: File
): Promise<{ id: string; webViewLink: string } | null> {
  try {
    const metadata = {
      name: file.name,
      description: 'Lampiran laporan KIPAPP'
    };
    
    const boundary = 'kipapp_multipart_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    
    const fileContent = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
    
    // Convert array buffer to base64
    let binary = '';
    const bytes = new Uint8Array(fileContent);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Content = btoa(binary);
    
    const multipartBody = 
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${file.type}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      base64Content +
      closeDelimiter;
      
    const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Upload failed: ${text}`);
    }
    
    const data = await res.json();
    return {
      id: data.id || '',
      webViewLink: data.webViewLink || ''
    };
  } catch (error) {
    console.error('uploadFileToDrive error:', error);
    return null;
  }
}

/**
 * Share file with specified email as Viewer (reader role)
 */
export async function shareFileWithViewer(token: string, fileId: string, email: string): Promise<boolean> {
  if (!email || !email.trim() || !email.includes('@')) return false;
  
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?sendNotificationEmail=false`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'user',
        emailAddress: email.trim()
      })
    });
    
    return res.ok;
  } catch (error) {
    console.error(`shareFileWithViewer to ${email} error:`, error);
    return false;
  }
}

/**
 * Seed initial demo data in the newly created spreadsheet so that stats make sense.
 * Seed exact target progress percentages for Masna, Finda, Nurul, Azka!
 */
async function seedDemoData(token: string, spreadsheetId: string, sheetTitle: string): Promise<void> {
  const dateObj = new Date();
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  
  // Create sample dates
  const d1 = `${year}-${month}-02`;
  const d2 = `${year}-${month}-12`;
  const d3 = `${year}-${month}-20`;
  const d4 = `${year}-${month}-25`;
  
  const demoActivities: Activity[] = [
    // Nurul: Target 4 kegiatan, total progress 400 (Avg progress 100%, 100% of Target 4) => Nurul has 100%
    {
      id: 'demo-nur-1',
      employeeName: 'Nurul Hidayah',
      email: 'nurul.hidayah@example.com',
      team: 'Tim Sosial',
      date: d1,
      activityType: 'Survei / Pencacahan',
      subActivity: 'Survei Angkatan Kerja Nasional (Sakernas)',
      progress: 100,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-nur-1',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-nur-2',
      employeeName: 'Nurul Hidayah',
      email: 'nurul.hidayah@example.com',
      team: 'Tim Sosial',
      date: d2,
      activityType: 'Pengolahan Data',
      subActivity: 'Entri Data Sakernas Terintegrasi',
      progress: 100,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-nur-2',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-nur-3',
      employeeName: 'Nurul Hidayah',
      email: 'nurul.hidayah@example.com',
      team: 'Tim Sosial',
      date: d3,
      activityType: 'Analisis & Diseminasi',
      subActivity: 'Penyusunan Publikasi Sakernas',
      progress: 100,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-nur-3',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-nur-4',
      employeeName: 'Nurul Hidayah',
      email: 'nurul.hidayah@example.com',
      team: 'Tim Sosial',
      date: d4,
      activityType: 'Rapat / Koordinasi',
      subActivity: 'Evaluasi Pelaksanaan Survei Sosial',
      progress: 100,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-nur-4',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },

    // Masna: Target 10 kegiatan. Total progress 820% (avg progress 82%) => Masna has 82%
    {
      id: 'demo-mas-1',
      employeeName: 'Masna Novita Rahmaniar',
      email: 'rmasnanovita@gmail.com', // Active user gets this to feel familiar!
      team: 'Tim Distribusi',
      date: d1,
      activityType: 'Survei / Pencacahan',
      subActivity: 'Survei Harga Konsumen Mingguan',
      progress: 90,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-mas-1',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-mas-2',
      employeeName: 'Masna Novita Rahmaniar',
      email: 'rmasnanovita@gmail.com',
      team: 'Tim Distribusi',
      date: d2,
      activityType: 'Pengolahan Data',
      subActivity: 'Pencatatan Indeks Harga Perdagangan Besar',
      progress: 80,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-mas-2',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-mas-3',
      employeeName: 'Masna Novita Rahmaniar',
      email: 'rmasnanovita@gmail.com',
      team: 'Tim Distribusi',
      date: d3,
      activityType: 'Analisis & Diseminasi',
      subActivity: 'Diseminasi Rilis Inflasi Kota Bulanan',
      progress: 100,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-mas-3',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-mas-4',
      employeeName: 'Masna Novita Rahmaniar',
      email: 'rmasnanovita@gmail.com',
      team: 'Tim Distribusi',
      date: d4,
      activityType: 'Rapat / Koordinasi',
      subActivity: 'Rapat Persiapan Survei Wisatawan Nusantara',
      progress: 58, // Total progress will match 82% on 10 activities: let's add more
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-mas-4',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-mas-5',
      employeeName: 'Masna Novita Rahmaniar',
      email: 'rmasnanovita@gmail.com',
      team: 'Tim Distribusi',
      date: d4,
      activityType: 'Administrasi / Umum',
      subActivity: 'Penyusunan Berkas Pertanggungjawaban Keuangan',
      progress: 82,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-mas-5',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-mas-6',
      employeeName: 'Masna Novita Rahmaniar',
      email: 'rmasnanovita@gmail.com',
      team: 'Tim Distribusi',
      date: d4,
      activityType: 'Pelatihan / Pembinaan',
      subActivity: 'Pelatihan Instruktur Survei Wisnu',
      progress: 82,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-mas-6',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-mas-7',
      employeeName: 'Masna Novita Rahmaniar',
      email: 'rmasnanovita@gmail.com',
      team: 'Tim Distribusi',
      date: d1,
      activityType: 'Survei / Pencacahan',
      subActivity: 'Pencacahan Survei Perdagangan Eceran',
      progress: 82,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-mas-7',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-mas-8',
      employeeName: 'Masna Novita Rahmaniar',
      email: 'rmasnanovita@gmail.com',
      team: 'Tim Distribusi',
      date: d2,
      activityType: 'Pengolahan Data',
      subActivity: 'Validasi Hasil Entri Survei Komoditas',
      progress: 82,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-mas-8',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-mas-9',
      employeeName: 'Masna Novita Rahmaniar',
      email: 'rmasnanovita@gmail.com',
      team: 'Tim Distribusi',
      date: d3,
      activityType: 'Analisis & Diseminasi',
      subActivity: 'Penyusunan Laporan Bulanan Inflasi',
      progress: 82,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-mas-9',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-mas-10',
      employeeName: 'Masna Novita Rahmaniar',
      email: 'rmasnanovita@gmail.com',
      team: 'Tim Distribusi',
      date: d3,
      activityType: 'Analisis & Diseminasi',
      subActivity: 'Analisis Indeks Perdagangan Dalam Negeri',
      progress: 82, // Sum of 10 rows: 90+80+100+58+82+82+82+82+82+82 = 820. Average = 82%. Perfect!
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-mas-10',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },

    // Finda: Target 10 kegiatan. Total progress 700 (avg 70%) => Finda has 70%
    {
      id: 'demo-fin-1',
      employeeName: 'Finda Rosita',
      email: 'finda.rosita@example.com',
      team: 'Tim Neraca',
      date: d1,
      activityType: 'Survei / Pencacahan',
      subActivity: 'Penyusunan PDRB Kabupaten/Kota',
      progress: 70,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-fin-1',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-fin-2',
      employeeName: 'Finda Rosita',
      email: 'finda.rosita@example.com',
      team: 'Tim Neraca',
      date: d2,
      activityType: 'Pengolahan Data',
      subActivity: 'Tabulasi Sektor Jasa Keuangan',
      progress: 70,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-fin-2',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-fin-3',
      employeeName: 'Finda Rosita',
      email: 'finda.rosita@example.com',
      team: 'Tim Neraca',
      date: d3,
      activityType: 'Analisis & Diseminasi',
      subActivity: 'Analisis Laju Pertumbuhan Ekonomi',
      progress: 70,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-fin-3',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-fin-4',
      employeeName: 'Finda Rosita',
      email: 'finda.rosita@example.com',
      team: 'Tim Neraca',
      date: d4,
      activityType: 'Rapat / Koordinasi',
      subActivity: 'Focus Group Discussion Penyusunan PDRB',
      progress: 70,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-fin-4',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-fin-5',
      employeeName: 'Finda Rosita',
      email: 'finda.rosita@example.com',
      team: 'Tim Neraca',
      date: d1,
      activityType: 'Survei / Pencacahan',
      subActivity: 'Penyusunan PDRB Lapangan Usaha',
      progress: 70,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-fin-5',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-fin-6',
      employeeName: 'Finda Rosita',
      email: 'finda.rosita@example.com',
      team: 'Tim Neraca',
      date: d2,
      activityType: 'Pengolahan Data',
      subActivity: 'Kompilasi Data Sekunder Sektor Konstruksi',
      progress: 70,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-fin-6',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-fin-7',
      employeeName: 'Finda Rosita',
      email: 'finda.rosita@example.com',
      team: 'Tim Neraca',
      date: d3,
      activityType: 'Analisis & Diseminasi',
      subActivity: 'Analisis PDRB Pengeluaran',
      progress: 70,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-fin-7',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-fin-8',
      employeeName: 'Finda Rosita',
      email: 'finda.rosita@example.com',
      team: 'Tim Neraca',
      date: d4,
      activityType: 'Rapat / Koordinasi',
      subActivity: 'Koordinasi Data Sektor Pertanian',
      progress: 70,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-fin-8',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-fin-9',
      employeeName: 'Finda Rosita',
      email: 'finda.rosita@example.com',
      team: 'Tim Neraca',
      date: d1,
      activityType: 'Survei / Pencacahan',
      subActivity: 'Penyusunan PDRB Pengeluaran Kabupaten/Kota',
      progress: 70,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-fin-9',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-fin-10',
      employeeName: 'Finda Rosita',
      email: 'finda.rosita@example.com',
      team: 'Tim Neraca',
      date: d2,
      activityType: 'Pengolahan Data',
      subActivity: 'Tabulasi Sektor Transportasi',
      progress: 70, // 10 rows of 70% = 700%. Average progress = 70%. Target met!
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-fin-10',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },

    // Azka: Target 10 kegiatan. Total progress 480 (avg 48%) => Azka has 48%
    {
      id: 'demo-azk-1',
      employeeName: 'Azka Pratama',
      email: 'azka.pratama@example.com',
      team: 'Tim IPDS',
      date: d1,
      activityType: 'Survei / Pencacahan',
      subActivity: 'Pemeliharaan Jaringan LAN Kantor',
      progress: 50,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-azk-1',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-azk-2',
      employeeName: 'Azka Pratama',
      email: 'azka.pratama@example.com',
      team: 'Tim IPDS',
      date: d2,
      activityType: 'Pengolahan Data',
      subActivity: 'Updating Website BPS Kabupaten',
      progress: 40,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-azk-2',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-azk-3',
      employeeName: 'Azka Pratama',
      email: 'azka.pratama@example.com',
      team: 'Tim IPDS',
      date: d3,
      activityType: 'Analisis & Diseminasi',
      subActivity: 'Penyusunan Metadata Statistik Sektoral',
      progress: 60,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-azk-3',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-azk-4',
      employeeName: 'Azka Pratama',
      email: 'azka.pratama@example.com',
      team: 'Tim IPDS',
      date: d4,
      activityType: 'Rapat / Koordinasi',
      subActivity: 'Bimbingan Teknis Pengelolaan IT',
      progress: 42, // Average out to 48% with more rows
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-azk-4',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-azk-5',
      employeeName: 'Azka Pratama',
      email: 'azka.pratama@example.com',
      team: 'Tim IPDS',
      date: d1,
      activityType: 'Survei / Pencacahan',
      subActivity: 'Pengiriman Berkas Publikasi ke Pusat',
      progress: 48,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-azk-5',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-azk-6',
      employeeName: 'Azka Pratama',
      email: 'azka.pratama@example.com',
      team: 'Tim IPDS',
      date: d2,
      activityType: 'Pengolahan Data',
      subActivity: 'Backup Database Evaluasi Pembangunan',
      progress: 48,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-azk-6',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-azk-7',
      employeeName: 'Azka Pratama',
      email: 'azka.pratama@example.com',
      team: 'Tim IPDS',
      date: d3,
      activityType: 'Analisis & Diseminasi',
      subActivity: 'Pengolahan Data Rekomendasi Statistik',
      progress: 48,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-azk-7',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-azk-8',
      employeeName: 'Azka Pratama',
      email: 'azka.pratama@example.com',
      team: 'Tim IPDS',
      date: d4,
      activityType: 'Rapat / Koordinasi',
      subActivity: 'Rapat Koordinasi Evaluasi Keamanan Jaringan',
      progress: 48,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-azk-8',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-azk-9',
      employeeName: 'Azka Pratama',
      email: 'azka.pratama@example.com',
      team: 'Tim IPDS',
      date: d1,
      activityType: 'Survei / Pencacahan',
      subActivity: 'Survei Kebutuhan Data BPS',
      progress: 48,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-azk-9',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-azk-10',
      employeeName: 'Azka Pratama',
      email: 'azka.pratama@example.com',
      team: 'Tim IPDS',
      date: d2,
      activityType: 'Pengolahan Data',
      subActivity: 'Penyusunan Bahan Rapat Evaluasi',
      progress: 48, // 50+40+60+42+48+48+48+48+48+48 = 480%. Average = 48%
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'demo-f-azk-10',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  
  // Format as multiple rows to insert
  const values = demoActivities.map(act => [
    act.id,
    act.employeeName,
    act.email,
    act.team,
    act.date,
    act.activityType,
    act.subActivity,
    act.progress,
    act.driveLink,
    act.driveFileId,
    act.status,
    act.createdAt,
    act.updatedAt
  ]);
  
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}!A2:M${values.length + 1}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range: `${sheetTitle}!A2:M${values.length + 1}`,
      majorDimension: 'ROWS',
      values: values
    })
  });
}
