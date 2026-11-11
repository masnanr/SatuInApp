/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Activity } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, ArrowUp, ArrowDown, Trash2, Download, 
  CheckCircle, RefreshCw, Calendar, CheckSquare, Square, 
  FileJson, Terminal, Copy, Check, ExternalLink, X, Play, 
  BookOpen, FolderOpen, MousePointer, HelpCircle, Sparkles, ChevronRight,
  Monitor, Rocket, Info, AlertCircle, Laptop, FileDown,
  UploadCloud, Link as LinkIcon, FileArchive, ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface SubmitKipappProps {
  userEmail: string;
  allActivities: Activity[];
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
  isAdmin?: boolean;
}

interface KipappRow {
  id: string;
  tanggal: string;
  jenisKegiatan: string;
  subKegiatan: string;
  deskripsi: string;
  capaian: string;
  progress: number;
  linkLampiran: string;
  status: string;
}

const SUBMIT_KIPAPP_DOWNLOAD_URL = 'https://drive.google.com/file/d/1tYrm0_QIvCo5GGg_6uwjj8xA_J0ICRy1/view?usp=sharing';

export default function SubmitKipapp({ userEmail, allActivities, onNotify, isAdmin }: SubmitKipappProps) {
  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(
    String(new Date().getMonth() + 1).padStart(2, '0')
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    String(new Date().getFullYear())
  );

  // Desktop App State (.exe)
  const [appStatus, setAppStatus] = useState<{
    available: boolean;
    isExternal?: boolean;
    filename: string;
    size?: number;
    updatedAt?: string;
    driveLink?: string;
    downloadUrl?: string;
  } | null>(null);
  const [isCheckingApp, setIsCheckingApp] = useState(false);

  // Admin App Upload / Drive Link Modal States
  const [showAdminUploadModal, setShowAdminUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [customDriveLink, setCustomDriveLink] = useState('');
  const [isSavingDriveLink, setIsSavingDriveLink] = useState(false);

  // Selection states
  const [matchingActivities, setMatchingActivities] = useState<Activity[]>([]);
  const [selectedActIds, setSelectedActIds] = useState<string[]>([]);
  
  // Draft table states
  const [kipappDraftRows, setKipappDraftRows] = useState<KipappRow[]>([]);
  const [isDraftCreated, setIsDraftCreated] = useState(false);

  // Tutorial Modal & Copy States
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Check submitkipapp.exe status on mount
  const checkAppStatus = async () => {
    try {
      setIsCheckingApp(true);
      const res = await fetch('/api/app/check');
      if (res.ok) {
        const data = await res.json();
        setAppStatus(data);
      }
    } catch (e) {
      console.error('Failed to check app status:', e);
    } finally {
      setIsCheckingApp(false);
    }
  };

  useEffect(() => {
    checkAppStatus();
  }, []);

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleDownloadApp = () => {
    window.open(SUBMIT_KIPAPP_DOWNLOAD_URL, '_blank');
  };

  // Upload file in chunks to bypass 50MB AI Studio upload limits (supports up to 250MB+)
  const handleChunkedUpload = async () => {
    if (!uploadFile) {
      onNotify('Pilih file .exe atau .zip terlebih dahulu!', 'error');
      return;
    }
    try {
      setIsUploading(true);
      setUploadProgress(0);

      const chunkSize = 4 * 1024 * 1024; // 4MB per chunk
      const totalChunks = Math.ceil(uploadFile.size / chunkSize);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(uploadFile.size, start + chunkSize);
        const chunk = uploadFile.slice(start, end);

        const res = await fetch('/api/app/chunk-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'x-chunk-index': String(i),
            'x-total-chunks': String(totalChunks),
            'x-file-name': uploadFile.name
          },
          body: chunk
        });

        if (!res.ok) {
          throw new Error(`Gagal mengunggah potongan ${i + 1}/${totalChunks}`);
        }

        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      onNotify(`File "${uploadFile.name}" berhasil diunggah dan siap diunduh oleh pegawai!`, 'success');
      setShowAdminUploadModal(false);
      setUploadFile(null);
      setUploadProgress(0);
      checkAppStatus();
    } catch (err: any) {
      onNotify('Upload gagal: ' + err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Save Google Drive download link
  const handleSaveDriveLink = async () => {
    if (!customDriveLink.trim()) {
      onNotify('Masukkan link Google Drive yang valid!', 'error');
      return;
    }
    try {
      setIsSavingDriveLink(true);
      const res = await fetch('/api/app/set-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveLink: customDriveLink })
      });
      const data = await res.json();
      if (data.success) {
        onNotify('Link Google Drive berhasil disimpan! Tombol unduh pegawai kini terhubung ke file Drive Anda.', 'success');
        setShowAdminUploadModal(false);
        checkAppStatus();
      }
    } catch (err: any) {
      onNotify('Gagal menyimpan link: ' + err.message, 'error');
    } finally {
      setIsSavingDriveLink(false);
    }
  };

  // Load activities logged by this user for the selected month & year
  useEffect(() => {
    const myActivities = allActivities.filter(act => act.email.toLowerCase() === userEmail.toLowerCase());
    
    const filtered = myActivities.filter(act => {
      if (!act.date) return false;
      const [year, month] = act.date.split('-');
      return year === selectedYear && month === selectedMonth;
    });

    // Sort by date ascending
    filtered.sort((a, b) => a.date.localeCompare(b.date));
    
    setMatchingActivities(filtered);
    setSelectedActIds(filtered.map(f => f.id)); // Select all by default
    setIsDraftCreated(false);
    setKipappDraftRows([]);
  }, [selectedMonth, selectedYear, allActivities, userEmail]);

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedActIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedActIds.length === matchingActivities.length) {
      setSelectedActIds([]);
    } else {
      setSelectedActIds(matchingActivities.map(a => a.id));
    }
  };

  // Compile selected activities into a Draft rekap
  const handleCreateDraft = () => {
    const selectedActs = matchingActivities.filter(act => selectedActIds.includes(act.id));
    if (selectedActs.length === 0) {
      onNotify('Harap pilih minimal satu kegiatan untuk dibuatkan draft KIPAPP!', 'error');
      return;
    }

    const zeroRealisasi = selectedActs.find(act => (Number(act.realisasi) || 0) <= 0 || (Number(act.progress) || 0) <= 0);
    if (zeroRealisasi) {
      onNotify(`Kegiatan "${zeroRealisasi.subActivity}" memiliki realisasi/progres 0%! Realisasi harus lebih dari 0 untuk dikirim.`, 'error');
      return;
    }

    const draftRows: KipappRow[] = selectedActs.map(act => ({
      id: act.id,
      tanggal: act.date,
      jenisKegiatan: act.activityType || 'Kegiatan Kinerja',
      subKegiatan: act.subActivity,
      deskripsi: act.subActivity,
      capaian: act.capaian || `${act.subActivity} dilaksanakan dengan baik`,
      progress: act.progress,
      linkLampiran: act.driveLink || '',
      status: act.status
    }));

    setKipappDraftRows(draftRows);
    setIsDraftCreated(true);
    onNotify(`Berhasil membuat rekap ${draftRows.length} kegiatan! Silakan ulas tabel rekap di bawah.`, 'success');
  };

  // Edit fields in Draft Table
  const handleEditField = (index: number, field: keyof KipappRow, value: string) => {
    setKipappDraftRows(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: value
      };
      return copy;
    });
  };

  // Delete row in Draft
  const handleDeleteRow = (index: number) => {
    const confirmDel = window.confirm('Apakah Anda yakin ingin menghapus baris rekap ini dari draft KIPAPP?');
    if (!confirmDel) return;
    setKipappDraftRows(prev => prev.filter((_, i) => i !== index));
    onNotify('Baris dihapus dari draft.', 'info');
  };

  // Reordering (Up / Down)
  const handleMoveRow = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === kipappDraftRows.length - 1) return;

    setKipappDraftRows(prev => {
      const copy = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Export to Excel using SheetJS
  const handleDownloadExcel = () => {
    if (kipappDraftRows.length === 0) {
      onNotify('Tidak ada data rekap untuk didownload.', 'error');
      return;
    }

    try {
      const excelData = kipappDraftRows.map((row, idx) => ({
        'No': idx + 1,
        'Tanggal Kegiatan': row.tanggal,
        'Sub Kegiatan': row.subKegiatan,
        'Capaian': row.capaian,
        'Progress (%)': `${row.progress}%`,
        'Link Lampiran Google Drive': row.linkLampiran,
        'Status': row.status
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'KIPAPP Rekap');

      const wscols = [
        { wch: 5 },  // No
        { wch: 15 }, // Tanggal
        { wch: 35 }, // Sub Kegiatan
        { wch: 45 }, // Capaian
        { wch: 12 }, // Progress
        { wch: 35 }, // Link Drive
        { wch: 12 }  // Status
      ];
      worksheet['!cols'] = wscols;

      const filename = `REKAP_KIPAPP_${selectedYear}_${selectedMonth}_${userEmail.split('@')[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);
      onNotify(`File Excel "${filename}" berhasil dibuat dan didownload!`, 'success');
    } catch (error) {
      console.error(error);
      onNotify('Gagal mengekspor file Excel.', 'error');
    }
  };

  // Build standard JSON data array
  const buildCurrentJsonData = () => {
    const sourceRows = isDraftCreated && kipappDraftRows.length > 0 
      ? kipappDraftRows.map(row => {
          const orig = matchingActivities.find(a => a.id === row.id);
          return {
            rencana_kinerja: orig?.rencana_kinerja || orig?.performancePlanTitle || row.subKegiatan || 'Kegiatan Kinerja',
            tanggal: row.tanggal,
            gunakan_jam: true,
            jam_mulai: orig?.startTime || '08:00',
            jam_selesai: orig?.endTime || '16:00',
            kegiatan: row.subKegiatan,
            progres: 100,
            capaian: row.capaian || `${row.subKegiatan} dilaksanakan dengan baik`,
            data_dukung: row.linkLampiran || '',
            masuk_capaian_skp: true
          };
        })
      : matchingActivities
          .filter(a => selectedActIds.includes(a.id))
          .map(act => ({
            rencana_kinerja: act.rencana_kinerja || act.performancePlanTitle || act.subActivity || 'Kegiatan Kinerja',
            tanggal: act.date,
            gunakan_jam: true,
            jam_mulai: act.startTime || '08:00',
            jam_selesai: act.endTime || '16:00',
            kegiatan: act.subActivity,
            progres: 100,
            capaian: act.capaian || act.notes || `${act.subActivity} dilaksanakan dengan baik`,
            data_dukung: act.driveLink || '',
            masuk_capaian_skp: true
          }));

    return sourceRows;
  };

  // Export to JSON matching user schema
  const handleExportToJson = () => {
    const jsonData = buildCurrentJsonData();
    if (jsonData.length === 0) {
      onNotify('Tidak ada data kegiatan yang dipilih untuk diekspor ke JSON.', 'error');
      return;
    }

    try {
      const jsonString = JSON.stringify(jsonData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'kegiatan.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onNotify(`File "kegiatan.json" (${jsonData.length} kegiatan) berhasil didownload! Masukkan ke folder SatuInApp Anda.`, 'success');
    } catch (e: any) {
      onNotify('Gagal mengekspor JSON: ' + e.message, 'error');
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    onNotify(`Teks "${text}" berhasil disalin ke clipboard!`, 'success');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const MONTHS = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' }
  ];

  const YEARS = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 2 + i));

  return (
    <div className="max-w-7xl mx-auto space-y-8" id="submit-kipapp-view">
      
      {/* HEADER SECTION */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 font-display">Submit KIPAPP Bulanan</h1>
        <p className="text-sm text-slate-500">Pilih, urutkan, dan kemas kumpulan aktivitas harian Anda menjadi laporan bulanan KIPAPP atau jalankan ke aplikasi otomatisasi.</p>
      </div>

      {/* DESKTOP APP DOWNLOAD HIGHLIGHT BANNER */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden border border-indigo-800/40">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                <Rocket className="w-3.5 h-3.5 text-cyan-400" /> Baru: Desktop Automation
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-300">
                Windows (.exe)
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <CheckCircle className="w-3 h-3" /> Siap Diunduh via Google Drive
              </span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowAdminUploadModal(true)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer shadow-xs ml-auto sm:ml-0"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-slate-900" />
                  <span>Upload File / Link Drive (Admin)</span>
                </button>
              )}
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white">
                Download Aplikasi Submit KIPAPP
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                Jalankan otomatisasi pengisian SKP / KIPAPP bulanan langsung dari laptop Anda <strong>tanpa perlu instalasi Python ataupun buka Command Prompt (CMD)</strong>. Cukup unduh <strong>Aplikasi SubmitKIPAPP</strong>, lalu buka aplikasinya!
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full lg:w-auto">
            <a
              href={SUBMIT_KIPAPP_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-indigo-900/50 hover:shadow-indigo-800/60 transition-all duration-200 cursor-pointer active:scale-98"
            >
              <Download className="w-4 h-4 text-cyan-300" />
              <span>Unduh Aplikasi SubmitKIPAPP</span>
            </a>

            <button
              type="button"
              onClick={() => setShowTutorialModal(true)}
              className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl border border-white/10 transition-all cursor-pointer text-xs font-bold inline-flex items-center gap-2"
              title="Lihat Petunjuk Penggunaan"
            >
              <BookOpen className="w-4 h-4 text-indigo-300" />
              <span>Panduan</span>
            </button>
          </div>
        </div>
      </div>

      {/* SELECTION CARD */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2 text-slate-800 font-extrabold font-display mr-auto">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <span>Pilih Periode Laporan KIPAPP</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white w-1/2 sm:w-40 transition-all duration-200"
            >
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white w-1/2 sm:w-28 transition-all duration-200"
            >
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {matchingActivities.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            Tidak ditemukan aktivitas yang dicatat pada <strong className="text-slate-700 font-bold">{MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}</strong>.
            <br />Silakan catat kegiatan di menu <strong className="text-indigo-600 font-bold hover:underline cursor-pointer">Input Kegiatan</strong> terlebih dahulu.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>Ditemukan {matchingActivities.length} kegiatan. Pilih yang ingin dimasukkan ke laporan:</span>
              <button 
                onClick={handleSelectAll} 
                className="text-indigo-600 hover:text-indigo-700 hover:underline font-bold cursor-pointer"
              >
                {selectedActIds.length === matchingActivities.length ? 'Batalkan Semua' : 'Pilih Semua'}
              </button>
            </div>

            {/* SELECTION CHECKBOX LIST */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
              {matchingActivities.map((act) => {
                const isSelected = selectedActIds.includes(act.id);
                return (
                  <div
                    key={act.id}
                    onClick={() => handleToggleSelect(act.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950 shadow-xs' 
                        : 'bg-slate-50/40 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <button type="button" className="mt-0.5 flex-shrink-0 cursor-pointer">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-slate-400">{act.date}</span>
                        <span className="bg-white text-[9px] px-1.5 py-0.5 rounded text-slate-500 border border-slate-200 font-bold">{act.startTime || '08:00'} - {act.endTime || '16:00'}</span>
                      </div>
                      <p className="font-semibold line-clamp-2 text-slate-800">{act.subActivity}</p>
                      <p className="text-[10px] text-slate-400">Progres: {act.progress}% {act.driveLink ? '• (Ada Link Drive)' : ''}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleExportToJson}
                className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer"
              >
                <FileJson className="w-4 h-4 text-emerald-300" /> Download kegiatan.json ({selectedActIds.length} Terpilih)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DRAFT REKAP TABLE */}
      {isDraftCreated && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 space-y-6 shadow-lg"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800 font-display flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" /> Draft Rekap KIPAPP ({kipappDraftRows.length} baris)
              </h2>
              <p className="text-xs text-slate-500 mt-1">Anda masih dapat menghapus baris, mengedit urutan, mengedit deskripsi laporan, serta jumlah capaian.</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportToJson}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
              >
                <FileJson className="w-4 h-4 text-emerald-400" /> Download kegiatan.json
              </button>

              <button
                type="button"
                onClick={handleDownloadExcel}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-100 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download Excel
              </button>
            </div>
          </div>

          {kipappDraftRows.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              Seluruh baris telah dihapus dari draft. Silakan buat draft kembali.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-3 w-12 text-center">Urutan</th>
                    <th className="px-3 py-3">Tanggal</th>
                    <th className="px-3 py-3">Uraian Kegiatan</th>
                    <th className="px-3 py-3">Capaian Kegiatan</th>
                    <th className="px-3 py-3 text-center">Progres</th>
                    <th className="px-3 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kipappDraftRows.map((row, index) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleMoveRow(index, 'up')}
                            disabled={index === 0}
                            className="p-0.5 hover:text-indigo-600 text-slate-400 disabled:opacity-30 disabled:hover:text-inherit cursor-pointer"
                            title="Pindah ke Atas"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-mono font-extrabold text-slate-400">{index + 1}</span>
                          <button
                            onClick={() => handleMoveRow(index, 'down')}
                            disabled={index === kipappDraftRows.length - 1}
                            className="p-0.5 hover:text-indigo-600 text-slate-400 disabled:opacity-30 disabled:hover:text-inherit cursor-pointer"
                            title="Pindah ke Bawah"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-xs font-mono text-slate-500 font-bold">{row.tanggal}</td>
                      <td className="px-3 py-3.5">
                        <textarea
                          value={row.subKegiatan}
                          rows={2}
                          onChange={(e) => handleEditField(index, 'subKegiatan', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none transition-all duration-200"
                          placeholder="Uraian kegiatan..."
                        />
                      </td>
                      <td className="px-3 py-3.5">
                        <input
                          type="text"
                          value={row.capaian}
                          onChange={(e) => handleEditField(index, 'capaian', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-left font-medium transition-all duration-200"
                          placeholder="e.g. Telah dilaksanakan sesuai rencana."
                        />
                      </td>
                      <td className="px-3 py-3.5 text-center font-mono text-xs font-extrabold text-green-600">{row.progress}%</td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteRow(index)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* TUTORIAL UPLOAD OTOMATIS (PYTHON) MODAL */}
      <AnimatePresence>
        {showTutorialModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 space-y-6 max-h-[92vh] overflow-y-auto"
            >
              {/* MODAL HEADER */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                    <Rocket className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 font-display">
                      Panduan Otomatisasi Submit KIPAPP (.exe)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Petunjuk pengisian otomatis laporan harian SKP / KIPAPP menggunakan aplikasi desktop.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTutorialModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* QUICK DOWNLOAD NOTICE */}
              <div className="p-4 bg-emerald-50 border border-emerald-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-950">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Aplikasi Desktop Siap Digunakan</span>
                    <p className="text-[11px] text-emerald-800">
                      Unduh dan jalankan Aplikasi SubmitKIPAPP di komputer/laptop Windows Anda.
                    </p>
                  </div>
                </div>
                <a
                  href={SUBMIT_KIPAPP_DOWNLOAD_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0"
                >
                  <Download className="w-4 h-4 text-cyan-400" /> Unduh Aplikasi SubmitKIPAPP
                </a>
              </div>

              {/* STEP BY STEP TUTORIAL CONTENT */}
              <div className="space-y-5 text-xs text-slate-700">
                {/* TAHAP 1 */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center font-display shadow-xs flex-shrink-0">
                      1
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-900 font-display">
                      Download Aplikasi SubmitKIPAPP
                    </h4>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-xs pl-8">
                    Unduh file <strong>Aplikasi SubmitKIPAPP</strong> melalui tombol di atas atau tombol di banner utama, lalu simpan di folder laptop/komputer Anda (misalnya di folder <code className="bg-slate-200/70 px-1.5 py-0.5 rounded font-mono text-slate-800">Downloads</code> atau folder kerja Anda).
                  </p>
                  <div className="pl-8 pt-1">
                    <a
                      href={SUBMIT_KIPAPP_DOWNLOAD_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" /> Unduh Aplikasi SubmitKIPAPP
                    </a>
                  </div>
                </div>

                {/* TAHAP 2 */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center font-display shadow-xs flex-shrink-0">
                      2
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-900 font-display">
                      Buka Browser &amp; Tampilkan Form "Add Capaian Kegiatan Perhari"
                    </h4>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-xs pl-8">
                    Buka browser dan login ke akun SKP / KIPAPP Anda. Masuk ke halaman kegiatan bulanan, lalu klik tombol tambah hingga <strong>form pop-up "Add Capaian Kegiatan Perhari" terbuka</strong> seperti gambar berikut:
                  </p>
                  <div className="pl-8 pt-1">
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                      <img 
                        src="/assets/aistudio/image_89d8f2fa.png" 
                        alt="Tampilan Add Capaian Kegiatan Perhari di portal" 
                        className="w-full max-h-64 object-contain bg-slate-50"
                      />
                    </div>
                    <p className="text-[11px] text-amber-800 font-semibold bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2">
                      ⚠️ <strong>Penting:</strong> Jangan isi form secara manual. Biarkan form pop-up ini tetap terbuka di browser Anda!
                    </p>
                  </div>
                </div>

                {/* TAHAP 3 */}
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center font-display shadow-xs flex-shrink-0">
                      3
                    </span>
                    <h4 className="font-extrabold text-sm text-emerald-950 font-display">
                      Klik 2x Aplikasi SubmitKIPAPP &amp; Tekan ENTER di Aplikasinya!
                    </h4>
                  </div>
                  <div className="pl-8 space-y-2">
                    <p className="text-emerald-900 leading-relaxed text-xs">
                      Buka file <strong>Aplikasi SubmitKIPAPP</strong> (klik ganda). Jendela aplikasi akan terbuka. Cukup tekan tombol <strong>ENTER</strong> pada keyboard Anda.
                    </p>
                    <div className="p-3 bg-white rounded-xl border border-emerald-200 text-xs text-emerald-900 font-medium space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-700">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        <span>Otomatisasi Berjalan Mandiri:</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Aplikasi akan secara otomatis mengisi tanggal, uraian sub kegiatan, progres (100%), capaian, dan link data dukung ke form browser satu per satu sampai semua kegiatan tersimpan tuntas!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <a
                  href={SUBMIT_KIPAPP_DOWNLOAD_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4 text-cyan-300" /> Unduh Aplikasi SubmitKIPAPP
                </a>

                <button
                  type="button"
                  onClick={() => setShowTutorialModal(false)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Tutup Panduan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADMIN UPLOAD & DRIVE LINK MODAL */}
      <AnimatePresence>
        {showAdminUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 space-y-6 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 font-display">
                      Kelola File Aplikasi KIPAPP
                    </h3>
                    <p className="text-xs text-slate-500">
                      Bypass limit 50MB AI Studio via Chunk Upload atau tautkan Google Drive.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdminUploadModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* METHOD 1: CHUNKED DIRECT UPLOAD */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">1</span>
                  <h4 className="font-bold text-sm text-slate-900 font-display">
                    Upload File Langsung (.exe atau .zip)
                  </h4>
                </div>
                <p className="text-xs text-slate-600">
                  Dukungan upload bertahap (chunking) hingga <strong>250 MB</strong>. Jika mengunggah file <code>.zip</code>, server akan otomatis mengekstrak file <code>.exe</code> di dalamnya.
                </p>

                <div className="space-y-3">
                  <input
                    type="file"
                    accept=".exe,.zip"
                    disabled={isUploading}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadFile(e.target.files[0]);
                      }
                    }}
                    className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer bg-white p-2 rounded-xl border border-slate-200"
                  />

                  {uploadFile && (
                    <div className="text-xs text-slate-600 flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 font-mono">
                      <span className="truncate">{uploadFile.name}</span>
                      <span className="font-bold text-indigo-600 flex-shrink-0 ml-2">
                        {formatBytes(uploadFile.size)}
                      </span>
                    </div>
                  )}

                  {isUploading && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-bold text-slate-700">
                        <span>Mengunggah ke server...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-2 transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!uploadFile || isUploading}
                    onClick={handleChunkedUpload}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{isUploading ? `Mengunggah (${uploadProgress}%)...` : 'Mulai Upload File'}</span>
                  </button>
                </div>
              </div>

              {/* METHOD 2: GOOGLE DRIVE LINK */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">2</span>
                  <h4 className="font-bold text-sm text-slate-900 font-display">
                    Atau Tautkan Link Google Drive (Bebas Batas Ukuran)
                  </h4>
                </div>
                <p className="text-xs text-slate-600">
                  Jika file sudah Anda upload ke Google Drive, masukkan tautan share di bawah ini. Tombol download pegawai akan langsung mengarah ke file tersebut.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2">
                    <LinkIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <input
                      type="url"
                      value={customDriveLink}
                      onChange={(e) => setCustomDriveLink(e.target.value)}
                      placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                      className="w-full text-xs text-slate-800 focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isSavingDriveLink}
                    onClick={handleSaveDriveLink}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSavingDriveLink ? 'Menyimpan Link...' : 'Simpan Link Google Drive'}</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdminUploadModal(false)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
