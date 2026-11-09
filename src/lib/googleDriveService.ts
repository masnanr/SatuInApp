/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const DEFAULT_ROOT_DRIVE_FOLDER_ID = '14ir5SrJ2zzac4mnCWzrdPbqkkr8_9AAM';
export const DEFAULT_ROOT_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${DEFAULT_ROOT_DRIVE_FOLDER_ID}`;

/**
 * Ensures that an employee folder named after `employeeName` exists inside the master Google Drive folder (ID: 14ir5SrJ2zzac4mnCWzrdPbqkkr8_9AAM).
 * If it doesn't exist, creates the subfolder.
 * Returns the folder's webViewLink or direct URL: `https://drive.google.com/drive/folders/{folderId}`.
 */
export async function ensureEmployeeDriveFolder(
  token: string,
  employeeName: string,
  parentFolderId: string = DEFAULT_ROOT_DRIVE_FOLDER_ID
): Promise<{ id: string; url: string; created: boolean } | null> {
  if (!token || !employeeName.trim()) return null;

  const folderName = employeeName.trim();

  try {
    // 1. Search if folder already exists in the target parent folder
    const q = encodeURIComponent(`'${parentFolderId}' in parents and name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink)&pageSize=1`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const folder = searchData.files[0];
        return {
          id: folder.id,
          url: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`,
          created: false
        };
      }
    }

    // 2. Folder does not exist, create it inside root parent folder 14ir5SrJ2zzac4mnCWzrdPbqkkr8_9AAM
    const createUrl = 'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink';
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      })
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error(`Failed to create Google Drive folder for "${folderName}":`, errText);
      return null;
    }

    const createdFolder = await createRes.json();
    return {
      id: createdFolder.id,
      url: createdFolder.webViewLink || `https://drive.google.com/drive/folders/${createdFolder.id}`,
      created: true
    };
  } catch (error) {
    console.error(`ensureEmployeeDriveFolder error for "${folderName}":`, error);
    return null;
  }
}

/**
 * Bulk syncs employee Google Drive folders for a list of users
 */
export async function syncAllEmployeeDriveFolders(
  token: string,
  employeeNames: string[],
  parentFolderId: string = DEFAULT_ROOT_DRIVE_FOLDER_ID
): Promise<{ total: number; syncedCount: number; links: Record<string, string> }> {
  const result: Record<string, string> = {};
  if (!token || !employeeNames || employeeNames.length === 0) {
    return { total: 0, syncedCount: 0, links: result };
  }

  let count = 0;
  for (const name of employeeNames) {
    if (!name) continue;
    const res = await ensureEmployeeDriveFolder(token, name, parentFolderId);
    if (res && res.url) {
      result[name.trim()] = res.url;
      count++;
    }
  }

  return { total: employeeNames.length, syncedCount: count, links: result };
}
