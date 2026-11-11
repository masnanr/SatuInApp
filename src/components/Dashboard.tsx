/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Activity, AppSettings, PerformancePlan, TEAMS, UserAccount, Team, DEFAULT_TEAMS } from '../types';
import { motion } from 'motion/react';
import { 
  Users, FileText, CheckCircle, Clock, Percent, 
  TrendingUp, TrendingDown, Star, Award, AlertCircle, Download, Printer, Share2, FileSpreadsheet,
  Trophy, FileWarning, HelpCircle, Layers, Target, ChevronRight, XCircle, Info, Crown, User
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface EmployeeContributionItem {
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
  kontribusiIku: number;
  activitiesCount: number;
}

export interface EmployeeContributionSummary {
  name: string;
  email?: string;
  team: string;
  totalKontribusiIku: number;
  totalRealisasiAll: number;
  totalActivitiesCount: number;
  items: EmployeeContributionItem[];
}

export interface KetuaContributionSummary {
  teamName: string;
  leaderName: string;
  totalKontribusiIku: number;
  totalRealisasiAll: number;
  totalActivitiesCount: number;
  memberCount: number;
  memberContributions: EmployeeContributionSummary[];
}

interface DashboardProps {
  allActivities: Activity[];
  performancePlans?: PerformancePlan[];
  users?: UserAccount[];
  teams?: Team[];
  settings: AppSettings;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function Dashboard({ 
  allActivities, 
  performancePlans = [], 
  users = [],
  teams = [],
  settings, 
  onNotify 
}: DashboardProps) {
  
  // State for Contribution Breakdown Modal & Role Toggle
  const [contributionRoleTab, setContributionRoleTab] = useState<'Anggota' | 'Ketua'>('Anggota');
  const [selectedContributionEmployee, setSelectedContributionEmployee] = useState<EmployeeContributionSummary | null>(null);
  const [selectedContributionKetua, setSelectedContributionKetua] = useState<KetuaContributionSummary | null>(null);
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [isKetuaModalOpen, setIsKetuaModalOpen] = useState(false);
  
  // Dates
  const todayStr = new Date().toISOString().substring(0, 10);
  const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');
  const currentYearStr = String(new Date().getFullYear());

  // 1. FILTER CURRENT PERIOD ACTIVITIES
  const currentMonthActivities = useMemo(() => {
    return allActivities.filter(act => {
      if (!act.date) return false;
      const [year, month] = act.date.split('-');
      return year === currentYearStr && month === currentMonthStr;
    });
  }, [allActivities, currentYearStr, currentMonthStr]);

  const todayActivities = useMemo(() => {
    return allActivities.filter(act => act.date === todayStr);
  }, [allActivities, todayStr]);

  // Define total list of distinct employees in our database (from registered users or existing activities)
  const activeEmployeesList = useMemo(() => {
    const list = new Set<string>();
    
    // Add names from submitted/existing activities
    allActivities.forEach(act => {
      if (act.employeeName && act.employeeName.trim()) list.add(act.employeeName.trim());
    });

    // Also include registered users from database (if any)
    if (users && users.length > 0) {
      users.forEach(u => {
        if (u.name && u.name.trim()) list.add(u.name.trim());
      });
    }

    return Array.from(list);
  }, [allActivities, users]);

  // 2. WIDGET STATS CALCULATIONS
  const stats = useMemo(() => {
    const totalActiveEmployees = activeEmployeesList.length;
    const totalTodayActivities = todayActivities.length;
    const totalMonthActivities = currentMonthActivities.length;
    
    // Count PDFs vs Photos (Photos usually have .png, .jpg, .jpeg, .gif, .webp extensions)
    let countPDF = 0;
    let countPhoto = 0;
    currentMonthActivities.forEach(act => {
      if (act.driveFileId) {
        // Assume file is PDF if it doesn't match an image regex or check standard naming
        const isImage = act.driveLink?.match(/\.(jpg|jpeg|png|gif|webp)/i) || 
                        act.subActivity?.match(/(foto|gambar|dokumentasi|image)/i);
        if (isImage) {
          countPhoto++;
        } else {
          countPDF++;
        }
      }
    });

    const totalDraftActivities = allActivities.filter(act => act.status === 'Draft').length;

    // Daily Entry statistics
    const employeesWhoInputToday = new Set<string>();
    todayActivities.forEach(act => employeesWhoInputToday.add(act.employeeName));
    const countInputToday = employeesWhoInputToday.size;
    
    const percentageInputToday = totalActiveEmployees > 0 
      ? Math.round((countInputToday / totalActiveEmployees) * 100) 
      : 0;
    const percentageNotInputToday = 100 - percentageInputToday;

    // Average employee progress
    const sumProgress = currentMonthActivities.reduce((sum, act) => sum + act.progress, 0);
    const avgProgress = currentMonthActivities.length > 0 
      ? Math.round(sumProgress / currentMonthActivities.length) 
      : 0;

    return {
      totalActiveEmployees,
      totalTodayActivities,
      totalMonthActivities,
      totalPDF: countPDF,
      totalPhoto: countPhoto,
      totalDraft: totalDraftActivities,
      percentageInputToday,
      percentageNotInputToday,
      countNotInputToday: Math.max(0, totalActiveEmployees - countInputToday),
      avgProgress
    };
  }, [allActivities, currentMonthActivities, todayActivities, activeEmployeesList]);

  // 3. LEADERBOARD / RANKING CALCULATIONS
  const rankings = useMemo(() => {
    // Grouping by employee, initialized with all active employees
    const employeeGroup: Record<string, {
      name: string;
      activitiesCount: number;
      uploadsCount: number;
      sumProgress: number;
    }> = {};

    activeEmployeesList.forEach(empName => {
      employeeGroup[empName] = {
        name: empName,
        activitiesCount: 0,
        uploadsCount: 0,
        sumProgress: 0
      };
    });

    currentMonthActivities.forEach(act => {
      if (!employeeGroup[act.employeeName]) {
        employeeGroup[act.employeeName] = {
          name: act.employeeName,
          activitiesCount: 0,
          uploadsCount: 0,
          sumProgress: 0
        };
      }
      employeeGroup[act.employeeName].activitiesCount++;
      if (act.driveFileId) employeeGroup[act.employeeName].uploadsCount++;
      employeeGroup[act.employeeName].sumProgress += act.progress;
    });

    const empList = Object.values(employeeGroup);

    // Only include employees who actually have activities in current month for Peringkat Kegiatan
    // If no activities at all, empList with activitiesCount > 0 will be empty, cleanly showing empty state
    const allActivitiesRanked = empList
      .filter(e => e.activitiesCount > 0)
      .sort((a, b) => b.activitiesCount - a.activitiesCount || a.name.localeCompare(b.name));

    // Helper to find performance plan for an activity
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

    // 4. HIERARCHICAL PERFORMANCE CONTRIBUTION PER EMPLOYEE
    // Formula: Kontribusi = (Realisasi RK Anggota / Target RK Anggota) × (Bobot RK Anggota / 100) × (Bobot RK Ketua / 100) * 100%
    const employeeContributions: EmployeeContributionSummary[] = activeEmployeesList
      .map(empName => {
        const empActs = allActivities.filter(a => a.employeeName === empName);
        const teamName = empActs[0]?.team || 'Tim Kerja';
        const email = empActs[0]?.email;

        // Group activities by same Rencana Kinerja Anggota (sum realisasi for the same RK per employee)
        const rkGroup: Record<string, {
          plan?: PerformancePlan;
          rkKey: string;
          totalRealisasi: number;
          activitiesCount: number;
        }> = {};

        empActs.forEach(act => {
          const matchedPlan = findMatchingPlan(act);
          const rkKey = matchedPlan?.id || act.rencana_kinerja || act.performancePlanTitle || act.subActivity || 'Kegiatan Umum';
          
          if (!rkGroup[rkKey]) {
            rkGroup[rkKey] = {
              plan: matchedPlan,
              rkKey,
              totalRealisasi: 0,
              activitiesCount: 0
            };
          }
          rkGroup[rkKey].totalRealisasi += (Number(act.realisasi) || 0);
          rkGroup[rkKey].activitiesCount += 1;
        });

        // Calculate contribution for each RK Anggota
        const items: EmployeeContributionItem[] = Object.values(rkGroup).map(grp => {
          const plan = grp.plan;
          const targetOutput = plan ? Number(plan.targetOutput) || 1 : 1;
          const unit = plan?.unit || 'Dokumen';
          const bobotKetuaRaw = plan ? Number(plan.bobotRkKetua) || 50 : 50;
          const bobotAnggotaRaw = plan ? Number(plan.bobotRkAnggota ?? plan.weight) || 20 : 20;

          const bobotKetuaDec = bobotKetuaRaw > 1 ? bobotKetuaRaw / 100 : bobotKetuaRaw;
          const bobotAnggotaDec = bobotAnggotaRaw > 1 ? bobotAnggotaRaw / 100 : bobotAnggotaRaw;

          // Persentase Realisasi Anggota = Realisasi Anggota / Target Anggota * 100%
          const persentaseRealisasi = targetOutput > 0 
            ? (grp.totalRealisasi / targetOutput) * 100 
            : 0;

          // Kontribusi Anggota terhadap IKU = Persentase Realisasi * Bobot RK Anggota * Bobot RK Ketua
          const kontribusiIku = persentaseRealisasi * bobotAnggotaDec * bobotKetuaDec;

          return {
            planId: plan?.id,
            iku: plan?.iku || 'IKU Tim Kerja',
            targetIku: plan?.targetIku || '100%',
            rencanaKinerjaKetua: plan?.rencanaKinerjaKetua || 'Rencana Kinerja Ketua',
            bobotRkKetua: bobotKetuaRaw,
            rencanaKinerjaAnggota: plan?.rencanaKinerjaAnggota || plan?.indicator || grp.rkKey,
            bobotRkAnggota: bobotAnggotaRaw,
            targetOutput,
            unit,
            totalRealisasi: grp.totalRealisasi,
            persentaseRealisasi: Math.round(persentaseRealisasi * 10) / 10,
            kontribusiIku: Math.round(kontribusiIku * 100) / 100,
            activitiesCount: grp.activitiesCount
          };
        });

        const totalKontribusiIku = items.reduce((sum, item) => sum + item.kontribusiIku, 0);
        const totalRealisasiAll = items.reduce((sum, item) => sum + item.totalRealisasi, 0);

        return {
          name: empName,
          email,
          team: teamName,
          totalKontribusiIku: Math.round(totalKontribusiIku * 100) / 100,
          totalRealisasiAll,
          totalActivitiesCount: empActs.length,
          items
        };
      })
      .filter(e => e.totalActivitiesCount > 0 || e.totalKontribusiIku > 0)
      .sort((a, b) => {
        if (b.totalKontribusiIku !== a.totalKontribusiIku) {
          return b.totalKontribusiIku - a.totalKontribusiIku;
        }
        return b.totalRealisasiAll - a.totalRealisasiAll;
      });

    // Helper to resolve Ketua Tim Name
    const getTeamLeaderName = (teamName: string): string => {
      const foundInProps = teams.find(t => t.name.toLowerCase().trim() === teamName.toLowerCase().trim());
      if (foundInProps && foundInProps.leaderName) return foundInProps.leaderName;

      return '';
    };

    // 5. KETUA TIM / TIM KERJA CONTRIBUTION AGGREGATION
    // Only aggregate teams that actually exist in teams or have member contributions
    const activeTeamNamesSet = new Set<string>();
    if (teams && teams.length > 0) {
      teams.forEach(t => {
        if (t.leaderName && t.leaderName.trim()) activeTeamNamesSet.add(t.name);
      });
    }
    employeeContributions.forEach(e => {
      if (e.team && e.totalKontribusiIku > 0) activeTeamNamesSet.add(e.team);
    });

    const ketuaContributions: KetuaContributionSummary[] = Array.from(activeTeamNamesSet)
      .map(teamName => {
        const leaderName = getTeamLeaderName(teamName) || `Ketua ${teamName}`;
        const members = employeeContributions.filter(e => e.team === teamName);
        
        const totalKontribusiIku = members.reduce((sum, m) => sum + m.totalKontribusiIku, 0);
        const totalRealisasiAll = members.reduce((sum, m) => sum + m.totalRealisasiAll, 0);
        const totalActivitiesCount = members.reduce((sum, m) => sum + m.totalActivitiesCount, 0);

        return {
          teamName,
          leaderName,
          totalKontribusiIku: Math.round(totalKontribusiIku * 100) / 100,
          totalRealisasiAll,
          totalActivitiesCount,
          memberCount: members.length,
          memberContributions: members
        };
      })
      .filter(k => k.totalActivitiesCount > 0 || k.totalKontribusiIku > 0)
      .sort((a, b) => {
        if (b.totalKontribusiIku !== a.totalKontribusiIku) {
          return b.totalKontribusiIku - a.totalKontribusiIku;
        }
        return b.totalRealisasiAll - a.totalRealisasiAll;
      });

    const topContribution = employeeContributions.slice(0, 5);

    // 5. IKU HIERARCHY AGGREGATION
    const ikuSummaryMap: Record<string, {
      ikuName: string;
      targetIku: string | number;
      team: string;
      rkKetuaList: {
        nama: string;
        bobot: number;
        rkAnggotaList: {
          nama: string;
          bobot: number;
          targetOutput: number;
          unit: string;
          totalRealisasi: number;
          capaian: number;
        }[];
      }[];
      totalRealisasi: number;
      capaianIku: number;
    }> = {};

    performancePlans.forEach(plan => {
      const ikuKey = plan.iku || 'IKU Tim Kerja';
      if (!ikuSummaryMap[ikuKey]) {
        ikuSummaryMap[ikuKey] = {
          ikuName: ikuKey,
          targetIku: plan.targetIku || '100%',
          team: plan.team,
          rkKetuaList: [],
          totalRealisasi: 0,
          capaianIku: 0
        };
      }

      const matchingActivities = allActivities.filter(a => 
        a.performancePlanId === plan.id || 
        a.rencana_kinerja === plan.id ||
        (a.rencana_kinerja && a.rencana_kinerja.trim().toLowerCase() === (plan.rencanaKinerjaAnggota || plan.indicator || '').trim().toLowerCase())
      );
      const planRealisasi = matchingActivities.reduce((acc, a) => acc + (Number(a.realisasi) || 0), 0);
      const planTarget = Number(plan.targetOutput) || 1;
      const planCapaian = planTarget > 0 ? (planRealisasi / planTarget) * 100 : 0;

      const rkKetuaName = plan.rencanaKinerjaKetua || 'Rencana Kinerja Ketua';
      let ketuaItem = ikuSummaryMap[ikuKey].rkKetuaList.find(k => k.nama === rkKetuaName);
      if (!ketuaItem) {
        ketuaItem = {
          nama: rkKetuaName,
          bobot: plan.bobotRkKetua || 50,
          rkAnggotaList: []
        };
        ikuSummaryMap[ikuKey].rkKetuaList.push(ketuaItem);
      }

      ketuaItem.rkAnggotaList.push({
        nama: plan.rencanaKinerjaAnggota || plan.indicator,
        bobot: plan.bobotRkAnggota ?? plan.weight ?? 10,
        targetOutput: planTarget,
        unit: plan.unit,
        totalRealisasi: planRealisasi,
        capaian: Math.round(planCapaian * 10) / 10
      });
    });

    const ikuSummaryList = Object.values(ikuSummaryMap).map(iku => {
      let totalIkuWeightCapaian = 0;
      iku.rkKetuaList.forEach(ketua => {
        const ketuaBobotDec = (ketua.bobot || 50) / 100;
        let sumAnggotaContrib = 0;
        ketua.rkAnggotaList.forEach(anggota => {
          const anggotaBobotDec = (anggota.bobot || 10) / 100;
          sumAnggotaContrib += (anggota.capaian * anggotaBobotDec);
        });
        totalIkuWeightCapaian += (sumAnggotaContrib * ketuaBobotDec);
      });
      return {
        ...iku,
        capaianIku: Math.round(totalIkuWeightCapaian * 10) / 10
      };
    });

    // Grouping by team
    const teamGroup: Record<string, number> = {};
    allActivities.forEach(act => {
      teamGroup[act.team] = (teamGroup[act.team] || 0) + 1;
    });
    const topTeams = Object.entries(teamGroup)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Grouping by activity type
    const typeGroup: Record<string, number> = {};
    allActivities.forEach(act => {
      typeGroup[act.activityType] = (typeGroup[act.activityType] || 0) + 1;
    });
    const topActivityTypes = Object.entries(typeGroup)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      allActivitiesRanked,
      topContribution,
      employeeContributions,
      ketuaContributions,
      ikuSummaryList,
      topTeams,
      topActivityTypes
    };
  }, [allActivities, currentMonthActivities, activeEmployeesList, performancePlans, teams]);

  // 5. EXPORTS
  const handleExportExcel = () => {
    try {
      const dataToExport = allActivities.map((act, idx) => ({
        'No': idx + 1,
        'ID Aktivitas': act.id,
        'Nama Pegawai': act.employeeName,
        'Email': act.email,
        'Tim': act.team,
        'Tanggal': act.date,
        'Jenis Kegiatan': act.activityType,
        'Sub Kegiatan': act.subActivity,
        'Progress (%)': `${act.progress}%`,
        'Link Google Drive': act.driveLink,
        'Status': act.status,
        'Tanggal Dibuat': act.createdAt
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'KIPAPP Master Data');

      XLSX.writeFile(workbook, 'DATA_KIPAPP_PORTAL_MONITORING.xlsx');
      onNotify('Database Master KIPAPP berhasil diunduh sebagai Excel!', 'success');
    } catch {
      onNotify('Gagal mengunduh Excel.', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8" id="dashboard-view">
      
      {/* HEADER SECTION WITH EXPORTS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">Dashboard Statistik Kinerja Pegawai</h1>
          <p className="text-sm text-slate-500">Ikhtisar instan seluruh data aktivitas, rekap KIPAPP, dan grafik capaian pegawai.</p>
        </div>

        {/* EXPORT CONTROL BUTTONS */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl shadow-md shadow-green-100 transition-all duration-200 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Ekspor Excel
          </button>
          
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl shadow-xs transition-all duration-200 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Cetak / PDF
          </button>
        </div>
      </div>

      {/* STATS WIDGETS BENTO GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Pegawai Aktif */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all duration-200 space-y-2 relative overflow-hidden">
          <Users className="absolute right-4 top-4 w-12 h-12 text-indigo-500/10" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Pegawai Aktif</p>
          <p className="text-3xl font-extrabold text-indigo-600 font-mono">{stats.totalActiveEmployees}</p>
          <p className="text-[10px] text-slate-400">Terdaftar di Spreadsheet</p>
        </div>

        {/* Total Kegiatan Hari Ini */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all duration-200 space-y-2 relative overflow-hidden">
          <Clock className="absolute right-4 top-4 w-12 h-12 text-emerald-500/10" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Kegiatan Hari Ini</p>
          <p className="text-3xl font-extrabold text-emerald-600 font-mono">{stats.totalTodayActivities}</p>
          <p className="text-[10px] text-slate-400">Tanggal: {todayStr}</p>
        </div>

        {/* Total Kegiatan Bulan Ini */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all duration-200 space-y-2 relative overflow-hidden">
          <CheckCircle className="absolute right-4 top-4 w-12 h-12 text-purple-500/10" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Kegiatan Bulan Ini</p>
          <p className="text-3xl font-extrabold text-purple-600 font-mono">{stats.totalMonthActivities}</p>
          <p className="text-[10px] text-slate-400">Bulan Berjalan</p>
        </div>

        {/* Rerata Progress Pegawai */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all duration-200 space-y-2 relative overflow-hidden">
          <Percent className="absolute right-4 top-4 w-12 h-12 text-rose-500/10" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rata-rata Progress</p>
          <p className="text-3xl font-extrabold text-rose-600 font-mono">{stats.avgProgress}%</p>
          <p className="text-[10px] text-slate-400">Bulan Berjalan</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Laporan PDF */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all duration-200 space-y-1 relative overflow-hidden">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Laporan PDF</p>
          <p className="text-2xl font-bold text-slate-800 font-mono">{stats.totalPDF}</p>
          <p className="text-[9px] text-slate-400">Unggah berkas PDF</p>
        </div>

        {/* Jumlah Upload Foto */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all duration-200 space-y-1 relative overflow-hidden">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Jumlah Upload Foto</p>
          <p className="text-2xl font-bold text-slate-800 font-mono">{stats.totalPhoto}</p>
          <p className="text-[9px] text-slate-400">Unggah berkas gambar/foto</p>
        </div>

        {/* Total Draft KIPAPP */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all duration-200 space-y-1 relative overflow-hidden">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Draft KIPAPP</p>
          <p className="text-2xl font-bold text-amber-600 font-mono">{stats.totalDraft}</p>
          <p className="text-[9px] text-slate-400">Status "Draft"</p>
        </div>

        {/* Sudah/Belum Input Hari Ini */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all duration-200 space-y-1 relative overflow-hidden">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Input Hari Ini (%)</p>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-emerald-600 font-mono">{stats.percentageInputToday}%</span>
            <span className="text-[10px] text-slate-400">Sudah</span>
          </div>
          <p className="text-[9px] text-rose-500 font-semibold">{stats.percentageNotInputToday}% Belum Input</p>
        </div>
      </div>

      {/* Statistik & Ranking Bulanan */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 mt-4">
        <h2 className="text-base font-bold text-slate-800 tracking-tight">Statistik &amp; Ranking Bulanan</h2>
        <span className="text-xs text-slate-400 font-medium">Statistik Bulan Berjalan</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Peringkat Kegiatan Pegawai (Scroll Ke Bawah untuk Seluruh Pegawai) */}
        <div className="bg-gradient-to-b from-amber-50/50 via-white to-white p-5 rounded-3xl border border-amber-200/80 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col max-h-[460px]">
          <div className="flex items-center justify-between border-b border-amber-100 pb-2.5 mb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs border border-amber-200">
                <Trophy className="w-4 h-4 fill-amber-500 text-amber-600" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                  Peringkat Kegiatan <span>🏆</span>
                </h3>
                <span className="text-[10px] text-amber-700 font-semibold">Seluruh Pegawai • Scroll Ke Bawah</span>
              </div>
            </div>
            <span className="text-[10px] font-black text-amber-700 bg-amber-100/80 border border-amber-200 px-2.5 py-0.5 rounded-full">
              {rankings.allActivitiesRanked.length} Pegawai
            </span>
          </div>

          {rankings.allActivitiesRanked.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">Belum ada kegiatan bulan ini.</p>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 flex-1">
              {rankings.allActivitiesRanked.map((emp, index) => {
                const trophyBadges = [
                  { icon: '🏆', color: 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs font-black' },
                  { icon: '🥈', color: 'bg-slate-100 text-slate-800 border-slate-300 font-bold' },
                  { icon: '🥉', color: 'bg-orange-100 text-orange-900 border-orange-300 font-bold' }
                ];
                const badge = trophyBadges[index] || { 
                  icon: `#${index + 1}`, 
                  color: 'bg-slate-50 text-slate-600 border-slate-200 font-mono text-[10px]' 
                };

                return (
                  <div 
                    key={emp.name} 
                    className={`flex items-center justify-between text-xs p-2 rounded-xl transition-all ${
                      index === 0 ? 'bg-amber-50/80 border border-amber-200' : 'hover:bg-slate-50 border border-slate-100/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs border flex-shrink-0 ${badge.color}`}>
                        {badge.icon}
                      </span>
                      <span className={`font-semibold truncate ${index === 0 ? 'text-amber-950 font-bold' : 'text-slate-700'}`} title={emp.name}>
                        {emp.name}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-amber-800 bg-amber-100/70 border border-amber-200 px-2.5 py-1 rounded-lg text-[10px] flex-shrink-0">
                      {emp.activitiesCount} keg
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Kontributor IKU (Seksi Pilihan Anggota vs Ketua Tim) */}
        <div className="bg-gradient-to-b from-indigo-50/40 via-white to-white p-5 rounded-3xl border border-indigo-200/90 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col max-h-[460px]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-indigo-100 pb-2.5 mb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center border border-indigo-200 shadow-xs">
                <Award className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  Top Kontributor IKU <span>🎯</span>
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">Berdasarkan Hierarki &amp; Bobot</span>
              </div>
            </div>

            {/* Toggle 2 Mode: Anggota vs Ketua Tim */}
            <div className="inline-flex p-1 bg-white rounded-xl border border-indigo-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setContributionRoleTab('Anggota')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  contributionRoleTab === 'Anggota'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <User className="w-3 h-3" />
                <span>Anggota</span>
              </button>
              <button
                type="button"
                onClick={() => setContributionRoleTab('Ketua')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  contributionRoleTab === 'Ketua'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Crown className="w-3 h-3 text-amber-200" />
                <span>Ketua Tim</span>
              </button>
            </div>
          </div>

          {/* TAB 1: ANGGOTA PEGAWAI (INDIVIDUAL) */}
          {contributionRoleTab === 'Anggota' && (
            rankings.employeeContributions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Belum ada data realisasi aktivitas anggota.</p>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 flex-1">
                {rankings.employeeContributions.map((emp, index) => {
                  const rankBadges = [
                    'bg-indigo-600 text-white font-bold',
                    'bg-indigo-100 text-indigo-700 font-bold border border-indigo-200',
                    'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100'
                  ];
                  const badgeClass = rankBadges[index] || 'bg-slate-50 text-slate-500 border border-slate-200/60 font-mono text-[10px]';

                  return (
                    <div 
                      key={emp.name} 
                      onClick={() => {
                        setSelectedContributionEmployee(emp);
                        setIsContributionModalOpen(true);
                      }}
                      className="flex items-center justify-between text-xs hover:bg-indigo-50/50 p-2 rounded-xl transition-all cursor-pointer group border border-slate-100/60 hover:border-indigo-100"
                      title="Klik untuk melihat rincian perhitungan per Rencana Kinerja"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-[11px] flex-shrink-0 ${badgeClass}`}>
                          {index < 3 ? index + 1 : `#${index + 1}`}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-slate-800 font-bold truncate group-hover:text-indigo-600 transition-colors">
                            {emp.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {emp.team} • {emp.totalRealisasiAll} realisasi ({emp.items.length} RK)
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg text-xs">
                          {emp.totalKontribusiIku.toFixed(1)}%
                        </span>
                        <span className="text-[9px] text-indigo-500 font-medium">ke IKU</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* TAB 2: KETUA TIM / TIM KERJA (TOTAL KONTRIBUSI DARI PENJUMLAHAN ANGGOTA) */}
          {contributionRoleTab === 'Ketua' && (
            rankings.ketuaContributions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Belum ada data tim kerja.</p>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 flex-1">
                {rankings.ketuaContributions.map((ketua, index) => {
                  const ketuaBadges = [
                    'bg-amber-500 text-white font-black shadow-xs',
                    'bg-amber-100 text-amber-900 font-bold border border-amber-300',
                    'bg-amber-50 text-amber-800 font-bold border border-amber-200'
                  ];
                  const badgeClass = ketuaBadges[index] || 'bg-slate-50 text-slate-600 border border-slate-200 font-mono text-[10px]';

                  return (
                    <div 
                      key={ketua.teamName} 
                      onClick={() => {
                        setSelectedContributionKetua(ketua);
                        setIsKetuaModalOpen(true);
                      }}
                      className="flex items-center justify-between text-xs hover:bg-amber-50/50 p-2.5 rounded-xl transition-all cursor-pointer group border border-slate-100 hover:border-amber-200 bg-white"
                      title="Klik untuk melihat rincian kontribusi seluruh anggota di bawah Ketua Tim"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${badgeClass}`}>
                          {index < 3 ? <Crown className="w-3.5 h-3.5 text-amber-100" /> : `#${index + 1}`}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-slate-900 font-extrabold truncate group-hover:text-amber-800 transition-colors flex items-center gap-1.5">
                            <span>{ketua.leaderName}</span>
                            <span className="text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-200 font-semibold">
                              Ketua
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">
                            {ketua.teamName} • {ketua.memberCount} Anggota • Total Realisasi: {ketua.totalRealisasiAll}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="font-mono font-black text-amber-900 bg-amber-100/80 border border-amber-300 px-2.5 py-0.5 rounded-lg text-xs">
                          {ketua.totalKontribusiIku.toFixed(1)}%
                        </span>
                        <span className="text-[9px] text-amber-700 font-semibold">Akumulasi Tim</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

      </div>



      {/* MODAL RINCIAN PERHITUNGAN KONTRIBUSI INDIVIDU TERHADAP IKU */}
      {isContributionModalOpen && selectedContributionEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-indigo-700 to-indigo-800 text-white p-6 flex items-start justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-white/15 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider mb-2">
                  <Award className="w-3.5 h-3.5" /> Rincian Kontribusi Kinerja terhadap IKU
                </div>
                <h3 className="text-xl font-extrabold font-display">
                  {selectedContributionEmployee.name}
                </h3>
                <p className="text-xs text-indigo-100 mt-0.5">
                  Tim: <span className="font-semibold text-white">{selectedContributionEmployee.team}</span> • Total Realisasi: <span className="font-semibold text-white">{selectedContributionEmployee.totalRealisasiAll}</span> unit
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right bg-white/10 px-3.5 py-2 rounded-2xl border border-white/20">
                  <div className="text-[10px] text-indigo-100 font-semibold uppercase">Total Kontribusi IKU</div>
                  <div className="text-2xl font-black font-mono text-emerald-300">
                    {selectedContributionEmployee.totalKontribusiIku.toFixed(2)}%
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsContributionModalOpen(false)}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Selector Pegawai Lain */}
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-bold text-slate-600 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" /> Pilih Pegawai untuk Melihat Perhitungan:
              </span>
              <select
                value={selectedContributionEmployee.name}
                onChange={(e) => {
                  const targetEmp = rankings.employeeContributions.find(emp => emp.name === e.target.value);
                  if (targetEmp) setSelectedContributionEmployee(targetEmp);
                }}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {rankings.employeeContributions.map(emp => (
                  <option key={emp.name} value={emp.name}>
                    {emp.name} ({emp.totalKontribusiIku.toFixed(1)}% IKU - {emp.team})
                  </option>
                ))}
              </select>
            </div>

            {/* Body: Rumus & Tabel Rincian */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              
              {/* Formula Explainer Callout */}
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-950 space-y-1.5">
                <div className="font-extrabold flex items-center gap-1.5 text-indigo-900">
                  <Info className="w-4 h-4 text-indigo-600" /> Rumus Perhitungan Kontribusi Kinerja Hierarkis:
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed font-mono bg-white p-2.5 rounded-xl border border-indigo-100/60">
                  <strong>Kontribusi ke IKU (%)</strong> = (Total Realisasi Anggota / Target RK Anggota) × (Bobot RK Anggota / 100) × (Bobot RK Ketua / 100) × 100%
                </p>
                <p className="text-[10px] text-slate-500">
                  * Untuk kegiatan dengan Rencana Kinerja Anggota yang sama, seluruh realisasi aktivitas pegawai tersebut dijumlahkan secara otomatis.
                </p>
              </div>

              {/* Tabel Rincian per Rencana Kinerja */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-3.5 py-3">IKU &amp; Target</th>
                        <th className="px-3.5 py-3">RK Ketua (Bobot)</th>
                        <th className="px-3.5 py-3">RK Anggota (Bobot)</th>
                        <th className="px-3.5 py-3 text-center">Realisasi / Target</th>
                        <th className="px-3.5 py-3 text-center">Capaian RK</th>
                        <th className="px-3.5 py-3 text-right">Kontribusi ke IKU</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedContributionEmployee.items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                            Pegawai ini belum memiliki realisasi aktivitas yang terhubung ke rencana kinerja.
                          </td>
                        </tr>
                      ) : (
                        selectedContributionEmployee.items.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="px-3.5 py-3 max-w-[150px]">
                              <div className="font-bold text-slate-800 line-clamp-2" title={item.iku}>
                                {item.iku}
                              </div>
                              <span className="text-[10px] text-emerald-700 font-mono">
                                Target: {item.targetIku}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 max-w-[160px]">
                              <div className="text-slate-800 line-clamp-2" title={item.rencanaKinerjaKetua}>
                                {item.rencanaKinerjaKetua}
                              </div>
                              <span className="text-[10px] text-indigo-600 font-mono font-bold">
                                Bobot: {item.bobotRkKetua}%
                              </span>
                            </td>
                            <td className="px-3.5 py-3 max-w-[180px]">
                              <div className="font-semibold text-slate-900 line-clamp-2" title={item.rencanaKinerjaAnggota}>
                                {item.rencanaKinerjaAnggota}
                              </div>
                              <span className="text-[10px] text-purple-600 font-mono font-bold">
                                Bobot: {item.bobotRkAnggota}% • {item.activitiesCount} log
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-center whitespace-nowrap font-mono">
                              <span className="font-bold text-slate-800">{item.totalRealisasi}</span>
                              <span className="text-slate-400"> / {item.targetOutput} {item.unit}</span>
                            </td>
                            <td className="px-3.5 py-3 text-center whitespace-nowrap">
                              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                                {item.persentaseRealisasi}%
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-right whitespace-nowrap">
                              <span className="font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs">
                                +{item.kontribusiIku.toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50/80 font-bold border-t border-slate-200">
                      <tr>
                        <td colSpan={3} className="px-3.5 py-3 text-slate-700">
                          Total Akumulasi Kontribusi Seluruh Rencana Kinerja
                        </td>
                        <td className="px-3.5 py-3 text-center font-mono text-slate-800">
                          {selectedContributionEmployee.totalRealisasiAll} unit
                        </td>
                        <td className="px-3.5 py-3 text-center text-slate-400">-</td>
                        <td className="px-3.5 py-3 text-right font-mono font-black text-emerald-700 text-sm">
                          {selectedContributionEmployee.totalKontribusiIku.toFixed(2)}% IKU
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>

            {/* Footer Modal */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Sistem Perhitungan Hierarkis SatuInApp
              </span>
              <button
                type="button"
                onClick={() => setIsContributionModalOpen(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Tutup Rincian
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL RINCIAN AKUMULASI KONTRIBUSI KETUA TIM */}
      {isKetuaModalOpen && selectedContributionKetua && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white p-6 flex items-start justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-white/20 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider mb-2 text-amber-100">
                  <Crown className="w-3.5 h-3.5 text-amber-200" /> Rincian Akumulasi Kontribusi Ketua Tim
                </div>
                <h3 className="text-xl font-extrabold font-display flex items-center gap-2">
                  <span>{selectedContributionKetua.leaderName}</span>
                  <span className="text-xs bg-amber-900/50 text-amber-200 px-2 py-0.5 rounded-md border border-amber-500/30 font-semibold">
                    Ketua Tim
                  </span>
                </h3>
                <p className="text-xs text-amber-100 mt-1">
                  Tim Kerja: <span className="font-semibold text-white">{selectedContributionKetua.teamName}</span> • Jumlah Anggota: <span className="font-semibold text-white">{selectedContributionKetua.memberCount} orang</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right bg-white/10 px-3.5 py-2 rounded-2xl border border-white/20">
                  <div className="text-[10px] text-amber-100 font-semibold uppercase">Total Kontribusi Tim</div>
                  <div className="text-2xl font-black font-mono text-amber-200">
                    {selectedContributionKetua.totalKontribusiIku.toFixed(2)}%
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsKetuaModalOpen(false)}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Selector Ketua Tim Lain */}
            <div className="bg-amber-50/60 px-6 py-3 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-bold text-amber-950 flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-amber-600" /> Pilih Ketua Tim / Tim Kerja:
              </span>
              <select
                value={selectedContributionKetua.teamName}
                onChange={(e) => {
                  const targetKetua = rankings.ketuaContributions.find(k => k.teamName === e.target.value);
                  if (targetKetua) setSelectedContributionKetua(targetKetua);
                }}
                className="bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-amber-950 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {rankings.ketuaContributions.map(ketua => (
                  <option key={ketua.teamName} value={ketua.teamName}>
                    {ketua.leaderName} ({ketua.totalKontribusiIku.toFixed(1)}% IKU - {ketua.teamName})
                  </option>
                ))}
              </select>
            </div>

            {/* Body: Explainer & Member List Table */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              
              <div className="bg-amber-50/80 border border-amber-200/70 rounded-2xl p-4 text-xs text-amber-950 space-y-1.5">
                <div className="font-extrabold flex items-center gap-1.5 text-amber-900">
                  <Info className="w-4 h-4 text-amber-600" /> Penghitungan Kontribusi Ketua Tim:
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed font-mono bg-white p-2.5 rounded-xl border border-amber-200/60">
                  <strong>Kontribusi Ketua Tim (%)</strong> = ∑ (Kontribusi IKU seluruh Anggota di bawah Tim {selectedContributionKetua.teamName})
                </p>
                <p className="text-[10px] text-amber-800 font-medium">
                  * Capaian Ketua Tim dihitung dari agregat total realisasi seluruh anggota yang menyusun capaian IKU tim tersebut.
                </p>
              </div>

              {/* Tabel Kontribusi Anggota */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-3.5 py-3">Nama Anggota</th>
                        <th className="px-3.5 py-3 text-center">RK Didukung</th>
                        <th className="px-3.5 py-3 text-center">Total Realisasi</th>
                        <th className="px-3.5 py-3 text-center">Total Log Aktivitas</th>
                        <th className="px-3.5 py-3 text-right">Kontribusi ke IKU</th>
                        <th className="px-3.5 py-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedContributionKetua.memberContributions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                            Belum ada anggota terdaftar di tim kerja ini.
                          </td>
                        </tr>
                      ) : (
                        selectedContributionKetua.memberContributions.map((member, i) => (
                          <tr key={i} className="hover:bg-amber-50/30">
                            <td className="px-3.5 py-3 font-bold text-slate-800">
                              {member.name}
                            </td>
                            <td className="px-3.5 py-3 text-center font-mono text-slate-700">
                              {member.items.length} RK
                            </td>
                            <td className="px-3.5 py-3 text-center font-mono font-semibold text-slate-800">
                              {member.totalRealisasiAll} output
                            </td>
                            <td className="px-3.5 py-3 text-center font-mono text-slate-600">
                              {member.totalActivitiesCount} kegiatan
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-black text-amber-800">
                              +{member.totalKontribusiIku.toFixed(2)}%
                            </td>
                            <td className="px-3.5 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedContributionEmployee(member);
                                  setIsContributionModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                Detail RK
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-amber-50/50 font-bold border-t border-amber-200">
                      <tr>
                        <td className="px-3.5 py-3 text-amber-950 font-extrabold">
                          Total Akumulasi Tim ({selectedContributionKetua.memberCount} Anggota)
                        </td>
                        <td className="px-3.5 py-3 text-center font-mono text-amber-900">
                          {selectedContributionKetua.memberContributions.reduce((s, m) => s + m.items.length, 0)} RK
                        </td>
                        <td className="px-3.5 py-3 text-center font-mono text-amber-900">
                          {selectedContributionKetua.totalRealisasiAll} output
                        </td>
                        <td className="px-3.5 py-3 text-center font-mono text-amber-900">
                          {selectedContributionKetua.totalActivitiesCount} kegiatan
                        </td>
                        <td className="px-3.5 py-3 text-right font-mono font-black text-amber-950 text-sm">
                          {selectedContributionKetua.totalKontribusiIku.toFixed(2)}% IKU
                        </td>
                        <td className="px-3.5 py-3 text-center">-</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>

            {/* Footer Modal */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Sistem Perhitungan Hierarkis SatuInApp • Ketua Tim
              </span>
              <button
                type="button"
                onClick={() => setIsKetuaModalOpen(false)}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Tutup Rincian
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

