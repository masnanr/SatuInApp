/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { PerformancePlan, Activity, Team, cleanIkuTitle } from '../types';
import { createBulkServerActivities } from '../lib/serverApi';
import { syncBulkActivitiesToGoogleSheets } from '../lib/googleSheetsService';
import { getAccessToken } from '../lib/firebase';
import { 
  FileSpreadsheet, Download, Upload, CheckCircle2, AlertTriangle, 
  X, Check, AlertCircle, HelpCircle, ArrowRight, RefreshCw, FileText,
  Copy, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userName: string;
  userTeam?: string;
  teams: Team[];
  performancePlans: PerformancePlan[];
  onRefreshData: () => Promise<void>;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

interface ParsedActivityRow {
  rowNumber: number;
  rawRencanaKinerja: string;
  rawTanggal: string;
  rawJamMulai: string;
  rawJamSelesai: string;
  rawKegiatan: string;
  rawProgres: number;
  rawCapaian: string;
  rawRealisasi: number;
  rawDriveLink: string;
  
  // Validation status
  isValid: boolean;
  errorReason?: string;
  matchedPlan?: PerformancePlan;
  sanitizedDate?: string;
}

// Master daftar rencana kinerja default untuk memastikan Sheet 2 & Sheet 3 selalu lengkap
const DEFAULT_MASTER_PERFORMANCE_PLANS = [
  {
    team: 'Tim IPDS & TI',
    year: 2026,
    iku: 'Pengelolaan TI & Diseminasi',
    targetIku: '100%',
    rencanaKinerjaKetua: 'Diseminasi Statistik & Pengelolaan TI',
    bobotRkKetua: 50,
    rencanaKinerjaAnggota: 'Terselenggaranya Kegiatan Pengumpulan dan Pemeriksaan Metadata Statistik Sektoral yang akuntabel',
    indicator: 'Terselenggaranya Kegiatan Pengumpulan dan Pemeriksaan Metadata Statistik Sektoral yang akuntabel',
    bobotRkAnggota: 25,
    targetOutput: 20,
    unit: 'Dokumen'
  },
  {
    team: 'Tim Statistik Sosial',
    year: 2026,
    iku: 'Persentase Kualitas Data Sosial',
    targetIku: '100%',
    rencanaKinerjaKetua: 'Koordinasi Survei Sosial Kependudukan',
    bobotRkKetua: 50,
    rencanaKinerjaAnggota: 'Terlaksananya Survei Angkatan Kerja Nasional (Sakernas)',
    indicator: 'Terlaksananya Survei Angkatan Kerja Nasional (Sakernas)',
    bobotRkAnggota: 25,
    targetOutput: 120,
    unit: 'Dokumen'
  },
  {
    team: 'Tim Statistik Sosial',
    year: 2026,
    iku: 'Persentase Kualitas Data Sosial',
    targetIku: '100%',
    rencanaKinerjaKetua: 'Koordinasi Pendataan Susenas & Kesejahteraan Rakyat',
    bobotRkKetua: 50,
    rencanaKinerjaAnggota: 'Pendataan Survei Sosial Ekonomi Nasional (Susenas)',
    indicator: 'Pendataan Survei Sosial Ekonomi Nasional (Susenas)',
    bobotRkAnggota: 35,
    targetOutput: 250,
    unit: 'Sampel / Responden'
  },
  {
    team: 'Tim Statistik Distribusi',
    year: 2026,
    iku: 'Indeks Harga dan Distribusi',
    targetIku: '100%',
    rencanaKinerjaKetua: 'Pengawasan Survei Harga IHK & Perdagangan',
    bobotRkKetua: 50,
    rencanaKinerjaAnggota: 'Survei Pemantauan Indeks Harga Konsumen (IHK) Mingguan',
    indicator: 'Survei Pemantauan Indeks Harga Konsumen (IHK) Mingguan',
    bobotRkAnggota: 30,
    targetOutput: 52,
    unit: 'Laporan'
  },
  {
    team: 'Tim Statistik Distribusi',
    year: 2026,
    iku: 'Indeks Harga dan Distribusi',
    targetIku: '100%',
    rencanaKinerjaKetua: 'Analisis Pariwisata dan Transportasi',
    bobotRkKetua: 50,
    rencanaKinerjaAnggota: 'Survei Tingkat Penghunian Kamar Hotel dan Wisatawan',
    indicator: 'Survei Tingkat Penghunian Kamar Hotel dan Wisatawan',
    bobotRkAnggota: 20,
    targetOutput: 12,
    unit: 'Publikasi'
  },
  {
    team: 'Tim Neraca Wilayah & Analisis',
    year: 2026,
    iku: 'PDRB dan Analisis Makro',
    targetIku: '100%',
    rencanaKinerjaKetua: 'Penyusunan PDRB dan Analisis Neraca Wilayah',
    bobotRkKetua: 50,
    rencanaKinerjaAnggota: 'Penyusunan Publikasi PDRB Triwulanan dan Tahunan',
    indicator: 'Penyusunan Publikasi PDRB Triwulanan dan Tahunan',
    bobotRkAnggota: 40,
    targetOutput: 4,
    unit: 'Publikasi'
  },
  {
    team: 'Tim IPDS & TI',
    year: 2026,
    iku: 'Pengelolaan TI & Diseminasi',
    targetIku: '100%',
    rencanaKinerjaKetua: 'Diseminasi Statistik & Portal Data',
    bobotRkKetua: 50,
    rencanaKinerjaAnggota: 'Diseminasi Rilis Berita Resmi Statistik (BRS) & Portal Data',
    indicator: 'Diseminasi Rilis Berita Resmi Statistik (BRS) & Portal Data',
    bobotRkAnggota: 25,
    targetOutput: 24,
    unit: 'Tabel Statistik'
  },
  {
    team: 'Bagian Tata Usaha & Umum',
    year: 2026,
    iku: 'Akuntabilitas Kinerja',
    targetIku: '100%',
    rencanaKinerjaKetua: 'Penyusunan LAKIP dan Akuntabilitas Instansi',
    bobotRkKetua: 50,
    rencanaKinerjaAnggota: 'Penyusunan Laporan Akuntabilitas Kinerja Instansi Pemerintah (LAKIP)',
    indicator: 'Penyusunan Laporan Akuntabilitas Kinerja Instansi Pemerintah (LAKIP)',
    bobotRkAnggota: 20,
    targetOutput: 1,
    unit: 'Laporan'
  }
];

export default function ImportExcelModal({
  isOpen,
  onClose,
  userEmail,
  userName,
  userTeam,
  teams,
  performancePlans,
  onRefreshData,
  onNotify
}: ImportExcelModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedActivityRow[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'valid' | 'invalid'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPlanReferenceList, setShowPlanReferenceList] = useState(false);
  const [referenceDrawerTab, setReferenceDrawerTab] = useState<'anggota' | 'ketua'>('anggota');
  const [copiedIndicator, setCopiedIndicator] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const DEFAULT_DRIVE_FOLDER = 'https://drive.google.com/drive/folders/14ir5SrJ2zzac4mnCWzrdPbqkkr8_9AAM?usp=sharing';

  // Helper untuk mendapatkan seluruh daftar RK Anggota yang valid (Sheet 2)
  const getAllValidPlans = () => {
    const map = new Map<string, { indicator: string; team: string; year: number; targetOutput: number | string; unit: string; iku?: string; targetIku?: string | number; rencanaKinerjaKetua?: string; bobotRkKetua?: number; bobotRkAnggota?: number }>();

    // Masukkan rencana kinerja yang ada di database / props
    if (performancePlans && performancePlans.length > 0) {
      performancePlans.forEach(p => {
        const text = (p.rencanaKinerjaAnggota || p.indicator || '').trim();
        const key = text.toLowerCase();
        if (key && !map.has(key)) {
          map.set(key, {
            indicator: text,
            team: p.team || userTeam || 'Semua Tim',
            year: p.year || 2026,
            targetOutput: p.targetOutput || '-',
            unit: p.unit || '-',
            iku: p.iku || '',
            targetIku: p.targetIku || '100%',
            rencanaKinerjaKetua: p.rencanaKinerjaKetua || '',
            bobotRkKetua: p.bobotRkKetua || 50,
            bobotRkAnggota: p.weight || p.bobotRkAnggota || 0
          });
        }
      });
    }

    // Lengkapi dengan master daftar rencana kinerja
    DEFAULT_MASTER_PERFORMANCE_PLANS.forEach(dp => {
      const key = dp.indicator.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          indicator: dp.indicator,
          team: dp.team,
          year: dp.year,
          targetOutput: dp.targetOutput,
          unit: dp.unit,
          iku: dp.iku,
          targetIku: dp.targetIku,
          rencanaKinerjaKetua: dp.rencanaKinerjaKetua,
          bobotRkKetua: dp.bobotRkKetua,
          bobotRkAnggota: dp.bobotRkAnggota
        });
      }
    });

    return Array.from(map.values());
  };

  // Helper untuk mendapatkan seluruh daftar Rencana Kinerja Ketua Tim yang valid (Sheet 3)
  const getAllValidKetuaPlans = () => {
    const map = new Map<string, { rencanaKinerjaKetua: string; team: string; year: number; iku: string; targetIku: string | number; bobotRkKetua: number; targetOutput: number | string; unit: string }>();

    if (performancePlans && performancePlans.length > 0) {
      performancePlans.forEach(p => {
        const text = (p.rencanaKinerjaKetua || '').trim();
        const key = text.toLowerCase();
        if (key && !map.has(key)) {
          map.set(key, {
            rencanaKinerjaKetua: text,
            team: p.team || userTeam || 'Semua Tim',
            year: p.year || 2026,
            iku: p.iku || 'IKU Organisasi',
            targetIku: p.targetIku || '100%',
            bobotRkKetua: p.bobotRkKetua || 50,
            targetOutput: p.targetOutput || 100,
            unit: p.unit || 'Laporan'
          });
        }
      });
    }

    DEFAULT_MASTER_PERFORMANCE_PLANS.forEach(dp => {
      const text = dp.rencanaKinerjaKetua.trim();
      const key = text.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          rencanaKinerjaKetua: text,
          team: dp.team,
          year: dp.year,
          iku: dp.iku,
          targetIku: dp.targetIku,
          bobotRkKetua: dp.bobotRkKetua,
          targetOutput: dp.targetOutput,
          unit: dp.unit
        });
      }
    });

    return Array.from(map.values());
  };

  // Salin teks indikator ke clipboard
  const handleCopyIndicator = (indicator: string) => {
    navigator.clipboard.writeText(indicator);
    setCopiedIndicator(indicator);
    setTimeout(() => {
      setCopiedIndicator(null);
    }, 2000);
    onNotify('Teks Rencana Kinerja berhasil disalin!', 'success');
  };

  // Normalize string for fuzzy/trimmed comparison
  const normalizeText = (text: string | null | undefined): string => {
    if (!text) return '';
    return String(text)
      .toLowerCase()
      .replace(/[\r\n\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Convert Excel date value to YYYY-MM-DD
  const parseExcelDate = (val: any): string => {
    if (!val) return '';

    // If it's a number (Excel date serial)
    if (typeof val === 'number') {
      try {
        const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      } catch {
        return '';
      }
    }

    const str = String(val).trim();

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const parts = str.split(/[/.-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    return str;
  };

  // Generate and download template Excel dengan Sheet 2 berisi Daftar Rencana Kinerja
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();
      const validPlansList = getAllValidPlans();

      // Sheet 1: Template Input Kegiatan
      const templateData = [
        {
          'Rencana Kinerja': validPlansList[0]?.indicator || 'Terselenggaranya Kegiatan Pengumpulan dan Pemeriksaan Metadata Statistik Sektoral yang akuntabel',
          'Tanggal': '2026-08-04',
          'Jam Mulai': '08:00',
          'Jam Selesai': '16:00',
          'Kegiatan': 'Melaksanakan pengumpulan dan pemeriksaan metadata statistik sektoral',
          'Progres': 100,
          'Capaian': 'Pengumpulan dan pemeriksaan metadata statistik sektoral dilaksanakan dengan baik',
          'Realisasi': 10,
          'Data Dukung (Link PDF Drive)': 'https://drive.google.com/file/d/1examplePdfLink/view'
        },
        {
          'Rencana Kinerja': validPlansList[1]?.indicator || 'Terlaksananya Survei Angkatan Kerja Nasional (Sakernas)',
          'Tanggal': '2026-08-05',
          'Jam Mulai': '08:00',
          'Jam Selesai': '16:00',
          'Kegiatan': 'Pemeriksaan kelengkapan dokumen kuesioner Sakernas',
          'Progres': 100,
          'Capaian': 'Pemeriksaan kelengkapan dokumen kuesioner Sakernas dilaksanakan dengan baik',
          'Realisasi': 20,
          'Data Dukung (Link PDF Drive)': 'https://drive.google.com/file/d/2examplePdfLink/view'
        },
        {
          'Rencana Kinerja': validPlansList[2]?.indicator || 'Pendataan Survei Sosial Ekonomi Nasional (Susenas)',
          'Tanggal': '2026-08-06',
          'Jam Mulai': '08:00',
          'Jam Selesai': '16:00',
          'Kegiatan': 'Melaksanakan listing dan pencacahan sampel survei Susenas',
          'Progres': 100,
          'Capaian': 'Listing dan pencacahan sampel survei Susenas dilaksanakan dengan baik',
          'Realisasi': 50,
          'Data Dukung (Link PDF Drive)': 'https://drive.google.com/file/d/3examplePdfLink/view'
        }
      ];

      const wsTemplate = XLSX.utils.json_to_sheet(templateData);

      // Set column widths for readability pada Sheet 1
      wsTemplate['!cols'] = [
        { wch: 55 }, // Rencana Kinerja
        { wch: 14 }, // Tanggal
        { wch: 12 }, // Jam Mulai
        { wch: 12 }, // Jam Selesai
        { wch: 45 }, // Kegiatan
        { wch: 10 }, // Progres
        { wch: 50 }, // Capaian
        { wch: 12 }, // Realisasi
        { wch: 45 }  // Data Dukung
      ];

      XLSX.utils.book_append_sheet(wb, wsTemplate, 'Template Input Kegiatan');

      // Sheet 2: Daftar Rencana Kinerja Anggota (Daftar resmi yang valid untuk disalin)
      const sheet2Data = validPlansList.map((p, idx) => ({
        'No': idx + 1,
        'Rencana Kinerja': p.indicator, // Header sama persis dengan kolom Sheet 1
        'Tim Kerja': p.team,
        'Tahun Anggaran': p.year,
        'Induk RK Ketua': p.rencanaKinerjaKetua || '-',
        'Induk IKU': p.iku || '-',
        'Bobot RK Anggota (%)': p.bobotRkAnggota || '-',
        'Target Output': p.targetOutput,
        'Satuan': p.unit,
        'Petunjuk Penggunaan': 'Salin (copy) teks pada kolom "Rencana Kinerja" ini lalu paste ke kolom "Rencana Kinerja" di Sheet 1'
      }));

      const wsValidPlans = XLSX.utils.json_to_sheet(sheet2Data);
      wsValidPlans['!cols'] = [
        { wch: 6 },   // No
        { wch: 65 },  // Rencana Kinerja
        { wch: 28 },  // Tim Kerja
        { wch: 16 },  // Tahun Anggaran
        { wch: 38 },  // Induk RK Ketua
        { wch: 36 },  // Induk IKU
        { wch: 22 },  // Bobot RK Anggota
        { wch: 15 },  // Target Output
        { wch: 18 },  // Satuan
        { wch: 70 }   // Petunjuk Penggunaan
      ];

      XLSX.utils.book_append_sheet(wb, wsValidPlans, 'Rencana Kinerja Anggota');

      // Sheet 3: Daftar Rencana Kinerja Ketua Tim (Sesuai permintaan: masukkan rencana kegiatan ketua tim ke Sheet 3)
      const validKetuaList = getAllValidKetuaPlans();
      const sheet3Data = validKetuaList.map((k, idx) => ({
        'No': idx + 1,
        'Rencana Kinerja Ketua Tim': k.rencanaKinerjaKetua, // Teks yang valid disalin ke kolom Rencana Kinerja di Sheet 1
        'Tim Kerja': k.team,
        'Tahun Anggaran': k.year,
        'Induk IKU': k.iku,
        'Target IKU': k.targetIku,
        'Bobot RK Ketua (%)': k.bobotRkKetua,
        'Target Output': k.targetOutput,
        'Satuan': k.unit,
        'Petunjuk Penggunaan': 'Salin (copy) teks pada kolom "Rencana Kinerja Ketua Tim" ini lalu paste ke kolom "Rencana Kinerja" di Sheet 1'
      }));

      const wsKetuaPlans = XLSX.utils.json_to_sheet(sheet3Data);
      wsKetuaPlans['!cols'] = [
        { wch: 6 },   // No
        { wch: 60 },  // Rencana Kinerja Ketua Tim
        { wch: 28 },  // Tim Kerja
        { wch: 16 },  // Tahun Anggaran
        { wch: 38 },  // Induk IKU
        { wch: 14 },  // Target IKU
        { wch: 20 },  // Bobot RK Ketua
        { wch: 15 },  // Target Output
        { wch: 16 },  // Satuan
        { wch: 75 }   // Petunjuk Penggunaan
      ];

      XLSX.utils.book_append_sheet(wb, wsKetuaPlans, 'Rencana Kinerja Ketua Tim');

      XLSX.writeFile(wb, 'Template_Input_Kegiatan_SatuInApp.xlsx');
      onNotify('Template Excel berhasil didownload! Memuat Sheet 1 (Input), Sheet 2 (RK Anggota), dan Sheet 3 (RK Ketua Tim).', 'success');
    } catch (err: any) {
      onNotify('Gagal mendownload template: ' + err.message, 'error');
    }
  };

  // Read and parse uploaded Excel file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonRows.length === 0) {
          onNotify('File Excel kosong atau tidak memiliki baris data pada Sheet 1.', 'error');
          setIsProcessing(false);
          return;
        }

        const validPlansList = getAllValidPlans();

        // Validate each row against performancePlans & valid master plans
        const processed: ParsedActivityRow[] = jsonRows.map((row, idx) => {
          // Normalize column headers
          const getVal = (...keys: string[]) => {
            for (const key of keys) {
              const matchedKey = Object.keys(row).find(
                k => normalizeText(k) === normalizeText(key)
              );
              if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== '') {
                return row[matchedKey];
              }
            }
            return '';
          };

          const rawRencanaKinerja = String(getVal('Rencana Kinerja', 'rencana_kinerja', 'rencana kinerja', 'indikator', 'Rencana Kinerja SKP') || '').trim();
          const rawTanggal = parseExcelDate(getVal('Tanggal', 'tanggal', 'date', 'tgl'));
          const rawJamMulai = String(getVal('Jam Mulai', 'jam_mulai', 'jam mulai', 'start_time') || '08:00').trim();
          const rawJamSelesai = String(getVal('Jam Selesai', 'jam_selesai', 'jam selesai', 'end_time') || '16:00').trim();
          const rawKegiatan = String(getVal('Kegiatan', 'kegiatan', 'rincian kegiatan', 'sub_kegiatan', 'sub kegiatan', 'deskripsi kegiatan') || '').trim();
          const rawProgresNum = Number(getVal('Progres', 'progres', 'progress') || 100);
          const rawCapaian = String(getVal('Capaian', 'capaian') || '').trim();
          const rawRealisasiNum = Number(getVal('Realisasi', 'realisasi') || 0);
          const rawDriveLink = String(getVal('Data Dukung (Link PDF Drive)', 'Data Dukung', 'data_dukung', 'Link PDF Drive', 'drive_link', 'driveLink') || '').trim();

          // Validation logic
          let isValid = true;
          let errorReason = '';
          let matchedPlan: PerformancePlan | undefined = undefined;

          // 1. Check Rencana Kinerja (STRICT: must match registered performance plans or master list)
          if (!rawRencanaKinerja) {
            isValid = false;
            errorReason = 'Rencana Kinerja kosong!';
          } else {
            const cleanInputPlan = normalizeText(rawRencanaKinerja);

            // A. Cek di database performancePlans: RK Anggota
            matchedPlan = performancePlans.find(p => {
              const cleanIndicator = normalizeText(p.rencanaKinerjaAnggota || p.indicator);
              return cleanIndicator === cleanInputPlan || cleanIndicator.includes(cleanInputPlan) || cleanInputPlan.includes(cleanIndicator);
            });

            // B. Cek di database performancePlans: RK Ketua Tim (Sheet 3)
            if (!matchedPlan) {
              matchedPlan = performancePlans.find(p => {
                const cleanKetua = normalizeText(p.rencanaKinerjaKetua);
                return cleanKetua && (cleanKetua === cleanInputPlan || cleanKetua.includes(cleanInputPlan) || cleanInputPlan.includes(cleanKetua));
              });
            }

            // C. Cek di daftar master Sheet 2 (RK Anggota)
            if (!matchedPlan) {
              const matchedFromMaster = validPlansList.find(p => {
                const cleanIndicator = normalizeText(p.indicator);
                return cleanIndicator === cleanInputPlan || cleanIndicator.includes(cleanInputPlan) || cleanInputPlan.includes(cleanIndicator);
              });

              if (matchedFromMaster) {
                matchedPlan = {
                  id: `plan-master-${idx}`,
                  year: matchedFromMaster.year,
                  team: matchedFromMaster.team,
                  iku: cleanIkuTitle(matchedFromMaster.iku),
                  targetIku: matchedFromMaster.targetIku || '100%',
                  rencanaKinerjaKetua: matchedFromMaster.rencanaKinerjaKetua || '',
                  bobotRkKetua: matchedFromMaster.bobotRkKetua || 50,
                  rencanaKinerjaAnggota: matchedFromMaster.indicator,
                  indicator: matchedFromMaster.indicator,
                  targetOutput: typeof matchedFromMaster.targetOutput === 'number' ? matchedFromMaster.targetOutput : 100,
                  unit: matchedFromMaster.unit,
                  weight: matchedFromMaster.bobotRkAnggota || 0,
                  realisasi: 0,
                  status: 'active',
                  createdAt: new Date().toISOString()
                };
              }
            }

            // D. Cek di daftar master Sheet 3 (RK Ketua Tim)
            if (!matchedPlan) {
              const validKetuaList = getAllValidKetuaPlans();
              const matchedFromKetua = validKetuaList.find(k => {
                const cleanKetua = normalizeText(k.rencanaKinerjaKetua);
                return cleanKetua === cleanInputPlan || cleanKetua.includes(cleanInputPlan) || cleanInputPlan.includes(cleanKetua);
              });

              if (matchedFromKetua) {
                matchedPlan = {
                  id: `plan-ketua-master-${idx}`,
                  year: matchedFromKetua.year,
                  team: matchedFromKetua.team,
                  iku: cleanIkuTitle(matchedFromKetua.iku),
                  targetIku: matchedFromKetua.targetIku,
                  rencanaKinerjaKetua: matchedFromKetua.rencanaKinerjaKetua,
                  bobotRkKetua: matchedFromKetua.bobotRkKetua,
                  rencanaKinerjaAnggota: matchedFromKetua.rencanaKinerjaKetua,
                  indicator: matchedFromKetua.rencanaKinerjaKetua,
                  targetOutput: typeof matchedFromKetua.targetOutput === 'number' ? matchedFromKetua.targetOutput : 100,
                  unit: matchedFromKetua.unit,
                  weight: 0,
                  realisasi: 0,
                  status: 'active',
                  createdAt: new Date().toISOString()
                };
              }
            }

            if (!matchedPlan) {
              isValid = false;
              errorReason = 'Rencana Kinerja tidak sesuai atau tidak terdaftar! (Lihat daftar resmi di Sheet 2 untuk Anggota atau Sheet 3 untuk Ketua Tim)';
            }
          }

          // 2. Check Tanggal
          if (isValid && !rawTanggal) {
            isValid = false;
            errorReason = 'Tanggal kegiatan tidak valid atau kosong.';
          }

          // 3. Check Kegiatan / Sub Activity
          if (isValid && !rawKegiatan) {
            isValid = false;
            errorReason = 'Deskripsi kegiatan kosong.';
          }

          // 4. Check Realisasi > 0
          if (isValid && (isNaN(rawRealisasiNum) || rawRealisasiNum <= 0)) {
            isValid = false;
            errorReason = 'Realisasi harus lebih dari 0.';
          }

          return {
            rowNumber: idx + 2, // Excel row number (1 is header)
            rawRencanaKinerja,
            rawTanggal,
            rawJamMulai: rawJamMulai || '08:00',
            rawJamSelesai: rawJamSelesai || '16:00',
            rawKegiatan,
            rawProgres: isNaN(rawProgresNum) ? 100 : rawProgresNum,
            rawCapaian: rawCapaian || (rawKegiatan ? `${rawKegiatan} dilaksanakan dengan baik` : ''),
            rawRealisasi: isNaN(rawRealisasiNum) ? 0 : rawRealisasiNum,
            rawDriveLink: rawDriveLink || DEFAULT_DRIVE_FOLDER,
            isValid,
            errorReason,
            matchedPlan,
            sanitizedDate: rawTanggal
          };
        });

        setParsedRows(processed);
        const validCount = processed.filter(r => r.isValid).length;
        const invalidCount = processed.filter(r => !r.isValid).length;

        if (invalidCount > 0) {
          onNotify(`File diproses: ${validCount} baris valid, ${invalidCount} baris tidak sesuai rencana kinerja/tidak valid.`, 'info');
        } else {
          onNotify(`Semua ${validCount} baris kegiatan valid dan siap disimpan!`, 'success');
        }
      } catch (err: any) {
        onNotify('Gagal membaca file Excel: ' + err.message, 'error');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(uploadedFile);
  };

  // Submit valid rows to server
  const handleSaveValidActivities = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      onNotify('Tidak ada baris kegiatan yang valid untuk disimpan.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const activitiesToSave: Partial<Activity>[] = validRows.map(row => {
        const finalPlanTitle = row.matchedPlan?.indicator || row.rawRencanaKinerja;
        return {
          employeeName: userName,
          email: userEmail,
          team: row.matchedPlan?.team || userTeam || teams[0]?.name || 'Tim Umum',
          date: row.sanitizedDate || row.rawTanggal,
          startTime: row.rawJamMulai,
          endTime: row.rawJamSelesai,
          activityType: 'Kegiatan Kinerja',
          subActivity: row.rawKegiatan,
          performancePlanId: row.matchedPlan?.id || '',
          performancePlanTitle: finalPlanTitle,
          rencana_kinerja: finalPlanTitle,
          capaian: row.rawCapaian,
          realisasi: row.rawRealisasi,
          satuan: row.matchedPlan?.unit || 'Dokumen',
          progress: row.rawProgres,
          driveLink: row.rawDriveLink || DEFAULT_DRIVE_FOLDER,
          driveFileId: row.rawDriveLink ? 'uploaded' : '',
          status: 'Submitted',
          notes: ''
        };
      });

      const res = await createBulkServerActivities(activitiesToSave);
      if (res.success) {
        onNotify(`Berhasil menginput ${res.count || activitiesToSave.length} kegiatan dari Excel ke Database!`, 'success');

        // Sync to Google Sheets in background if access token is available
        const accessToken = await getAccessToken();
        if (accessToken) {
          // Convert partials to complete Activity objects for sync
          const fullActivities: Activity[] = activitiesToSave.map((act, idx) => ({
            id: `excel-act-${Date.now()}-${idx}`,
            employeeName: act.employeeName || userName,
            email: act.email || userEmail,
            team: act.team || 'Tim Umum',
            date: act.date || new Date().toISOString().substring(0, 10),
            activityType: act.activityType || 'Kegiatan Kinerja',
            subActivity: act.subActivity || '',
            rencana_kinerja: act.rencana_kinerja || '',
            performancePlanTitle: act.performancePlanTitle || '',
            progress: act.progress || 100,
            driveLink: act.driveLink || DEFAULT_DRIVE_FOLDER,
            driveFileId: act.driveFileId || '',
            status: 'Submitted',
            notes: act.notes || '',
            capaian: act.capaian || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }));

          syncBulkActivitiesToGoogleSheets(accessToken, fullActivities).catch(err => {
            console.warn('Google Sheets bulk sync warning:', err);
          });
        }

        await onRefreshData();
        handleResetAndClose();
      } else {
        onNotify(res.message || 'Gagal menyimpan kegiatan massal.', 'error');
      }
    } catch (err: any) {
      onNotify('Terjadi kesalahan saat menyimpan: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetAndClose = () => {
    setFile(null);
    setParsedRows([]);
    setFilterTab('all');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  if (!isOpen) return null;

  const validRows = parsedRows.filter(r => r.isValid);
  const invalidRows = parsedRows.filter(r => !r.isValid);

  const displayedRows = parsedRows.filter(r => {
    if (filterTab === 'valid') return r.isValid;
    if (filterTab === 'invalid') return !r.isValid;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-800 font-display flex items-center gap-2">
                Input Kegiatan via Excel
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Validasi Otomatis SKP
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Unggah file Excel untuk mencatat banyak kegiatan harian sekaligus dengan validasi rencana kinerja SKP.
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* TOP STEP GUIDE & DOWNLOAD TEMPLATE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Step 1: Download Template */}
            <div className="p-5 bg-gradient-to-br from-indigo-50/60 to-purple-50/40 rounded-2xl border border-indigo-100 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-indigo-600 bg-indigo-100/60 px-2 py-0.5 rounded-md">
                  Langkah 1
                </span>
                <h4 className="text-sm font-bold text-slate-800 mt-2">Download Template Excel</h4>
                <p className="text-xs text-slate-600 mt-1">
                  Template memuat <b>Sheet 1 (Template Input Kegiatan)</b>, <b>Sheet 2 (Rencana Kinerja Anggota)</b>, dan <b>Sheet 3 (Rencana Kinerja Ketua Tim)</b> yang berisi seluruh daftar rencana kinerja resmi untuk disalin agar terhindar dari salah ketik.
                </p>
              </div>
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200 shadow-xs transition-all cursor-pointer flex-1"
                >
                  <Download className="w-4 h-4" /> Download Template (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => setShowPlanReferenceList(!showPlanReferenceList)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-100/70 hover:bg-indigo-200/70 text-indigo-800 text-xs font-bold transition-all cursor-pointer"
                  title="Lihat list rencana kinerja langsung di layar"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{showPlanReferenceList ? 'Tutup List' : 'Lihat List Sheet 2 & 3'}</span>
                  {showPlanReferenceList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Step 2: Upload Excel File */}
            <div className="p-5 bg-gradient-to-br from-emerald-50/60 to-teal-50/40 rounded-2xl border border-emerald-100 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-600 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                  Langkah 2
                </span>
                <h4 className="text-sm font-bold text-slate-800 mt-2">Upload File Excel Kegiatan</h4>
                <p className="text-xs text-slate-600 mt-1">
                  Pilih file Excel yang sudah Anda isi pada Sheet 1. Sistem akan otomatis memvalidasi kolom Rencana Kinerja setiap baris terhadap Sheet 2 maupun Sheet 3.
                </p>
              </div>
              <div className="mt-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="excel-activity-input"
                />
                <label
                  htmlFor="excel-activity-input"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer w-full sm:w-auto"
                >
                  <Upload className="w-4 h-4" /> {file ? `Ganti File (${file.name})` : 'Pilih File Excel (.xlsx)'}
                </label>
              </div>
            </div>

          </div>

          {/* INTERACTIVE SHEET 2 & SHEET 3 REFERENCE DRAWER */}
          <AnimatePresence>
            {showPlanReferenceList && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-slate-50 border border-indigo-200 rounded-2xl p-4.5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-indigo-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                      <h5 className="text-xs font-extrabold text-slate-800">
                        Daftar Referensi Rencana Kinerja Resmi
                      </h5>
                    </div>

                    {/* TAB PILIHAN SHEET 2 / SHEET 3 */}
                    <div className="inline-flex p-1 bg-white rounded-xl border border-indigo-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setReferenceDrawerTab('anggota')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          referenceDrawerTab === 'anggota'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Sheet 2 (RK Anggota)
                      </button>
                      <button
                        type="button"
                        onClick={() => setReferenceDrawerTab('ketua')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          referenceDrawerTab === 'ketua'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Sheet 3 (RK Ketua Tim)
                      </button>
                    </div>
                  </div>

                  {/* LIST SHEET 2: RK ANGGOTA */}
                  {referenceDrawerTab === 'anggota' && (
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                      {getAllValidPlans().map((plan, idx) => {
                        const isCopied = copiedIndicator === plan.indicator;
                        return (
                          <div
                            key={idx}
                            className="bg-white p-3 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-extrabold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                  #{idx + 1}
                                </span>
                                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                                  {plan.team}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Tahun {plan.year}
                                </span>
                                {plan.rencanaKinerjaKetua && (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 truncate max-w-xs">
                                    Induk: {plan.rencanaKinerjaKetua}
                                  </span>
                                )}
                              </div>
                              <p className="font-semibold text-slate-800 truncate" title={plan.indicator}>
                                {plan.indicator}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyIndicator(plan.indicator)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                                isCopied
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                              }`}
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{isCopied ? 'Tersalin!' : 'Salin'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* LIST SHEET 3: RK KETUA TIM */}
                  {referenceDrawerTab === 'ketua' && (
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                      {getAllValidKetuaPlans().map((kPlan, idx) => {
                        const isCopied = copiedIndicator === kPlan.rencanaKinerjaKetua;
                        return (
                          <div
                            key={idx}
                            className="bg-white p-3 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-extrabold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                  #{idx + 1}
                                </span>
                                <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                                  {kPlan.team}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Tahun {kPlan.year}
                                </span>
                                <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 truncate max-w-xs">
                                  {kPlan.iku}
                                </span>
                              </div>
                              <p className="font-semibold text-slate-800 truncate" title={kPlan.rencanaKinerjaKetua}>
                                {kPlan.rencanaKinerjaKetua}
                              </p>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                Bobot RK Ketua: {kPlan.bobotRkKetua}% • Target: {kPlan.targetOutput} {kPlan.unit}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyIndicator(kPlan.rencanaKinerjaKetua)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                                isCopied
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                              }`}
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{isCopied ? 'Tersalin!' : 'Salin'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* VALIDATION RULE BANNER */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Ketentuan Validasi:</span> Kolom <b>Rencana Kinerja</b> pada Sheet 1 harus sesuai dengan daftar resmi di <b>Sheet 2 (Rencana Kinerja Anggota)</b> atau <b>Sheet 3 (Rencana Kinerja Ketua Tim)</b>. Baris yang tidak sesuai akan otomatis ditolak dan tidak dimasukkan ke database.
            </div>
          </div>

          {/* PARSED DATA PREVIEW */}
          {parsedRows.length > 0 && (
            <div className="space-y-4">
              
              {/* STATUS SUMMARY PILLS & TABS */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilterTab('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      filterTab === 'all' 
                        ? 'bg-slate-800 text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Semua ({parsedRows.length})
                  </button>
                  <button
                    onClick={() => setFilterTab('valid')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      filterTab === 'valid' 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Valid Siap Simpan ({validRows.length})
                  </button>
                  <button
                    onClick={() => setFilterTab('invalid')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      filterTab === 'invalid' 
                        ? 'bg-rose-600 text-white shadow-xs' 
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Tidak Sesuai / Gagal ({invalidRows.length})
                  </button>
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  {validRows.length > 0 ? (
                    <span className="text-emerald-700 font-bold">
                      ✓ {validRows.length} kegiatan akan dimasukkan ke database
                    </span>
                  ) : (
                    <span className="text-rose-600 font-bold">
                      Belum ada data valid untuk disimpan
                    </span>
                  )}
                </div>
              </div>

              {/* DATA TABLE */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-bold z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-16">Baris</th>
                        <th className="py-2.5 px-3 w-28">Status</th>
                        <th className="py-2.5 px-3 w-32">Tanggal & Jam</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Rencana Kinerja SKP</th>
                        <th className="py-2.5 px-3 min-w-[180px]">Kegiatan</th>
                        <th className="py-2.5 px-3 w-24">Progres</th>
                        <th className="py-2.5 px-3 min-w-[150px]">Keterangan Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedRows.map((row) => (
                        <tr 
                          key={row.rowNumber}
                          className={row.isValid ? 'hover:bg-emerald-50/30' : 'bg-rose-50/40 hover:bg-rose-50/60'}
                        >
                          <td className="py-2.5 px-3 font-mono text-slate-500">
                            #{row.rowNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                                <Check className="w-3 h-3" /> Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
                                <X className="w-3 h-3" /> Gagal
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{row.sanitizedDate || row.rawTanggal || '-'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{row.rawJamMulai} - {row.rawJamSelesai}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            {row.isValid ? (
                              <div>
                                <span className="font-bold text-slate-800 block line-clamp-2">
                                  {row.matchedPlan?.indicator || row.rawRencanaKinerja}
                                </span>
                                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                                  ✓ Cocok: {row.matchedPlan?.team}
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="font-bold text-rose-700 block line-clamp-2 line-through">
                                  {row.rawRencanaKinerja || '(Kosong)'}
                                </span>
                                <span className="text-[10px] text-rose-600 font-semibold mt-0.5 block">
                                  Tidak ditemukan di daftar SKP
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-slate-700 line-clamp-2">
                              {row.rawKegiatan || '-'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-800">{row.rawProgres}%</span>
                          </td>
                          <td className="py-2.5 px-3">
                            {row.isValid ? (
                              <span className="text-emerald-700 text-[11px] font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Siap diinput
                              </span>
                            ) : (
                              <span className="text-rose-700 text-[11px] font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" /> {row.errorReason}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0 ? (
              <span>
                <b>{validRows.length}</b> dari {parsedRows.length} baris dapat diinput. {invalidRows.length > 0 && `(${invalidRows.length} baris tidak sesuai akan diabaikan).`}
              </span>
            ) : (
              <span>Silakan pilih file Excel (.xlsx) untuk memulai preview.</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetAndClose}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveValidActivities}
              disabled={isSaving || validRows.length === 0}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all ${
                validRows.length > 0 && !isSaving
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Menyimpan ke Database...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Simpan {validRows.length} Kegiatan Valid ke Database
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
