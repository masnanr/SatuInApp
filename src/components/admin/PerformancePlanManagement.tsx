/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PerformancePlan, Team, UNITS, cleanIkuTitle } from '../../types';
import { createPerformancePlan, updatePerformancePlan, deletePerformancePlan, uploadPerformancePlans } from '../../lib/serverApi';
import * as XLSX from 'xlsx';
import { 
  CalendarRange, Plus, Search, Edit3, Trash2, Filter, 
  Target, Award, RefreshCw, XCircle, FileSpreadsheet, CheckCircle2, ChevronRight, Upload, Download 
} from 'lucide-react';

interface PerformancePlanManagementProps {
  plans: PerformancePlan[];
  teams: Team[];
  currentAdminEmail: string;
  currentAdminName: string;
  onRefresh: () => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function PerformancePlanManagement({
  plans,
  teams,
  currentAdminEmail,
  currentAdminName,
  onRefresh,
  onNotify
}: PerformancePlanManagementProps) {
  const currentYear = new Date().getFullYear();
  const availableYears = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [filterTeam, setFilterTeam] = useState<string>('All');
  const [search, setSearch] = useState<string>('');

  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PerformancePlan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Excel Upload Modal State
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [excelPreviewData, setExcelPreviewData] = useState<any[]>([]);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);

  const [formData, setFormData] = useState<{
    year: number;
    team: string;
    iku: string;
    targetIku: string | number;
    rencanaKinerjaKetua: string;
    bobotRkKetua: number;
    rencanaKinerjaAnggota: string;
    indicator: string;
    targetOutput: number;
    unit: string;
    weight: number;
    realisasi: number;
    status: 'active' | 'archived';
  }>({
    year: currentYear,
    team: teams[0]?.name || 'Tim Statistik Sosial',
    iku: '',
    targetIku: '100%',
    rencanaKinerjaKetua: '',
    bobotRkKetua: 50,
    rencanaKinerjaAnggota: '',
    indicator: '',
    targetOutput: 10,
    unit: 'Dokumen',
    weight: 20,
    realisasi: 0,
    status: 'active'
  });

  const handleOpenAdd = () => {
    setEditingPlan(null);
    setFormData({
      year: selectedYear,
      team: filterTeam !== 'All' ? filterTeam : (teams[0]?.name || 'Tim Statistik Sosial'),
      iku: '',
      targetIku: '100%',
      rencanaKinerjaKetua: '',
      bobotRkKetua: 50,
      rencanaKinerjaAnggota: '',
      indicator: '',
      targetOutput: 10,
      unit: 'Dokumen',
      weight: 20,
      realisasi: 0,
      status: 'active'
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (plan: PerformancePlan) => {
    setEditingPlan(plan);
    setFormData({
      year: plan.year,
      team: plan.team,
      iku: plan.iku || '',
      targetIku: plan.targetIku || '100%',
      rencanaKinerjaKetua: plan.rencanaKinerjaKetua || '',
      bobotRkKetua: plan.bobotRkKetua || 50,
      rencanaKinerjaAnggota: plan.rencanaKinerjaAnggota || plan.indicator || '',
      indicator: plan.indicator || plan.rencanaKinerjaAnggota || '',
      targetOutput: plan.targetOutput,
      unit: plan.unit,
      weight: plan.weight,
      realisasi: plan.realisasi || 0,
      status: plan.status
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const indVal = formData.rencanaKinerjaAnggota || formData.indicator;
    if (!indVal.trim()) {
      onNotify('Rencana Kinerja Anggota wajib diisi.', 'error');
      return;
    }

    const payload = {
      ...formData,
      iku: cleanIkuTitle(formData.iku),
      indicator: indVal,
      rencanaKinerjaAnggota: indVal
    };

    setIsSubmitting(true);
    try {
      if (editingPlan) {
        const res = await updatePerformancePlan(editingPlan.id, payload, currentAdminEmail, currentAdminName);
        if (res.success) {
          onNotify(`Rencana Kinerja Tahun ${formData.year} berhasil diperbarui.`, 'success');
          setIsFormOpen(false);
          onRefresh();
        } else {
          onNotify(res.message || 'Gagal memperbarui rencana kinerja.', 'error');
        }
      } else {
        const res = await createPerformancePlan(payload, currentAdminEmail, currentAdminName);
        if (res.success) {
          onNotify(`Rencana Kinerja Tahun ${formData.year} berhasil ditambahkan ke Database Server!`, 'success');
          setIsFormOpen(false);
          onRefresh();
        } else {
          onNotify(res.message || 'Gagal menambahkan rencana kinerja.', 'error');
        }
      }
    } catch (err: any) {
      onNotify(err.message || 'Terjadi kesalahan.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (plan: PerformancePlan) => {
    const confirm = window.confirm(`Hapus Rencana Kinerja Tahun ${plan.year}: "${plan.indicator || plan.rencanaKinerjaAnggota}"?`);
    if (!confirm) return;

    try {
      const res = await deletePerformancePlan(plan.id, currentAdminEmail, currentAdminName);
      if (res.success) {
        onNotify('Rencana kinerja berhasil dihapus.', 'success');
        onRefresh();
      } else {
        onNotify(res.message || 'Gagal menghapus.', 'error');
      }
    } catch {
      onNotify('Gagal menghapus rencana kinerja.', 'error');
    }
  };

  // Excel handlers
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Tim': teams[0]?.name || 'Tim Statistik Sosial',
        'IKU': 'Kualitas Data Statistik',
        'Target IKU': '100%',
        'Rencana Kinerja Ketua': 'Koordinasi Survei Sosial',
        'Bobot RK Ketua': 50,
        'Rencana Kinerja Anggota': 'Terlaksananya Survei Angkatan Kerja Nasional (Sakernas)',
        'Bobot RK Anggota': 50,
        'Target': 120,
        'Satuan': 'Dokumen'
      },
      {
        'Tim': teams[1]?.name || 'Tim Statistik Distribusi',
        'IKU': 'Indeks Harga dan Distribusi',
        'Target IKU': '100%',
        'Rencana Kinerja Ketua': 'Pengawasan Survei IHK',
        'Bobot RK Ketua': 50,
        'Rencana Kinerja Anggota': 'Survei Pemantauan Indeks Harga Konsumen (IHK) Mingguan',
        'Bobot RK Anggota': 50,
        'Target': 52,
        'Satuan': 'Laporan'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RencanaKinerja');
    XLSX.writeFile(wb, 'Template_Rencana_Kinerja.xlsx');
    onNotify('Template Excel Rencana Kinerja berhasil diunduh.', 'success');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          onNotify('File Excel kosong atau format tidak sesuai.', 'error');
          return;
        }

        const formatted = data.map((row: any) => {
          const rawTeam = String(row['Tim'] || row.team || row['Tim Pelaksana'] || teams[0]?.name || 'Tim Statistik Sosial');
          const cleanInput = rawTeam.toLowerCase().replace(/tim|bagian|statistik|\s+/g, '').trim();
          const matchedTeamObj = teams.find(t => t.name.toLowerCase() === rawTeam.toLowerCase()) ||
            teams.find(t => {
              const cn = t.name.toLowerCase().replace(/tim|bagian|statistik|\s+/g, '').trim();
              return cn.includes(cleanInput) || cleanInput.includes(cn) ||
                     (cleanInput.includes('sosial') && t.name.toLowerCase().includes('sosial')) ||
                     (cleanInput.includes('produksi') && t.name.toLowerCase().includes('produksi')) ||
                     (cleanInput.includes('distribusi') && t.name.toLowerCase().includes('distribusi')) ||
                     (cleanInput.includes('neraca') && t.name.toLowerCase().includes('neraca')) ||
                     (cleanInput.includes('ipds') && t.name.toLowerCase().includes('ipds')) ||
                     (cleanInput.includes('umum') && t.name.toLowerCase().includes('umum'));
            }) || teams[0];

          const indVal = String(row['Rencana Kinerja Anggota'] || row.rencanaKinerjaAnggota || row.indicator || row.Indikator || '');
          const bobotAnggota = Number(row['Bobot RK Anggota'] ?? row['Bobot'] ?? row.bobotRkAnggota ?? row.weight ?? 10);

          return {
            year: Number(row['Tahun'] || row.year || selectedYear),
            team: matchedTeamObj ? matchedTeamObj.name : rawTeam,
            iku: cleanIkuTitle(String(row['IKU'] || row.iku || '')),
            targetIku: row['Target IKU'] || row.targetIku || '100%',
            rencanaKinerjaKetua: String(row['Rencana Kinerja Ketua'] || row.rencanaKinerjaKetua || ''),
            bobotRkKetua: Number(row['Bobot RK Ketua'] || row.bobotRkKetua || 50),
            rencanaKinerjaAnggota: indVal,
            bobotRkAnggota: bobotAnggota,
            indicator: indVal,
            targetOutput: Number(row['Target'] || row.targetOutput || 1),
            unit: String(row['Satuan'] || row.unit || 'Dokumen'),
            weight: bobotAnggota,
            realisasi: Number(row['Realisasi'] || row.realisasi || 0)
          };
        }).filter(r => r.indicator.trim() !== '');

        setExcelPreviewData(formatted);
        onNotify(`Berhasil membaca ${formatted.length} baris dari file Excel.`, 'success');
      } catch (err) {
        onNotify('Gagal membaca file Excel. Pastikan format kolom sesuai template.', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmExcelUpload = async () => {
    if (excelPreviewData.length === 0) {
      onNotify('Tidak ada data untuk diunggah.', 'error');
      return;
    }
    setIsUploadingExcel(true);
    try {
      const res = await uploadPerformancePlans(excelPreviewData, currentAdminEmail, currentAdminName);
      if (res.success) {
        onNotify(`Berhasil mengunggah ${res.count} Rencana Kinerja via Excel ke Database!`, 'success');
        setIsExcelModalOpen(false);
        setExcelPreviewData([]);
        onRefresh();
      } else {
        onNotify(res.message || 'Gagal mengunggah data.', 'error');
      }
    } catch (err: any) {
      onNotify(err.message || 'Terjadi kesalahan.', 'error');
    } finally {
      setIsUploadingExcel(false);
    }
  };

  const filteredPlans = plans.filter(p => {
    const matchYear = p.year === selectedYear;
    const matchTeam = filterTeam === 'All' || p.team === filterTeam;
    const matchSearch = p.indicator.toLowerCase().includes(search.toLowerCase()) || 
                        p.unit.toLowerCase().includes(search.toLowerCase());
    return matchYear && matchTeam && matchSearch;
  });

  const totalWeight = filteredPlans.reduce((acc, curr) => acc + (Number(curr.weight) || 0), 0);

  return (
    <div className="space-y-6" id="performance-plan-management-panel">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-indigo-100 uppercase tracking-wider">
              Perjanjian Kinerja (PK)
            </span>
            <span className="text-xs text-slate-400 font-semibold">• Tahun Anggaran: {selectedYear}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display mt-1">
            Master Rencana Kinerja Tahunan
          </h1>
          <p className="text-sm text-slate-500">
            Kelola target indikator kinerja per tim kerja untuk setiap tahun anggaran (input manual atau upload Excel).
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 rounded-xl transition-colors shadow-xs cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            type="button"
            onClick={() => {
              setExcelPreviewData([]);
              setIsExcelModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          >
            <FileSpreadsheet className="w-4 h-4" /> Upload Excel
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> Tambah Rencana Kinerja
          </button>
        </div>
      </div>

      {/* TAHUN SELECTOR DROPDOWN */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <CalendarRange className="w-4 h-4 text-indigo-600" /> Pilih Tahun Anggaran:
          </span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {availableYears.map(yr => (
              <option key={yr} value={yr}>
                Tahun {yr}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs font-bold text-slate-500 bg-indigo-50/70 border border-indigo-100 px-3 py-1.5 rounded-xl">
          Total Rencana: <span className="text-indigo-700 font-extrabold">{filteredPlans.length} Indikator</span> (Bobot: {totalWeight}%)
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-8 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari indikator kinerja atau satuan..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        </div>

        <div className="sm:col-span-4">
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
          >
            <option value="All">Semua Tim Kerja</option>
            {teams.map(t => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* PLANS TABLE */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left">
            <thead>
              <tr className="bg-slate-50/75 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3.5">Tahun / Tim</th>
                <th className="px-4 py-3.5">IKU (Target IKU)</th>
                <th className="px-4 py-3.5">Rencana Kinerja Ketua</th>
                <th className="px-4 py-3.5">Rencana Kinerja Anggota</th>
                <th className="px-4 py-3.5 text-center">Target</th>
                <th className="px-4 py-3.5 text-center">Bobot RK</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-xs">
                    Belum ada rencana kinerja yang didaftarkan untuk Tahun {selectedYear}. Klik tombol <strong>Tambah</strong> atau <strong>Upload Excel</strong> di atas.
                  </td>
                </tr>
              ) : (
                filteredPlans.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono font-extrabold text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded w-max">
                          {p.year}
                        </span>
                        <span className="font-bold text-slate-800 text-xs truncate max-w-[150px]" title={p.team}>
                          {p.team}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 max-w-[200px]">
                      <div className="font-bold text-slate-900 text-xs line-clamp-2" title={p.iku || 'IKU Tim'}>
                        {p.iku || <span className="text-slate-400 italic">Belum dispesifikasi</span>}
                      </div>
                      <span className="inline-block text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 mt-1">
                        Target: {p.targetIku || '100%'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 max-w-[200px]">
                      <div className="font-semibold text-slate-800 text-xs line-clamp-2" title={p.rencanaKinerjaKetua || '-'}>
                        {p.rencanaKinerjaKetua || <span className="text-slate-400 italic">-</span>}
                      </div>
                      <span className="inline-block text-[10px] font-mono text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100 mt-1">
                        Bobot Ketua: {p.bobotRkKetua || 50}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 max-w-[240px]">
                      <div className="font-bold text-slate-900 text-xs line-clamp-2" title={p.rencanaKinerjaAnggota || p.indicator}>
                        {p.rencanaKinerjaAnggota || p.indicator}
                      </div>
                      <span className="inline-block text-[10px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 mt-1">
                        Bobot Anggota: {p.bobotRkAnggota ?? p.weight}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-slate-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                        <Target className="w-3.5 h-3.5 text-amber-600" />
                        {p.targetOutput} {p.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap font-mono text-xs">
                      <div className="font-bold text-slate-800">{p.bobotRkAnggota ?? p.weight}%</div>
                      <div className="text-[10px] text-slate-400">RK Anggota</div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Rencana Kinerja"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Rencana Kinerja"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EXCEL UPLOAD */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-100 shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 font-display flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Upload Rencana Kinerja via Excel (.xlsx / .csv)
                </h3>
                <p className="text-xs text-slate-500">
                  Impor massal target indikator kinerja tahunan untuk seluruh tim kerja.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExcelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Step 1: Download Template */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">1. Unduh Template Excel Standar</h4>
                  <p className="text-[11px] text-slate-500">Gunakan format kolom: year, team, indicator, targetOutput, unit, weight</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-600" /> Unduh Template .xlsx
                </button>
              </div>

              {/* Step 2: Choose File */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">2. Pilih File Excel yang Telah Diisi *</label>
                <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/30 rounded-2xl p-6 text-center hover:bg-emerald-50/60 transition-colors">
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400 mt-2">Format yang didukung: .xlsx, .xls, .csv</p>
                </div>
              </div>

              {/* Preview Table */}
              {excelPreviewData.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Pratinjau Data ({excelPreviewData.length} baris siap diimpor):
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="min-w-full divide-y divide-slate-100 text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Tahun</th>
                          <th className="px-3 py-2 text-left">Tim</th>
                          <th className="px-3 py-2 text-left">Indikator</th>
                          <th className="px-3 py-2 text-center">Target</th>
                          <th className="px-3 py-2 text-center">Bobot</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {excelPreviewData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono font-bold text-indigo-600">{row.year}</td>
                            <td className="px-3 py-2 font-bold text-slate-800">{row.team}</td>
                            <td className="px-3 py-2 text-slate-700">{row.indicator}</td>
                            <td className="px-3 py-2 text-center font-bold">{row.targetOutput} {row.unit}</td>
                            <td className="px-3 py-2 text-center font-mono">{row.weight}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsExcelModalOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={excelPreviewData.length === 0 || isUploadingExcel}
                onClick={handleConfirmExcelUpload}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Upload className="w-4 h-4" /> {isUploadingExcel ? 'Mengunggah...' : `Simpan ${excelPreviewData.length} Data ke Database`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORM TAMBAH / EDIT RENCANA KINERJA */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 font-display">
                  {editingPlan ? 'Edit Rencana Kinerja' : 'Tambah Rencana Kinerja Tahunan'}
                </h3>
                <p className="text-xs text-slate-500">
                  Rencana kinerja akan otomatis muncul sebagai opsi target kegiatan pegawai.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Tahun Anggaran (Wajib) *</label>
                  <input
                    type="number"
                    required
                    min={2020}
                    max={2040}
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-indigo-700 font-mono font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400">Tahun target kinerja dapat disesuaikan tiap tahun.</p>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Tim Pelaksana *</label>
                  <select
                    value={formData.team}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  >
                    {teams.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TINGKAT IKU */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">1. Indikator Kinerja Utama (IKU) *</label>
                  <input
                    type="text"
                    required
                    value={formData.iku}
                    onChange={(e) => setFormData({ ...formData, iku: e.target.value })}
                    placeholder="Contoh: Kualitas Data Statistik Sektoral"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Target IKU</label>
                  <input
                    type="text"
                    value={String(formData.targetIku)}
                    onChange={(e) => setFormData({ ...formData, targetIku: e.target.value })}
                    placeholder="100%"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold font-mono"
                  />
                </div>
              </div>

              {/* TINGKAT RENCANA KINERJA KETUA */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-indigo-50/40 p-3 rounded-2xl border border-indigo-100/60">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-indigo-950">2. Rencana Kinerja Ketua *</label>
                  <input
                    type="text"
                    required
                    value={formData.rencanaKinerjaKetua}
                    onChange={(e) => setFormData({ ...formData, rencanaKinerjaKetua: e.target.value })}
                    placeholder="Contoh: Koordinasi dan Supervisi Survei Sosial"
                    className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-indigo-950">Bobot RK Ketua (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.bobotRkKetua}
                    onChange={(e) => setFormData({ ...formData, bobotRkKetua: Number(e.target.value) })}
                    className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs text-indigo-700 font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* TINGKAT RENCANA KINERJA ANGGOTA */}
              <div className="space-y-1 bg-purple-50/40 p-3 rounded-2xl border border-purple-100/60">
                <label className="block text-xs font-bold text-purple-950">3. Rencana Kinerja Anggota *</label>
                <textarea
                  rows={2}
                  required
                  value={formData.rencanaKinerjaAnggota || formData.indicator}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    rencanaKinerjaAnggota: e.target.value,
                    indicator: e.target.value 
                  })}
                  placeholder="Contoh: Terlaksananya Survei Angkatan Kerja Nasional (Sakernas)"
                  className="w-full bg-white border border-purple-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Bobot RK Anggota (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.bobotRkAnggota ?? formData.weight}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormData({ ...formData, bobotRkAnggota: val, weight: val });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-purple-700 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Target Output Total</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.targetOutput}
                    onChange={(e) => setFormData({ ...formData, targetOutput: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Satuan Output</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : editingPlan ? 'Perbarui Rencana' : 'Simpan ke Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
