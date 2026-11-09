/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Activity, AppSettings, Team, PerformancePlan, UserAccount } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, File, Trash2, Edit2, Check, 
  HardDrive, ShieldAlert, CheckCircle, X, Target, Database, 
  ExternalLink, Download, Copy, FileSpreadsheet, User, Crown
} from 'lucide-react';
import { createServerActivity, updateServerActivity, deleteServerActivity } from '../lib/serverApi';
import { syncActivityToGoogleSheets } from '../lib/googleSheetsService';
import { getAccessToken } from '../lib/firebase';
import jsPDF from 'jspdf';
import ImportExcelModal from './ImportExcelModal';

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const formatIndonesianDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parts[0];
    const mIdx = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const monthName = MONTH_NAMES_ID[mIdx];
    if (monthName) {
      return `${d} ${monthName} ${y}`;
    }
  }
  return dateStr;
};

interface ActivityLogProps {
  token: string;
  userEmail: string;
  userName: string;
  userTeam?: string;
  currentUserAccount?: UserAccount | null;
  settings: AppSettings;
  teams: Team[];
  performancePlans: PerformancePlan[];
  onRefreshData: () => Promise<void>;
  allActivities: Activity[];
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function ActivityLog({ 
  token, 
  userEmail, 
  userName, 
  userTeam,
  currentUserAccount,
  settings, 
  teams,
  performancePlans,
  onRefreshData, 
  allActivities, 
  onNotify 
}: ActivityLogProps) {
  
  // Form States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState(userName || '');
  const [selectedTeam, setSelectedTeam] = useState(userTeam || teams[0]?.name || 'Tim Statistik Sosial');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().substring(0, 10));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [subActivity, setSubActivity] = useState('');
  const [rkRoleType, setRkRoleType] = useState<'Anggota' | 'Ketua'>('Anggota');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [realisasi, setRealisasi] = useState<number>(0);
  const [capaian, setCapaian] = useState('');
  const [progress, setProgress] = useState(100);
  const [notes, setNotes] = useState('');
  const DEFAULT_DRIVE_FOLDER = 'https://drive.google.com/drive/folders/14ir5SrJ2zzac4mnCWzrdPbqkkr8_9AAM?usp=sharing';
  const [driveLink, setDriveLink] = useState('');
  const [isDriveUploaded, setIsDriveUploaded] = useState(false);
  
  // File Upload State
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Table state
  const [isSaving, setIsSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Draft' | 'Submitted'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Confirmation modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'delete' | 'save'; activity?: Activity }>({ type: 'save' });

  // Excel Import modal state
  const [showImportExcel, setShowImportExcel] = useState(false);

  // Get current selected year from activityDate
  const currentYear = new Date(activityDate).getFullYear() || new Date().getFullYear();

  // Plans available for current year (displayed without team prefix)
  const availablePlans = performancePlans.filter(p => p.year === currentYear);

  // Auto-select initial plan if not set so default Anggota results appear immediately
  useEffect(() => {
    if (!selectedPlanId && availablePlans.length > 0 && !editingId) {
      const matchingPlan = availablePlans.find(p => p.team === selectedTeam) || availablePlans[0];
      if (matchingPlan) {
        setSelectedPlanId(matchingPlan.id);
      }
    }
  }, [availablePlans, selectedTeam, selectedPlanId, editingId]);

  // Filter activities logged by this user only
  const myActivities = allActivities.filter(act => act.email.toLowerCase() === userEmail.toLowerCase());

  // Auto-sync capaian when subActivity changes if capaian is empty or matched previous subActivity
  const handleSubActivityChange = (val: string) => {
    setSubActivity(val);
    if (!capaian || capaian.includes('telah dilaksanakan sesuai dengan rencana.') || capaian.includes('telah dilaksanakan dengan baik.') || capaian.includes('dilaksanakan dengan baik.')) {
      setCapaian(val.trim() ? `${val.trim()} dilaksanakan dengan baik.` : '');
    }
  };

  // Reset form helper
  const resetForm = () => {
    setEditingId(null);
    setRkRoleType('Anggota');
    setSubActivity('');
    const defaultPlan = availablePlans.find(p => p.team === selectedTeam) || availablePlans[0];
    setSelectedPlanId(defaultPlan ? defaultPlan.id : '');
    setRealisasi(0);
    setCapaian('');
    setProgress(100);
    setNotes('');
    setStartTime('08:00');
    setEndTime('16:00');
    setDriveLink('');
    setIsDriveUploaded(false);
    setUploadedFileName('');
    setUploadedImageBase64('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Helper to load image dimensions
  const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
      };
      img.onerror = () => {
        resolve({ width: 400, height: 300 });
      };
      img.src = base64;
    });
  };

  // Handle local PDF generation & download
  const handleDownloadPDF = async () => {
    if (!subActivity.trim()) {
      onNotify('Harap isi Rincian / Sub Kegiatan terlebih dahulu sebelum mendownload PDF.', 'error');
      return;
    }

    try {
      // Clean, readable filename format
      const cleanEmpName = (employeeName || userName || 'Pegawai').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const cleanSubAct = subActivity.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const pdfFilename = `Laporan_KIPAPP_${cleanEmpName}_${cleanSubAct}_${activityDate}.pdf`;

      const matchedPlan = performancePlans.find(p => p.id === selectedPlanId);

      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210;
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2); // 180mm

      // HEADER TITLE
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.text("LAPORAN KEGIATAN HARIAN PEGAWAI", pageWidth / 2, 20, { align: "center" });

      // Header separator line
      doc.setDrawColor(203, 213, 225); // Slate-300
      doc.setLineWidth(0.75);
      doc.line(margin, 25, margin + contentWidth, 25);

      let yPos = 32;
      const formattedDate = formatIndonesianDate(activityDate);

      const details: [string, string][] = [
        ["Nama Pegawai", employeeName || userName || 'Pegawai'],
        ["Tim Kerja", selectedTeam],
        ["Tanggal Kegiatan", formattedDate],
        ["Waktu Pelaksanaan", `${startTime} - ${endTime} WIB`],
        ["Rencana Kinerja", matchedPlan ? (matchedPlan.rencanaKinerjaAnggota || matchedPlan.indicator) : '-'],
        ["Kegiatan / Sub Kegiatan", subActivity],
        ["Capaian", capaian || `${subActivity} dilaksanakan dengan baik.`],
        ["Progres Kinerja", `${progress}%`]
      ];

      const labelX = margin + 4;
      const colonX = margin + 54;
      const valX = margin + 58;
      const valWidth = contentWidth - 62; // ~118mm

      details.forEach(([label, val], idx) => {
        // Calculate dynamic height based on 12pt font line wraps
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        const valLines = doc.splitTextToSize(val || '-', valWidth);
        const lineCount = valLines.length;
        const rowHeight = Math.max(lineCount * 6, 8) + 4; // Padding top/bottom

        // Alternating row background shading
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252); // Slate-50
          doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
        }

        // Row border
        doc.setDrawColor(226, 232, 240); // Slate-200
        doc.setLineWidth(0.2);
        doc.rect(margin, yPos, contentWidth, rowHeight, 'S');

        // Draw Label (Bold, 12pt)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(51, 65, 85); // Slate-700
        doc.text(label, labelX, yPos + 6);
        doc.text(":", colonX, yPos + 6);

        // Draw Value (Normal, 12pt)
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42); // Slate-900
        doc.text(valLines, valX, yPos + 6);

        yPos += rowHeight;
      });

      // IMAGE ATTACHMENT SECTION (Proportional aspect ratio with 2x height)
      if (uploadedImageBase64) {
        yPos += 8;

        const imgDimensions = await getImageDimensions(uploadedImageBase64);
        const naturalWidth = imgDimensions.width || 400;
        const naturalHeight = imgDimensions.height || 300;
        const aspectRatio = naturalWidth / naturalHeight;

        // Target height set to ~120mm (2x larger)
        const targetHeight = 120; // mm
        const maxAllowedWidth = 175; // mm (fits A4 margin)

        let calcWidth = targetHeight * aspectRatio;
        let calcHeight = targetHeight;

        if (calcWidth > maxAllowedWidth) {
          calcWidth = maxAllowedWidth;
          calcHeight = maxAllowedWidth / aspectRatio;
        }

        // Check page overflow (A4 height = 297mm)
        if (yPos + calcHeight + 15 > 275) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text("Dokumentasi Kegiatan:", margin, yPos);
        yPos += 6;

        try {
          const imgType = uploadedImageBase64.includes('png') ? 'PNG' : 'JPEG';

          // Draw border frame for documentation photo matching calculated proportions
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.5);
          doc.rect(margin, yPos, calcWidth + 4, calcHeight + 4);

          doc.addImage(uploadedImageBase64, imgType, margin + 2, yPos + 2, calcWidth, calcHeight);
          yPos += calcHeight + 12;
        } catch (e) {
          console.error(e);
        }
      }

      // FOOTER
      const printDate = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text(`Dokumen Laporan KIPAPP • Dicetak pada ${printDate}`, margin, 285);

      doc.save(pdfFilename);
      onNotify(`PDF laporan berhasil didownload: "${pdfFilename}"`, 'success');
    } catch (e: any) {
      onNotify('Gagal mendownload PDF: ' + e.message, 'error');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });

        setUploadedImageBase64(base64);
        setUploadedFileName(file.name);
        onNotify(`File dokumentasi "${file.name}" berhasil dilampirkan.`, 'success');
      } catch (error: any) {
        onNotify('Gagal membaca file: ' + error.message, 'error');
      }
    }
  };

  // Save / Update Handler
  const handleSaveSubmit = (status: 'Draft' | 'Submitted') => {
    if (!subActivity.trim()) {
      onNotify('Uraian Kegiatan wajib diisi!', 'error');
      return;
    }

    if (Number(realisasi) <= 0) {
      onNotify('Realisasi kegiatan harus lebih dari 0! Tidak dapat mengirim atau menyimpan kegiatan dengan realisasi 0.', 'error');
      return;
    }

    const matchedPlan = performancePlans.find(p => p.id === selectedPlanId);
    let finalRencanaKinerja = '';
    if (matchedPlan) {
      if (rkRoleType === 'Ketua') {
        finalRencanaKinerja = matchedPlan.rencanaKinerjaKetua || matchedPlan.indicator || matchedPlan.rencanaKinerjaAnggota;
      } else {
        finalRencanaKinerja = matchedPlan.rencanaKinerjaAnggota || matchedPlan.indicator;
      }
    } else {
      finalRencanaKinerja = subActivity.trim();
    }
    const finalSatuan = matchedPlan ? matchedPlan.unit : 'Dokumen';
    const finalCapaian = capaian.trim() || `${subActivity.trim()} dilaksanakan dengan baik.`;
    const targetOut = matchedPlan?.targetOutput || 100;
    const calcProgress = targetOut > 0 ? Math.min(200, Math.round((Number(realisasi) / targetOut) * 100)) : 100;

    const activityData: Activity = {
      id: editingId || `act-${Date.now()}`,
      employeeName: employeeName.trim() || userName || 'Pegawai',
      email: userEmail,
      team: selectedTeam,
      date: activityDate,
      year: currentYear,
      activityType: 'Kegiatan Kinerja',
      subActivity: subActivity.trim(),
      startTime,
      endTime,
      performancePlanId: selectedPlanId || '',
      performancePlanTitle: finalRencanaKinerja,
      rencana_kinerja: finalRencanaKinerja,
      capaian: finalCapaian,
      realisasi: Number(realisasi) || 0,
      satuan: finalSatuan,
      progress: calcProgress,
      driveLink: driveLink.trim() || currentUserAccount?.driveSkripsiLink || DEFAULT_DRIVE_FOLDER,
      driveFileId: isDriveUploaded ? 'uploaded' : '',
      status,
      notes: notes.trim(),
      createdAt: editingId 
        ? (myActivities.find(a => a.id === editingId)?.createdAt || new Date().toISOString())
        : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setPendingAction({
      type: 'save',
      activity: activityData
    });
    setShowConfirmModal(true);
  };

  const executeSave = async (activity: Activity) => {
    setIsSaving(true);
    try {
      const res = editingId 
        ? await updateServerActivity(editingId, activity)
        : await createServerActivity(activity);

      if (res.success) {
        onNotify(editingId ? 'Berhasil mengupdate aktivitas!' : 'Berhasil menyimpan aktivitas ke Database Server!', 'success');

        // Sync to Google Sheets if access token is available
        const accessToken = await getAccessToken();
        if (accessToken) {
          syncActivityToGoogleSheets(accessToken, activity, settings.spreadsheetId).catch(err => {
            console.warn('Google Sheets sync warning:', err);
          });
        }

        resetForm();
        await onRefreshData();
      } else {
        onNotify(res.message || 'Gagal menyimpan ke Database Server.', 'error');
      }
    } catch (error: any) {
      onNotify('Gagal menghubungi Server Database: ' + error.message, 'error');
    } finally {
      setIsSaving(false);
      setShowConfirmModal(false);
    }
  };

  const handleDeleteClick = (activity: Activity) => {
    setPendingAction({
      type: 'delete',
      activity
    });
    setShowConfirmModal(true);
  };

  const executeDelete = async (activity: Activity) => {
    setIsSaving(true);
    try {
      const res = await deleteServerActivity(activity.id);
      if (res.success) {
        onNotify('Berhasil menghapus aktivitas dari database server!', 'success');
        await onRefreshData();
      } else {
        onNotify(res.message || 'Gagal menghapus aktivitas.', 'error');
      }
    } catch (error: any) {
      onNotify('Gagal menghapus: ' + error.message, 'error');
    } finally {
      setIsSaving(false);
      setShowConfirmModal(false);
    }
  };

  const handleEditClick = (act: Activity) => {
    setEditingId(act.id);
    setEmployeeName(act.employeeName);
    setSelectedTeam(act.team);
    setActivityDate(act.date);
    setStartTime(act.startTime || '08:00');
    setEndTime(act.endTime || '16:00');
    setSubActivity(act.subActivity);
    setSelectedPlanId(act.performancePlanId || '');
    
    // Auto-detect whether this was saved as Ketua or Anggota
    const matched = performancePlans.find(p => p.id === act.performancePlanId);
    if (matched && matched.rencanaKinerjaKetua && (act.rencana_kinerja === matched.rencanaKinerjaKetua || act.performancePlanTitle === matched.rencanaKinerjaKetua)) {
      setRkRoleType('Ketua');
    } else {
      setRkRoleType('Anggota');
    }

    setRealisasi(act.realisasi || 0);
    setCapaian(act.capaian || `${act.subActivity} dilaksanakan dengan baik.`);
    setProgress(act.progress);
    setNotes(act.notes || '');
    setDriveLink(act.driveLink);
    setIsDriveUploaded(act.driveFileId === 'uploaded');
    setUploadedFileName(act.driveFileId ? 'Terlampir' : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onNotify('Mode Edit: Silakan perbarui data pada form di atas.', 'info');
  };

  // Local Search and Filter
  const filteredMyActivities = myActivities.filter(act => {
    const matchesSearch = act.subActivity.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (act.rencana_kinerja || act.performancePlanTitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (act.capaian || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'All' || act.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8" id="activity-log-view">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">Input Kegiatan Harian Pegawai</h1>
          <p className="text-sm text-slate-500">Catat kegiatan harian, download PDF laporan otomatis, simpan ke database, dan ekspor ke JSON.</p>
        </div>
      </div>

      {/* FORM AND INSTRUCTION PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* INPUT FORM CARD */}
        <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 space-y-6 shadow-xs relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-100">
            <h2 className="text-lg font-extrabold text-slate-800 font-display flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" />
              {editingId ? 'Edit Catatan Aktivitas' : 'Catat Aktivitas Baru'}
            </h2>
            <button
              type="button"
              onClick={() => setShowImportExcel(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs hover:shadow-md transition-all cursor-pointer self-start sm:self-auto"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Input Kegiatan Via Excel</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">Nama Pegawai</label>
              <input
                type="text"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="Masukkan Nama Anda"
                className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">Tim Kerja</label>
              <select
                value={selectedTeam}
                onChange={(e) => {
                  setSelectedTeam(e.target.value);
                }}
                className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              >
                {teams.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-1">
              <label className="block text-xs font-bold text-slate-600">Tanggal Kegiatan</label>
              <input
                type="date"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-1">
              <label className="block text-xs font-bold text-slate-600">Jam Mulai</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-1">
              <label className="block text-xs font-bold text-slate-600">Jam Selesai</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* RENCANA KINERJA (PILIHAN ANGGOTA / KETUA) & KELUARAN HASIL */}
          <div className="space-y-3.5 bg-indigo-50/50 p-4 sm:p-5 rounded-2xl border border-indigo-100">
            {/* TOGGLE 2 PILIHAN: ANGGOTA (DEFAULT) & KETUA */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-indigo-100/80">
              <div>
                <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-indigo-600" />
                  <span>Tingkat Rencana Kinerja (Tahun {currentYear}) *</span>
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Pilih tingkat rencana kinerja, default: <strong>Rencana Kinerja Anggota</strong>.
                </p>
              </div>

              {/* 2 Pilihan: Anggota vs Ketua */}
              <div className="inline-flex p-1 bg-white rounded-xl border border-indigo-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setRkRoleType('Anggota')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    rkRoleType === 'Anggota'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Anggota (Default)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRkRoleType('Ketua')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    rkRoleType === 'Ketua'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>Ketua</span>
                </button>
              </div>
            </div>

            {/* DROPDOWN SESUAI PILIHAN ANGGOTA / KETUA */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {rkRoleType === 'Anggota' ? 'Pilih Rencana Kinerja Anggota *' : 'Pilih Rencana Kinerja Ketua *'}
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="block w-full rounded-xl bg-white border border-indigo-200 px-4 py-2.5 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              >
                <option value="">
                  {rkRoleType === 'Anggota' ? '-- Pilih Rencana Kinerja Anggota --' : '-- Pilih Rencana Kinerja Ketua --'}
                </option>
                {availablePlans.map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {rkRoleType === 'Anggota'
                      ? `[${plan.team}] ${plan.rencanaKinerjaAnggota || plan.indicator} (Bobot: ${plan.weight || plan.bobotRkAnggota || 0}%, Target: ${plan.targetOutput} ${plan.unit})`
                      : `[${plan.team}] ${plan.rencanaKinerjaKetua} (Bobot RK Ketua: ${plan.bobotRkKetua || 0}%, IKU: ${plan.iku})`
                    }
                  </option>
                ))}
              </select>
            </div>

            {/* KELUAR HASILNYA (Rincian Parameter, Satuan, Target, Bobot, Realisasi & Persentase Capaian) */}
            {(() => {
              const matchedPlan = availablePlans.find(p => p.id === selectedPlanId);
              if (!matchedPlan) {
                return (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    Silakan pilih salah satu rencana kinerja {rkRoleType === 'Anggota' ? 'anggota' : 'ketua'} di atas untuk menampilkan rincian target, bobot, satuan, dan hasil capaian.
                  </div>
                );
              }

              const targetOut = matchedPlan.targetOutput || 100;
              const calcPercent = targetOut > 0 ? Math.round((Number(realisasi) / targetOut) * 100) : 100;

              return (
                <div className="space-y-3 pt-1">
                  {/* HASIL TARGET, INPUT REALISASI & CAPAIAN PERSENTASE */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-1">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase">Target &amp; Satuan</span>
                      <div className="text-sm font-bold text-slate-900 font-mono">
                        {matchedPlan.targetOutput} <span className="text-xs font-semibold text-slate-500">{matchedPlan.unit || 'Dokumen'}</span>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-indigo-200 space-y-1">
                      <label className="block text-[10px] font-bold text-slate-700 uppercase">
                        Input Realisasi ({matchedPlan.unit || 'Satuan'}) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={realisasi}
                        onChange={(e) => setRealisasi(Number(e.target.value))}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-sm text-indigo-700 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 space-y-1">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase">Capaian Terhitung</span>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-emerald-800 font-mono">{calcPercent}%</span>
                        <span className="text-[10px] font-semibold text-emerald-600">
                          {realisasi} / {targetOut} {matchedPlan.unit}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* URUAIN / RINCIAN KEGIATAN */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-600">Kegiatan / Rincian Kegiatan *</label>
            <textarea
              rows={2}
              value={subActivity}
              onChange={(e) => handleSubActivityChange(e.target.value)}
              placeholder="Contoh: Melaksanakan pengumpulan dan pemeriksaan metadata statistik sektoral"
              className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* CAPAIAN KEGIATAN */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-600">Capaian Kegiatan</label>
            <input
              type="text"
              value={capaian}
              onChange={(e) => setCapaian(e.target.value)}
              placeholder="Contoh: Pengumpulan dan pemeriksaan metadata statistik sektoral dilaksanakan dengan baik."
              className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* DOKUMENTASI KEGIATAN & DOWNLOAD PDF LAPORAN */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <File className="w-4 h-4 text-indigo-600" />
              <span>Dokumentasi Kegiatan (Foto / Bukti) &amp; Download PDF Laporan</span>
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer flex-shrink-0"
              >
                <Download className="w-4 h-4" /> Download PDF Laporan
              </button>
            </div>
            {uploadedFileName && (
              <div className="text-xs font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 w-fit">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Foto Terlampir: {uploadedFileName}
              </div>
            )}
            <p className="text-[10px] text-slate-500">
              *Upload foto dokumentasi di atas, lalu klik <strong>Download PDF Laporan</strong> untuk mendownload PDF dengan format nama otomatis: <code className="text-indigo-600 font-bold">[Nama]_[Tanggal]_[Bulan]_[Tahun]_[Jam]_[Kegiatan].pdf</code>
            </p>
          </div>

          {/* GOOGLE DRIVE UPLOAD CHECKBOX & LINK */}
          <div className="space-y-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="drive-checkbox"
                checked={isDriveUploaded}
                onChange={(e) => setIsDriveUploaded(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="drive-checkbox" className="text-xs font-bold text-slate-800 cursor-pointer">
                Sudah diupload ke Google Drive (Ceklis setelah Anda mengupload PDF ke Google Drive pribadi)
              </label>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-indigo-600" />
                  <span>Link PDF Google Drive (Data Dukung) *</span>
                </label>
                <a
                  href={currentUserAccount?.driveSkripsiLink || DEFAULT_DRIVE_FOLDER}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Buka Folder Drive Saya
                </a>
              </div>
              <input
                type="url"
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                placeholder="https://drive.google.com/file/d/... (Paste link shareable PDF dari Google Drive di sini)"
                className="block w-full rounded-xl bg-white border border-indigo-200 px-4 py-2.5 text-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <p className="text-[10px] text-slate-500">
                *Salin link (URL) PDF dari Google Drive Anda setelah di-upload, lalu paste di kolom ini untuk data_dukung JSON &amp; Database.
              </p>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Batal Edit
              </button>
            )}

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSubmit('Draft')}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
            >
              Simpan Draft
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSubmit('Submitted')}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-100 transition-all cursor-pointer hover:shadow-lg disabled:opacity-50"
            >
              {isSaving ? 'Menyimpan...' : editingId ? 'Perbarui Aktivitas' : 'Simpan ke Database Server'}
            </button>
          </div>
        </div>

        {/* SIDE INSTRUCTION / SUMMARY PANEL */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-800 font-display flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-600" /> Panduan Pelaporan Kinerja
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0" />
                <span><strong>1. Isi Rincian:</strong> Tentukan rencana kinerja, jam mulai, jam selesai, rincian kegiatan, dan capaian.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0" />
                <span><strong>2. Upload Bukti &amp; Download PDF:</strong> Lampirkan foto, lalu klik <strong>Download PDF Laporan</strong> (nama otomatis).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0" />
                <span><strong>3. Upload ke Drive &amp; Paste Link:</strong> Upload file PDF ke Drive Anda, centang kotak ceklis, dan tempel link shareable PDF ke kolom Data Dukung.</span>
              </li>
            </ul>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-100 p-6 rounded-3xl space-y-2 text-xs text-indigo-950">
            <div className="font-extrabold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-indigo-600" /> Rekap Aktivitas Anda
            </div>
            <div className="text-2xl font-black font-display text-indigo-700">
              {myActivities.length} <span className="text-xs font-semibold text-indigo-600">Kegiatan Terdata</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Seluruh rekaman tersimpan secara aman di database server SatuInApp.
            </p>
          </div>
        </div>
      </div>

      {/* MY ACTIVITY LIST TABLE */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 font-display">Daftar Kegiatan yang Anda Catat</h3>
            <p className="text-xs text-slate-500">Riwayat seluruh aktivitas harian yang tersimpan di database server.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-bold"
            >
              <option value="All">Semua Status</option>
              <option value="Submitted">Submitted (Terkirim)</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left">
            <thead>
              <tr className="bg-slate-50/75 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Tanggal &amp; Waktu</th>
                <th className="px-4 py-3">Rencana Kinerja</th>
                <th className="px-4 py-3">Uraian Kegiatan</th>
                <th className="px-4 py-3">Capaian</th>
                <th className="px-4 py-3 text-center">Progres</th>
                <th className="px-4 py-3 text-center">Data Dukung</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredMyActivities.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-xs">
                    Belum ada kegiatan yang dicatat. Gunakan formulir di atas untuk menambahkan.
                  </td>
                </tr>
              ) : (
                filteredMyActivities.map((act) => {
                  return (
                    <tr key={act.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-slate-700 font-bold whitespace-nowrap">
                        <div>{act.date}</div>
                        <div className="text-[10px] font-normal text-slate-500">{act.startTime || '08:00'} - {act.endTime || '16:00'} WIB</div>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs text-slate-900 font-medium">
                        <div className="line-clamp-2">{act.rencana_kinerja || act.performancePlanTitle || '-'}</div>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="font-bold text-slate-900 line-clamp-2">{act.subActivity}</div>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs text-slate-600">
                        <div className="line-clamp-2">{act.capaian || act.notes || `${act.subActivity} dilaksanakan dengan baik.`}</div>
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-bold text-indigo-700">
                        {act.progress}%
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {act.driveLink ? (
                          <a
                            href={act.driveLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold text-[11px] border border-indigo-100"
                          >
                            <ExternalLink className="w-3 h-3" /> Link
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {act.status === 'Submitted' ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            Submitted
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditClick(act)}
                            className="p-1.5 bg-slate-100 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(act)}
                            className="p-1.5 bg-slate-100 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                {pendingAction.type === 'delete' ? <Trash2 className="w-6 h-6 text-rose-600" /> : <CheckCircle className="w-6 h-6 text-indigo-600" />}
              </div>
              
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 font-display">
                  {pendingAction.type === 'delete' ? 'Konfirmasi Hapus Aktivitas' : 'Konfirmasi Simpan Aktivitas'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {pendingAction.type === 'delete' 
                    ? `Apakah Anda yakin ingin menghapus aktivitas "${pendingAction.activity?.subActivity}"?`
                    : `Pastikan data kegiatan, jam mulai/selesai, dan link PDF Google Drive sudah benar sebelum disimpan.`
                  }
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    if (pendingAction.type === 'delete' && pendingAction.activity) {
                      executeDelete(pendingAction.activity);
                    } else if (pendingAction.type === 'save' && pendingAction.activity) {
                      executeSave(pendingAction.activity);
                    }
                  }}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer ${
                    pendingAction.type === 'delete' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isSaving ? 'Memproses...' : 'Ya, Lanjutkan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* IMPORT EXCEL MODAL */}
      <ImportExcelModal
        isOpen={showImportExcel}
        onClose={() => setShowImportExcel(false)}
        userEmail={userEmail}
        userName={userName || employeeName}
        userTeam={selectedTeam}
        teams={teams}
        performancePlans={performancePlans}
        onRefreshData={onRefreshData}
        onNotify={onNotify}
      />

    </div>
  );
}
