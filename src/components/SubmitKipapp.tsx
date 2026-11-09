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
  BookOpen, FolderOpen, MousePointer, HelpCircle, Sparkles, ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface SubmitKipappProps {
  userEmail: string;
  allActivities: Activity[];
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
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

export default function SubmitKipapp({ userEmail, allActivities, onNotify }: SubmitKipappProps) {
  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(
    String(new Date().getMonth() + 1).padStart(2, '0')
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    String(new Date().getFullYear())
  );

  // Selection states
  const [matchingActivities, setMatchingActivities] = useState<Activity[]>([]);
  const [selectedActIds, setSelectedActIds] = useState<string[]>([]);
  
  // Draft table states
  const [kipappDraftRows, setKipappDraftRows] = useState<KipappRow[]>([]);
  const [isDraftCreated, setIsDraftCreated] = useState(false);

  // Tutorial Modal & Copy States
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
      capaian: act.capaian || `${act.subActivity} dilaksanakan dengan baik.`,
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
            capaian: row.capaian || `${row.subKegiatan} dilaksanakan dengan baik.`,
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
            capaian: act.capaian || act.notes || `${act.subActivity} dilaksanakan dengan baik.`,
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
        <p className="text-sm text-slate-500">Pilih, urutkan, dan kemas kumpulan aktivitas harian Anda menjadi laporan bulanan KIPAPP atau jalankan ke aplikasi Python.</p>
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
                onClick={() => setShowTutorialModal(true)}
                className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-indigo-600" /> Tutorial Upload Otomatis (Python)
              </button>

              <button
                type="button"
                onClick={handleExportToJson}
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer"
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
                onClick={() => setShowTutorialModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-indigo-600" /> Tutorial Upload
              </button>

              <button
                type="button"
                onClick={handleExportToJson}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
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
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 font-display">
                      Tutorial Upload Otomatis ke KIPAPP
                    </h3>
                    <p className="text-xs text-slate-500">
                      Panduan menjalankan skrip Python (<code className="font-mono text-indigo-600 font-bold">main.py</code>) untuk upload otomatis tanpa input manual.
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
                    <span className="font-bold">File kegiatan.json sudah siap diekspor!</span>
                    <p className="text-[11px] text-emerald-800">
                      Simpan file ini ke dalam folder aplikasi Python <strong>SatuInApp</strong> Anda.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExportToJson}
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0"
                >
                  <Download className="w-4 h-4" /> Download kegiatan.json
                </button>
              </div>

              {/* STEP BY STEP TUTORIAL */}
              <div className="space-y-6 text-xs text-slate-700">

                {/* TAHAP 1 */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center font-display shadow-xs flex-shrink-0">
                      1
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-900 font-display">
                      Buka Folder Aplikasi SatuInApp &amp; Masukkan File kegiatan.json
                    </h4>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-xs pl-8">
                    Buka folder tempat aplikasi Python <strong>SatuInApp</strong> disimpan di komputer/laptop Anda (misalnya di folder <code className="bg-slate-200/70 px-1.5 py-0.5 rounded font-mono text-slate-800">Downloads \ SatuInApp</code>). Pastikan file <strong>kegiatan.json</strong> diletakkan berdampingan dengan file <strong>main.py</strong> seperti pada foto berikut:
                  </p>
                  <div className="pl-8 pt-1">
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                      <img 
                        src="/assets/aistudio/image_67137071.png" 
                        alt="Folder SatuInApp berisi main.py dan kegiatan.json" 
                        className="w-full max-h-56 object-contain bg-slate-100"
                      />
                    </div>
                  </div>
                </div>

                {/* TAHAP 2 */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center font-display shadow-xs flex-shrink-0">
                      2
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-900 font-display">
                      Klik Bagian Atas File Explorer &amp; Tekan Copy Alamat Path
                    </h4>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-xs pl-8">
                    Pada jendela File Explorer di folder tersebut, <strong>klik bagian atas (address bar)</strong> sampai seluruh alamat direktori terpilih, lalu klik kanan dan tekan <strong>Copy</strong> (atau tekan tombol <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-300 font-mono">Ctrl + C</kbd> di keyboard):
                  </p>
                  <div className="pl-8 pt-1">
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                      <img 
                        src="/assets/aistudio/image_248ec117.png" 
                        alt="Klik address bar di bagian atas dan copy" 
                        className="w-full max-h-36 object-contain bg-slate-100"
                      />
                    </div>
                  </div>
                </div>

                {/* TAHAP 3 */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center font-display shadow-xs flex-shrink-0">
                      3
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-900 font-display">
                      Buka Command Prompt (CMD) &amp; Masukkan Perintah cd
                    </h4>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-xs pl-8">
                    Buka <strong>Command Prompt</strong> (tekan tombol <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-300 font-mono">Win + R</kbd>, ketik <strong className="text-indigo-600">cmd</strong>, lalu tekan Enter). Ketik <code className="bg-slate-200/70 px-1.5 py-0.5 rounded font-mono font-bold text-slate-800">cd </code> (dengan spasi) lalu paste alamat hasil copy dari Tahap 2:
                  </p>
                  <div className="pl-8 pt-1 space-y-2">
                    <div className="flex items-center justify-between gap-3 bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-xs">
                      <span className="truncate">cd C:\Users\DELL\Downloads\SatuInApp</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('cd C:\\Users\\DELL\\Downloads\\SatuInApp', 'cd')}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[11px] font-sans font-bold flex items-center gap-1 cursor-pointer transition-colors flex-shrink-0"
                      >
                        {copiedKey === 'cd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'cd' ? 'Tersalin!' : 'Salin Contoh'}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      *Sesuaikan <code className="font-mono">C:\Users\DELL\...</code> dengan alamat folder di laptop Anda sendiri. Lalu tekan <strong>Enter</strong>.
                    </p>
                  </div>
                </div>

                {/* TAHAP 4 */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center font-display shadow-xs flex-shrink-0">
                      4
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-900 font-display">
                      Jalankan Skrip Python (python main.py)
                    </h4>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-xs pl-8">
                    Di Command Prompt yang sama, ketik perintah berikut lalu tekan <strong>Enter</strong>:
                  </p>
                  <div className="pl-8 pt-1">
                    <div className="flex items-center justify-between gap-3 bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-xs">
                      <span>python main.py</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('python main.py', 'python')}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[11px] font-sans font-bold flex items-center gap-1 cursor-pointer transition-colors flex-shrink-0"
                      >
                        {copiedKey === 'python' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'python' ? 'Tersalin!' : 'Salin Perintah'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* TAHAP 5 */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center font-display shadow-xs flex-shrink-0">
                      5
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-900 font-display">
                      Login ke Portal &amp; Buka Tampilan "Add Capaian Kegiatan Perhari"
                    </h4>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-xs pl-8">
                    Jendela browser akan terbuka. Lakukan login ke akun SKP Anda dan navigasikan hingga <strong>pop-up form "Add Capaian Kegiatan Perhari" terbuka persis seperti foto di bawah ini</strong>:
                  </p>
                  <div className="pl-8 pt-1">
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                      <img 
                        src="/assets/aistudio/image_89d8f2fa.png" 
                        alt="Tampilan Add Capaian Kegiatan Perhari di portal" 
                        className="w-full max-h-72 object-contain bg-slate-50"
                      />
                    </div>
                    <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2">
                      ⚠️ <strong>Penting:</strong> Jangan isi form secara manual. Biarkan form pop-up ini tetap terbuka di browser Anda!
                    </p>
                  </div>
                </div>

                {/* TAHAP 6 */}
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center font-display shadow-xs flex-shrink-0">
                      6
                    </span>
                    <h4 className="font-extrabold text-sm text-emerald-950 font-display">
                      Tekan ENTER di Command Prompt &amp; Skrip Akan Jalan Sendiri!
                    </h4>
                  </div>
                  <div className="pl-8 space-y-2">
                    <p className="text-emerald-900 leading-relaxed text-xs">
                      Saat tampilan pop-up pada Foto 3 di atas sudah terbuka di browser, <strong>kembalilah ke jendela Command Prompt, lalu cukup tekan tombol ENTER</strong>.
                    </p>
                    <div className="p-3 bg-white rounded-xl border border-emerald-200 text-xs text-emerald-900 font-medium">
                      🎉 <strong>Otomatis Jalan Sendiri:</strong> Skrip Python akan secara otomatis mengisi tanggal, rincian kegiatan, progres, capaian, dan link data dukung dari file <strong>kegiatan.json</strong> satu per satu hingga semua kegiatan berhasil tersimpan!
                    </div>
                  </div>
                </div>

              </div>

              {/* MODAL FOOTER */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleExportToJson}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" /> Download kegiatan.json
                </button>
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

    </div>
  );
}
