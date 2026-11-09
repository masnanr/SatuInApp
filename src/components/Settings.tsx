/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppSettings, UserAccount } from '../types';
import { Save, Mail, Target, HelpCircle, HardDrive } from 'lucide-react';
import { updateUser } from '../lib/serverApi';

interface SettingsProps {
  token: string;
  settings: AppSettings;
  currentUserAccount: UserAccount | null;
  onSaveSettings: (settings: AppSettings) => void;
  onUpdateUserAccount: (updatedAccount: UserAccount) => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function Settings({ 
  token, 
  settings, 
  currentUserAccount, 
  onSaveSettings, 
  onUpdateUserAccount, 
  onNotify 
}: SettingsProps) {
  const [adminEmail, setAdminEmail] = useState(settings.adminEmail);
  const [headOfTeamEmail, setHeadOfTeamEmail] = useState(settings.headOfTeamEmail);
  const [headOfOfficeEmail, setHeadOfOfficeEmail] = useState(settings.headOfOfficeEmail);
  const [monthlyTarget, setMonthlyTarget] = useState(settings.monthlyTarget);
  const [driveSkripsiLink, setDriveSkripsiLink] = useState(currentUserAccount?.driveSkripsiLink || '');

  const isAdmin = currentUserAccount?.role === 'admin';

  const handleSave = async () => {
    if (isAdmin) {
      onSaveSettings({
        spreadsheetId: settings.spreadsheetId,
        adminEmail: adminEmail.trim(),
        headOfTeamEmail: headOfTeamEmail.trim(),
        headOfOfficeEmail: headOfOfficeEmail.trim(),
        monthlyTarget: Number(monthlyTarget) || 10
      });
    }

    if (currentUserAccount) {
      try {
        const res = await updateUser(
          currentUserAccount.id,
          { driveSkripsiLink: driveSkripsiLink.trim() },
          currentUserAccount.email,
          currentUserAccount.name
        );
        if (res.success && res.user) {
          onUpdateUserAccount(res.user);
        }
      } catch (err) {
        console.error('Failed to update user drive link:', err);
      }
    }

    onNotify('Pengaturan dan Link Google Drive berhasil disimpan!', 'success');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" id="settings-view">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            {isAdmin ? 'Pengaturan Sistem & Link Google Drive' : 'Link Google Drive Pribadi'}
          </h1>
          <p className="text-sm text-slate-500">
            {isAdmin 
              ? 'Konfigurasi email pembagian akses, target bulanan, dan link Google Drive Anda.'
              : 'Masukkan dan perbarui link folder Google Drive pribadi Anda untuk tempat penyimpanan PDF hasil kerja atau laporan kegiatan.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Personal Google Drive Link Card (Visible to all users) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4 shadow-xs">
            <h2 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-indigo-600" /> Link Google Drive
            </h2>
            <p className="text-xs text-slate-500">
              Masukkan link folder Google Drive pribadi Anda (contoh: <code>https://drive.google.com/drive/folders/1gJRFpUsLsk5bwb6DQ0GtqbfGxQQoqCY9?usp=sharing</code>). Link ini tersimpan di database server dan digunakan untuk menaruh file PDF hasil kerja/laporan Anda.
            </p>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">URL Folder Google Drive</label>
              <input
                type="url"
                value={driveSkripsiLink}
                onChange={(e) => setDriveSkripsiLink(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-mono transition-all duration-200"
              />
            </div>
          </div>

          {isAdmin && (
            <>
              {/* Email Permissions Sharing Config Card (Admin Only) */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4 shadow-xs">
                <h2 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
                  <Mail className="w-5 h-5 text-indigo-600" /> Alamat Email Penerima Share File
                </h2>
                <p className="text-xs text-slate-500">
                  Setiap kali Anda mengunggah laporan ke Drive Anda, sistem akan secara otomatis memberikan hak akses <strong>Viewer (Hanya Melihat)</strong> ke alamat email yang diatur di bawah ini secara real-time.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Email Administrator</label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@kipapp-office.com"
                      className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all duration-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Email Kepala Tim</label>
                    <input
                      type="email"
                      value={headOfTeamEmail}
                      onChange={(e) => setHeadOfTeamEmail(e.target.value)}
                      placeholder="kepalateam@kipapp-office.com"
                      className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all duration-200"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700">Email Kepala Kantor (Opsional)</label>
                    <input
                      type="email"
                      value={headOfOfficeEmail}
                      onChange={(e) => setHeadOfOfficeEmail(e.target.value)}
                      placeholder="kepalakantor@kipapp-office.com"
                      className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all duration-200"
                    />
                  </div>
                </div>
              </div>

              {/* Monthly Target Config (Admin Only) */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4 shadow-xs">
                <h2 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
                  <Target className="w-5 h-5 text-rose-500" /> Target Jumlah Kegiatan Pegawai
                </h2>
                <p className="text-xs text-slate-500">
                  Diperlukan untuk menghitung persentase capaian target bulanan pegawai pada Dashboard Monitoring Kepala Kantor.
                </p>

                <div className="max-w-xs space-y-2">
                  <label className="block text-sm font-bold text-slate-700">Target Kegiatan Bulanan</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={monthlyTarget}
                      onChange={(e) => setMonthlyTarget(Number(e.target.value))}
                      className="block w-24 rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-center font-extrabold"
                    />
                    <span className="text-sm text-slate-500 font-semibold">kegiatan / bulan</span>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              <Save className="w-4 h-4" /> Simpan Pengaturan
            </button>
          </div>
        </div>

        {/* Info Guide Card Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-50/75 border border-slate-100 p-6 rounded-3xl space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-indigo-600" /> Panduan Link Google Drive
            </h3>
            <ul className="space-y-3 text-xs text-slate-600 leading-relaxed font-medium">
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0" />
                <span><strong>Folder Pribadi:</strong> Masukkan link folder Google Drive Anda di atas agar tersimpan di database server.</span>
              </li>
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0" />
                <span><strong>Penyimpanan PDF:</strong> Gunakan folder Google Drive ini untuk menaruh dokumen hasil PDF laporan kegiatan Anda.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
