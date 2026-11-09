/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Activity, Team, UserAccount, PerformancePlan } from '../types';
import { 
  Medal, Award, Users, FileText, Download, Printer, 
  Search, Calendar, ChevronDown, ChevronUp, Sparkles, Zap, 
  TrendingUp, CheckCircle2, AlertCircle, Target, ArrowUpDown, Info,
  Filter, Layers, CheckCircle, BarChart3, HelpCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface IkuLeaderboardProps {
  allActivities: Activity[];
  users: UserAccount[];
  teams: Team[];
  performancePlans: PerformancePlan[];
  onNotify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export interface IkuContributorRow {
  employeeName: string;
  employeeEmail?: string;
  team: string;
  nip?: string;
  planId?: string;
  iku: string;
  targetIku: string | number;
  rencanaKinerjaKetua: string;
  bobotRkKetua: number;
  rencanaKinerjaAnggota: string;
  bobotRkAnggota: number;
  targetOutput: number;
  unit: string;
  totalRealisasi: number;
  persentaseRealisasi: number;
  kontribusiIku: number; // in %
  activitiesCount: number;
}

export interface EmployeeIkuBreakdownItem {
  iku: string;
  targetIku: string | number;
  kontribusiIku: number;
  totalRealisasi: number;
  activitiesCount: number;
  rkCount: number;
  rkAnggotaList: {
    nama: string;
    rkKetua: string;
    bobotKetua: number;
    bobotAnggota: number;
    realisasi: number;
    target: number;
    unit: string;
    persentaseRealisasi: number;
    kontribusi: number;
  }[];
}

export interface EmployeeIkuSummary {
  employeeName: string;
  employeeEmail?: string;
  team: string;
  nip?: string;
  totalKontribusiIku: number;
  totalRealisasi: number;
  activitiesCount: number;
  rkCount: number;
  rkItems: IkuContributorRow[];
  ikuBreakdown: EmployeeIkuBreakdownItem[];
}

export default function IkuLeaderboard({
  allActivities,
  users,
  teams,
  performancePlans = [],
  onNotify
}: IkuLeaderboardProps) {
  // Period filter state
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [periodType, setPeriodType] = useState<'all' | 'current' | 'custom'>('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIku, setSelectedIku] = useState<string>('ALL');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'per-pegawai' | 'per-rk'>('per-pegawai');
  const [sortBy, setSortBy] = useState<'contribution' | 'realisasi' | 'activities'>('contribution');
  const [expandedEmployees, setExpandedEmployees] = useState<Record<string, boolean>>({});

  const toggleExpand = (empName: string) => {
    setExpandedEmployees(prev => ({
      ...prev,
      [empName]: !prev[empName]
    }));
  };

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // 1. Filter activities by chosen period
  const filteredActivities = useMemo(() => {
    return allActivities.filter(act => {
      if (!act.date) return false;
      const [yearStr, monthStr] = act.date.split('-');
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);

      if (periodType === 'current') {
        return y === currentYear && m === currentMonth;
      }
      if (periodType === 'custom') {
        return y === selectedYear && m === selectedMonth;
      }
      return true; // 'all'
    });
  }, [allActivities, periodType, currentYear, currentMonth, selectedYear, selectedMonth]);

  // 2. Build list of distinct IKUs from performancePlans
  const ikuList = useMemo(() => {
    const map = new Map<string, {
      name: string;
      targetIku: string | number;
      team: string;
      plansCount: number;
    }>();

    performancePlans.forEach(p => {
      const ikuName = p.iku?.trim() || 'IKU Tim Kerja';
      if (!map.has(ikuName)) {
        map.set(ikuName, {
          name: ikuName,
          targetIku: p.targetIku || '100%',
          team: p.team,
          plansCount: 1
        });
      } else {
        const item = map.get(ikuName)!;
        item.plansCount += 1;
      }
    });

    return Array.from(map.values());
  }, [performancePlans]);

  // Helper: Match activity to performance plan
  const findMatchingPlan = (act: Activity): PerformancePlan | undefined => {
    if (act.performancePlanId) {
      const found = performancePlans.find(p => p.id === act.performancePlanId);
      if (found) return found;
    }
    if (act.rencana_kinerja) {
      const foundById = performancePlans.find(p => p.id === act.rencana_kinerja);
      if (foundById) return foundById;
      const rkLower = act.rencana_kinerja.trim().toLowerCase();
      const foundByName = performancePlans.find(p => 
        (p.rencanaKinerjaAnggota && p.rencanaKinerjaAnggota.trim().toLowerCase() === rkLower) ||
        (p.indicator && p.indicator.trim().toLowerCase() === rkLower)
      );
      if (foundByName) return foundByName;
    }
    if (act.performancePlanTitle) {
      const titleLower = act.performancePlanTitle.trim().toLowerCase();
      const foundByTitle = performancePlans.find(p => 
        (p.rencanaKinerjaAnggota && p.rencanaKinerjaAnggota.trim().toLowerCase() === titleLower) ||
        (p.indicator && p.indicator.trim().toLowerCase() === titleLower)
      );
      if (foundByTitle) return foundByTitle;
    }
    return undefined;
  };

  // 3. Compute Hierarchical Contribution per Activity Group
  // (Mengelompokkan aktivitas untuk pegawai yang sama dan Rencana Kinerja Anggota yang sama)
  const allContributorRows: IkuContributorRow[] = useMemo(() => {
    // Group key: `${employeeName}:::${rkPlanKey}`
    const groups: Record<string, {
      employeeName: string;
      employeeEmail?: string;
      team: string;
      matchedPlan?: PerformancePlan;
      rkKey: string;
      totalRealisasi: number;
      activitiesCount: number;
    }> = {};

    filteredActivities.forEach(act => {
      const empName = act.employeeName || 'Pegawai';
      const matchedPlan = findMatchingPlan(act);
      const rkKey = matchedPlan?.id || act.rencana_kinerja || act.performancePlanTitle || act.subActivity || 'Kegiatan Umum';
      const compositeKey = `${empName}:::${rkKey}`;

      if (!groups[compositeKey]) {
        groups[compositeKey] = {
          employeeName: empName,
          employeeEmail: act.email,
          team: act.team || 'Tim Kerja',
          matchedPlan,
          rkKey,
          totalRealisasi: 0,
          activitiesCount: 0
        };
      }

      groups[compositeKey].totalRealisasi += (Number(act.realisasi) || 0);
      groups[compositeKey].activitiesCount += 1;
    });

    // Transform each group into a full IkuContributorRow
    return Object.values(groups).map(g => {
      const plan = g.matchedPlan;
      const targetOutput = plan ? Number(plan.targetOutput) || 1 : 1;
      const unit = plan?.unit || 'Dokumen';
      const bobotKetuaRaw = plan ? Number(plan.bobotRkKetua) || 50 : 50;
      const bobotAnggotaRaw = plan ? Number(plan.bobotRkAnggota ?? plan.weight) || 20 : 20;

      const bobotKetuaDec = bobotKetuaRaw > 1 ? bobotKetuaRaw / 100 : bobotKetuaRaw;
      const bobotAnggotaDec = bobotAnggotaRaw > 1 ? bobotAnggotaRaw / 100 : bobotAnggotaRaw;

      // Persentase Realisasi Anggota = Realisasi Anggota / Target Anggota * 100%
      const persentaseRealisasi = targetOutput > 0 
        ? (g.totalRealisasi / targetOutput) * 100 
        : 0;

      // Kontribusi Anggota terhadap IKU = Persentase Realisasi * Bobot RK Anggota * Bobot RK Ketua
      const kontribusiIku = persentaseRealisasi * bobotAnggotaDec * bobotKetuaDec;

      // Find user info for NIP
      const userObj = users.find(u => 
        u.name.toLowerCase() === g.employeeName.toLowerCase() || 
        (g.employeeEmail && u.email.toLowerCase() === g.employeeEmail.toLowerCase())
      );

      return {
        employeeName: g.employeeName,
        employeeEmail: g.employeeEmail || userObj?.email,
        team: userObj?.team || g.team,
        nip: userObj?.nip || '-',
        planId: plan?.id,
        iku: plan?.iku || 'IKU Tim Kerja',
        targetIku: plan?.targetIku || '100%',
        rencanaKinerjaKetua: plan?.rencanaKinerjaKetua || 'Rencana Kinerja Ketua',
        bobotRkKetua: bobotKetuaRaw,
        rencanaKinerjaAnggota: plan?.rencanaKinerjaAnggota || plan?.indicator || g.rkKey,
        bobotRkAnggota: bobotAnggotaRaw,
        targetOutput,
        unit,
        totalRealisasi: g.totalRealisasi,
        persentaseRealisasi: Math.round(persentaseRealisasi * 10) / 10,
        kontribusiIku: Math.round(kontribusiIku * 100) / 100,
        activitiesCount: g.activitiesCount
      };
    });
  }, [filteredActivities, performancePlans, users]);

  // 4. Filter rows by Selected IKU & Selected Team
  const filteredContributorRows = useMemo(() => {
    return allContributorRows.filter(row => {
      // IKU filter
      if (selectedIku !== 'ALL' && row.iku !== selectedIku) {
        return false;
      }
      // Team filter
      if (selectedTeamFilter !== 'ALL' && row.team !== selectedTeamFilter) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = row.employeeName.toLowerCase().includes(q);
        const matchesRkAnggota = row.rencanaKinerjaAnggota.toLowerCase().includes(q);
        const matchesRkKetua = row.rencanaKinerjaKetua.toLowerCase().includes(q);
        const matchesIku = row.iku.toLowerCase().includes(q);
        if (!matchesName && !matchesRkAnggota && !matchesRkKetua && !matchesIku) {
          return false;
        }
      }
      return true;
    });
  }, [allContributorRows, selectedIku, selectedTeamFilter, searchQuery]);

  // 5. Aggregate by Employee (for the Per-Pegawai View & IKU Podium)
  const employeeSummaries: EmployeeIkuSummary[] = useMemo(() => {
    const map = new Map<string, EmployeeIkuSummary>();

    filteredContributorRows.forEach(row => {
      const key = row.employeeName;
      if (!map.has(key)) {
        map.set(key, {
          employeeName: row.employeeName,
          employeeEmail: row.employeeEmail,
          team: row.team,
          nip: row.nip,
          totalKontribusiIku: 0,
          totalRealisasi: 0,
          activitiesCount: 0,
          rkCount: 0,
          rkItems: [],
          ikuBreakdown: []
        });
      }

      const item = map.get(key)!;
      item.totalKontribusiIku += row.kontribusiIku;
      item.totalRealisasi += row.totalRealisasi;
      item.activitiesCount += row.activitiesCount;
      item.rkCount += 1;
      item.rkItems.push(row);
    });

    const list = Array.from(map.values()).map(e => {
      // Group employee's rkItems by IKU to know what IKUs make up their contribution
      const ikuGroups: Record<string, EmployeeIkuBreakdownItem> = {};
      e.rkItems.forEach(row => {
        const ikuKey = row.iku || 'IKU Tim Kerja';
        if (!ikuGroups[ikuKey]) {
          ikuGroups[ikuKey] = {
            iku: ikuKey,
            targetIku: row.targetIku || '100%',
            kontribusiIku: 0,
            totalRealisasi: 0,
            activitiesCount: 0,
            rkCount: 0,
            rkAnggotaList: []
          };
        }
        ikuGroups[ikuKey].kontribusiIku += row.kontribusiIku;
        ikuGroups[ikuKey].totalRealisasi += row.totalRealisasi;
        ikuGroups[ikuKey].activitiesCount += row.activitiesCount;
        ikuGroups[ikuKey].rkCount += 1;
        ikuGroups[ikuKey].rkAnggotaList.push({
          nama: row.rencanaKinerjaAnggota,
          rkKetua: row.rencanaKinerjaKetua,
          bobotKetua: row.bobotRkKetua,
          bobotAnggota: row.bobotRkAnggota,
          realisasi: row.totalRealisasi,
          target: row.targetOutput,
          unit: row.unit,
          persentaseRealisasi: row.persentaseRealisasi,
          kontribusi: row.kontribusiIku
        });
      });

      const ikuBreakdown = Object.values(ikuGroups).map(g => ({
        ...g,
        kontribusiIku: Math.round(g.kontribusiIku * 100) / 100
      })).sort((a, b) => b.kontribusiIku - a.kontribusiIku);

      return {
        ...e,
        totalKontribusiIku: Math.round(e.totalKontribusiIku * 100) / 100,
        ikuBreakdown
      };
    });

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'contribution') {
        if (b.totalKontribusiIku !== a.totalKontribusiIku) {
          return b.totalKontribusiIku - a.totalKontribusiIku;
        }
        return b.totalRealisasi - a.totalRealisasi;
      }
      if (sortBy === 'realisasi') {
        return b.totalRealisasi - a.totalRealisasi;
      }
      return b.activitiesCount - a.activitiesCount;
    });

    return list;
  }, [filteredContributorRows, sortBy]);

  // 6. Selected IKU Overall Metrics & Capaian
  const currentIkuMeta = useMemo(() => {
    if (selectedIku === 'ALL') {
      const totalCont = employeeSummaries.reduce((sum, e) => sum + e.totalKontribusiIku, 0);
      return {
        title: 'Semua Indikator Kinerja Utama (IKU)',
        targetIku: '100%',
        team: 'Seluruh Tim Kerja',
        capaianPct: Math.round(totalCont * 10) / 10,
        totalContributors: employeeSummaries.length,
        totalReal: employeeSummaries.reduce((sum, e) => sum + e.totalRealisasi, 0)
      };
    }

    const matched = ikuList.find(i => i.name === selectedIku);
    const ikuRows = allContributorRows.filter(r => r.iku === selectedIku);
    const sumContrib = ikuRows.reduce((sum, r) => sum + r.kontribusiIku, 0);
    const sumReal = ikuRows.reduce((sum, r) => sum + r.totalRealisasi, 0);
    const distinctContributors = new Set(ikuRows.map(r => r.employeeName)).size;

    return {
      title: selectedIku,
      targetIku: matched?.targetIku || '100%',
      team: matched?.team || 'Tim Kerja Pengampu',
      capaianPct: Math.round(sumContrib * 10) / 10,
      totalContributors: distinctContributors,
      totalReal: sumReal
    };
  }, [selectedIku, ikuList, allContributorRows, employeeSummaries]);

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const dataToExport = filteredContributorRows.map((row, idx) => ({
        'No': idx + 1,
        'Nama Pegawai': row.employeeName,
        'NIP': row.nip || '-',
        'Tim': row.team,
        'IKU': row.iku,
        'Target IKU': row.targetIku,
        'Rencana Kinerja Ketua': row.rencanaKinerjaKetua,
        'Bobot RK Ketua (%)': `${row.bobotRkKetua}%`,
        'Rencana Kinerja Anggota': row.rencanaKinerjaAnggota,
        'Bobot RK Anggota (%)': `${row.bobotRkAnggota}%`,
        'Target RK': row.targetOutput,
        'Satuan': row.unit,
        'Total Realisasi': row.totalRealisasi,
        'Capaian RK Anggota (%)': `${row.persentaseRealisasi}%`,
        'Kontribusi ke IKU (%)': `${row.kontribusiIku.toFixed(2)}%`,
        'Jumlah Aktivitas': row.activitiesCount
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leaderboard IKU');
      XLSX.writeFile(wb, `LEADERBOARD_IKU_${selectedIku.substring(0, 15).replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);

      if (onNotify) onNotify('Data Leaderboard IKU berhasil diekspor ke Excel!', 'success');
    } catch {
      if (onNotify) onNotify('Gagal mengekspor data Excel.', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8" id="iku-leaderboard-view">
      
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-indigo-700/60 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider text-indigo-200">
              <Target className="w-3.5 h-3.5 text-indigo-300" />
              <span>Leaderboard Kontribusi Kinerja</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">
              Leaderboard Top Kontributor Pegawai
            </h1>
            <p className="text-indigo-200 text-xs sm:text-sm max-w-2xl font-medium leading-relaxed">
              Peringkat akumulasi seluruh capaian IKU. Menampilkan kontribusi nyata pegawai secara terpadu beserta komposisi IKU yang menyusun capaian masing-masing pegawai.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-md transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" /> Unduh Laporan (.xlsx)
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-2xl border border-white/20 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Cetak
            </button>
          </div>
        </div>

        {/* METRICS STRIP: CAPAIAN IKU TERPILIH */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-indigo-700/60">
          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] text-indigo-200 uppercase font-semibold tracking-wider block">Mode Tampilan</span>
            <span className="font-extrabold text-sm text-white truncate block mt-0.5" title={currentIkuMeta.title}>
              {selectedIku === 'ALL' ? 'Semua IKU (Gabungan)' : currentIkuMeta.title}
            </span>
            <span className="text-[10px] text-indigo-300 font-mono">Target: {currentIkuMeta.targetIku}</span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] text-indigo-200 uppercase font-semibold tracking-wider block">Akumulasi Capaian IKU</span>
            <span className="font-black text-2xl font-mono text-emerald-300 block mt-0.5">
              {currentIkuMeta.capaianPct}%
            </span>
            <span className="text-[10px] text-emerald-200">Total kontribusi terhitung</span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] text-indigo-200 uppercase font-semibold tracking-wider block">Kontributor Aktif</span>
            <span className="font-black text-2xl font-mono text-white block mt-0.5">
              {currentIkuMeta.totalContributors}
            </span>
            <span className="text-[10px] text-indigo-300">Pegawai berpartisipasi</span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] text-indigo-200 uppercase font-semibold tracking-wider block">Total Realisasi Anggota</span>
            <span className="font-black text-2xl font-mono text-amber-300 block mt-0.5">
              {currentIkuMeta.totalReal}
            </span>
            <span className="text-[10px] text-amber-200">Output aktivitas tercatat</span>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS: PERIOD & IKU SELECTOR */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
        
        {/* IKU SELECTOR DROPDOWN */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="iku-select" className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
              <Target className="w-4 h-4 text-indigo-600" /> Pilih Indikator Kinerja Utama (IKU):
            </label>
            <span className="text-xs text-slate-400 font-medium">
              {ikuList.length} IKU Terdaftar
            </span>
          </div>

          <div className="relative">
            <select
              id="iku-select"
              value={selectedIku}
              onChange={(e) => setSelectedIku(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs appearance-none pr-10"
            >
              <option value="ALL">⭐ Semua IKU (Gabungan Seluruh Kontribusi)</option>
              {ikuList.map((iku, idx) => (
                <option key={iku.name} value={iku.name}>
                  #{idx + 1} {iku.name} (Target: {iku.targetIku}) • {iku.team}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* SECONDARY CONTROLS: PERIOD, TEAM, SEARCH, SORT */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          
          {/* Period Selector */}
          <div className="md:col-span-4 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPeriodType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                periodType === 'all' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-50 text-slate-500'
              }`}
            >
              Semua Periode
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('current')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                periodType === 'current' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-50 text-slate-500'
              }`}
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('custom')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                periodType === 'custom' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-50 text-slate-500'
              }`}
            >
              Pilih Bulan
            </button>
          </div>

          {/* Search bar */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari pegawai, rencana kinerja..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Sort & View Mode */}
          <div className="md:col-span-4 flex items-center justify-end gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('per-pegawai')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'per-pegawai' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                }`}
              >
                Per Pegawai
              </button>
              <button
                type="button"
                onClick={() => setViewMode('per-rk')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'per-rk' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                }`}
              >
                Rincian RK
              </button>
            </div>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-hidden"
            >
              <option value="contribution">🎯 Tertinggi Kontribusi IKU</option>
              <option value="realisasi">📊 Total Realisasi</option>
              <option value="activities">📝 Jumlah Aktivitas</option>
            </select>
          </div>

        </div>

        {/* Custom Month/Year Dropdown when 'custom' is active */}
        {periodType === 'custom' && (
          <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600" /> Pilih Periode:
            </span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(parseInt(e.target.value, 10))}
              className="py-1.5 px-3 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-700"
            >
              {monthNames.map((name, i) => (
                <option key={name} value={i + 1}>{name}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
              className="py-1.5 px-3 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-700"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(yr => (
                <option key={yr} value={yr}>Tahun {yr}</option>
              ))}
            </select>
          </div>
        )}

      </div>


      {/* FORMULA CALLOUT */}
      <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-3xl p-5 text-xs text-indigo-950 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-extrabold text-indigo-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-600" />
            Dasar Perhitungan Kontribusi Pegawai terhadap Indikator Kinerja Utama (IKU)
          </span>
          <span className="text-[10px] font-mono font-bold text-indigo-700 bg-white px-2.5 py-0.5 rounded-full border border-indigo-100">
            Hierarki: IKU → RK Ketua → RK Anggota → Realisasi
          </span>
        </div>
        <p className="text-[11px] text-slate-700 leading-relaxed font-mono bg-white p-3 rounded-2xl border border-indigo-100 shadow-2xs">
          <strong>Kontribusi Pegawai ke IKU (%)</strong> = (Total Realisasi Anggota / Target RK Anggota) × (Bobot RK Anggota / 100) × (Bobot RK Ketua / 100) × 100%
        </p>
        <p className="text-[10px] text-slate-500">
          * Seluruh aktivitas pegawai untuk rencana kinerja anggota yang sama dijumlahkan secara otomatis. Capaian dari seluruh rencana kinerja yang didukung pegawai diakumulasikan menjadi Total Kontribusi IKU.
        </p>
      </div>

      {/* LEADERBOARD TABLE */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm font-display flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" />
              Tabel Leaderboard Kontributor ({viewMode === 'per-pegawai' ? 'Ringkasan per Pegawai & Rincian IKU' : 'Rincian per Rencana Kinerja'})
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Menampilkan {viewMode === 'per-pegawai' ? employeeSummaries.length : filteredContributorRows.length} baris data kontribusi
            </p>
          </div>

          <div className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
            Filter Aktif: <strong className="text-indigo-700">{selectedIku}</strong>
          </div>
        </div>

        {viewMode === 'per-pegawai' ? (
          /* TABEL PER PEGAWAI */
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
              <thead className="bg-slate-50/75 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 text-center">Peringkat</th>
                  <th className="px-4 py-3.5">Nama Pegawai &amp; Tim</th>
                  <th className="px-4 py-3.5">Tersusun dari IKU (Komposisi)</th>
                  <th className="px-4 py-3.5 text-center">RK Didukung</th>
                  <th className="px-4 py-3.5 text-center">Total Realisasi</th>
                  <th className="px-4 py-3.5 text-center">Log Aktivitas</th>
                  <th className="px-4 py-3.5 text-right">Total Kontribusi</th>
                  <th className="px-4 py-3.5 text-center">Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employeeSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      Belum ada data kontribusi aktivitas untuk periode atau filter yang dipilih.
                    </td>
                  </tr>
                ) : (
                  employeeSummaries.map((emp, index) => {
                    const rank = index + 1;
                    const isExpanded = !!expandedEmployees[emp.employeeName];

                    return (
                      <React.Fragment key={emp.employeeName}>
                        <tr 
                          onClick={() => toggleExpand(emp.employeeName)}
                          className={`hover:bg-slate-50/90 transition-colors cursor-pointer ${
                            rank === 1 ? 'bg-amber-50/20' : rank === 2 ? 'bg-slate-50/40' : rank === 3 ? 'bg-orange-50/20' : ''
                          }`}
                        >
                          <td className="px-4 py-3.5 text-center">
                            {rank === 1 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-400 text-amber-950 font-black text-xs shadow-xs">
                                🏆 1
                              </span>
                            ) : rank === 2 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-300 text-slate-800 font-black text-xs shadow-xs">
                                🥈 2
                              </span>
                            ) : rank === 3 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-orange-300 text-orange-950 font-black text-xs shadow-xs">
                                🥉 3
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-100 text-slate-600 font-mono font-bold text-xs">
                                {rank}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="font-extrabold text-slate-900 text-xs">
                              {emp.employeeName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {emp.team} • NIP: {emp.nip || '-'}
                            </div>
                          </td>

                          {/* KOLOM TERSUSUN DARI IKU APA AJA */}
                          <td className="px-4 py-3.5 max-w-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {emp.ikuBreakdown.map((b, bIdx) => (
                                <span
                                  key={bIdx}
                                  className="inline-flex items-center gap-1 text-[10px] bg-slate-50 hover:bg-indigo-50/80 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs transition-colors"
                                  title={`${b.iku} - Target: ${b.targetIku} (${b.rkCount} RK)`}
                                >
                                  <span className="font-medium text-slate-700 max-w-[120px] truncate">{b.iku}</span>
                                  <span className="font-mono font-black text-indigo-700 bg-indigo-50/90 px-1 py-0.2 rounded">
                                    +{b.kontribusiIku.toFixed(1)}%
                                  </span>
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-block bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-md font-mono font-bold text-[11px]">
                              {emp.rkCount} RK
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-800">
                            {emp.totalRealisasi} output
                          </td>

                          <td className="px-4 py-3.5 text-center font-mono text-slate-600">
                            {emp.activitiesCount} kegiatan
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <span className="font-mono font-black text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl shadow-2xs">
                              +{emp.totalKontribusiIku.toFixed(2)}% IKU
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(emp.employeeName);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title={isExpanded ? 'Tutup Rincian' : 'Lihat Susunan IKU & RK'}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </td>
                        </tr>

                        {/* SUB-ROW: RINCIAN KOMPOSISI IKU PENYUSUN KONTRIBUSI */}
                        {isExpanded && (
                          <tr className="bg-indigo-50/30 border-y border-indigo-100">
                            <td colSpan={8} className="px-6 py-4">
                              <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-indigo-100/70 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <Target className="w-4 h-4 text-indigo-600" />
                                    <span className="font-extrabold text-xs text-indigo-950">
                                      Rincian IKU &amp; Rencana Kinerja Penyusun Kontribusi: <strong className="text-slate-900">{emp.employeeName}</strong>
                                    </span>
                                  </div>
                                  <span className="text-[11px] font-mono text-indigo-700 bg-white border border-indigo-200 px-2.5 py-0.5 rounded-lg font-bold">
                                    Total Kontribusi Terakumulasi: +{emp.totalKontribusiIku.toFixed(2)}% IKU
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {emp.ikuBreakdown.map((b, bIdx) => (
                                    <div key={bIdx} className="bg-white p-3.5 rounded-2xl border border-indigo-100/80 shadow-2xs space-y-2.5">
                                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                                        <div>
                                          <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider block">Indikator Kinerja Utama (IKU)</span>
                                          <span className="font-black text-xs text-slate-900 leading-snug">{b.iku}</span>
                                          <span className="text-[10px] text-slate-400 font-mono">Target IKU: {b.targetIku}</span>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                          <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-semibold">Sub-Kontribusi</span>
                                          <span className="font-mono font-black text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg">
                                            +{b.kontribusiIku.toFixed(2)}%
                                          </span>
                                        </div>
                                      </div>

                                      <div className="space-y-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                          Rencana Kinerja Pendukung ({b.rkAnggotaList.length}):
                                        </span>
                                        {b.rkAnggotaList.map((rk, rkIdx) => (
                                          <div key={rkIdx} className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-[11px] space-y-1">
                                            <div className="font-bold text-slate-900 leading-snug">{rk.nama}</div>
                                            <div className="text-[10px] text-slate-500 font-mono flex flex-wrap gap-x-3 gap-y-0.5">
                                              <span>RK Ketua: <strong>{rk.rkKetua}</strong> (Bobot {rk.bobotKetua}%)</span>
                                              <span>Bobot Anggota: <strong>{rk.bobotAnggota}%</strong></span>
                                              <span>Realisasi: <strong>{rk.realisasi}/{rk.target} {rk.unit}</strong> ({rk.persentaseRealisasi}%)</span>
                                              <span className="text-emerald-700 font-bold">Kontribusi RK: +{rk.kontribusi.toFixed(2)}%</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* TABEL RINCIAN PER RENCANA KINERJA */
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
              <thead className="bg-slate-50/75 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Pegawai &amp; Tim</th>
                  <th className="px-4 py-3.5">IKU (Target)</th>
                  <th className="px-4 py-3.5">RK Ketua (Bobot)</th>
                  <th className="px-4 py-3.5">RK Anggota (Bobot)</th>
                  <th className="px-4 py-3.5 text-center">Realisasi / Target</th>
                  <th className="px-4 py-3.5 text-center">Capaian RK</th>
                  <th className="px-4 py-3.5 text-right">Kontribusi ke IKU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContributorRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      Belum ada data rincian kontribusi untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  filteredContributorRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 text-xs">{row.employeeName}</div>
                        <span className="text-[10px] text-slate-400 font-mono">{row.team}</span>
                      </td>

                      <td className="px-4 py-3.5 max-w-[180px]">
                        <div className="font-semibold text-slate-800 truncate" title={row.iku}>
                          {row.iku}
                        </div>
                        <span className="text-[10px] text-emerald-700 font-mono font-bold">
                          Target: {row.targetIku}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 max-w-[180px]">
                        <div className="text-slate-800 truncate" title={row.rencanaKinerjaKetua}>
                          {row.rencanaKinerjaKetua}
                        </div>
                        <span className="text-[10px] text-indigo-700 font-mono font-bold">
                          Bobot Ketua: {row.bobotRkKetua}%
                        </span>
                      </td>

                      <td className="px-4 py-3.5 max-w-[200px]">
                        <div className="font-semibold text-slate-900 truncate" title={row.rencanaKinerjaAnggota}>
                          {row.rencanaKinerjaAnggota}
                        </div>
                        <span className="text-[10px] text-purple-700 font-mono font-bold">
                          Bobot Anggota: {row.bobotRkAnggota}% • {row.activitiesCount} log
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap font-mono">
                        <span className="font-bold text-slate-900">{row.totalRealisasi}</span>
                        <span className="text-slate-400"> / {row.targetOutput} {row.unit}</span>
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                          {row.persentaseRealisasi}%
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className="font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs">
                          +{row.kontribusiIku.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
}
