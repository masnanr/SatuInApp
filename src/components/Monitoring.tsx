/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Activity, AppSettings, EmployeeStats, TEAMS, ACTIVITY_TYPES } from '../types';
import { motion } from 'motion/react';
import { 
  Users, Layers, ArrowUpDown, Filter, Search, TrendingUp, TrendingDown,
  Calendar, Clock, CheckCircle, Percent, AlertCircle, FileSpreadsheet
} from 'lucide-react';

interface MonitoringProps {
  allActivities: Activity[];
  settings: AppSettings;
}

export default function Monitoring({ allActivities, settings }: MonitoringProps) {
  // Filters
  const [filterTeam, setFilterTeam] = useState<string>('All');
  const [searchEmployee, setSearchEmployee] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>(
    String(new Date().getMonth() + 1).padStart(2, '0')
  );
  const [filterYear, setFilterYear] = useState<string>(
    String(new Date().getFullYear())
  );
  const [filterActivityType, setFilterActivityType] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'none' | 'highest' | 'lowest'>('highest');

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

  // Compute Employee stats based on filters
  const employeeSummaries = useMemo(() => {
    // 1. Group activities by employee email for the selected month and year
    const grouped: Record<string, {
      name: string;
      email: string;
      team: string;
      activities: Activity[];
    }> = {};

    // Get all activities matching month and year
    const periodActivities = allActivities.filter(act => {
      if (!act.date) return false;
      const [year, month] = act.date.split('-');
      const matchesPeriod = year === filterYear && month === filterMonth;
      
      const matchesType = filterActivityType === 'All' || act.activityType === filterActivityType;
      const matchesStatus = filterStatus === 'All' || act.status === filterStatus;
      
      return matchesPeriod && matchesType && matchesStatus;
    });

    periodActivities.forEach(act => {
      const emailLower = act.email.toLowerCase();
      if (!grouped[emailLower]) {
        grouped[emailLower] = {
          name: act.employeeName,
          email: act.email,
          team: act.team,
          activities: []
        };
      }
      grouped[emailLower].activities.push(act);
    });

    // 2. Generate stats objects for each employee
    const summaries: EmployeeStats[] = Object.values(grouped).map(group => {
      const activityCount = group.activities.length;
      const uploadCount = group.activities.filter(a => a.driveFileId !== '').length;
      
      // Calculate Average Progress
      const sumProgress = group.activities.reduce((sum, a) => sum + a.progress, 0);
      const avgProgress = activityCount > 0 ? Math.round(sumProgress / activityCount) : 0;
      
      // Status colors based on Average Progress:
      // Hijau: 100%
      // Biru: 80 - 99%
      // Kuning: 50 - 79%
      // Merah: < 50%
      let status: EmployeeStats['status'] = 'Merah';
      if (avgProgress >= 100) {
        status = 'Hijau';
      } else if (avgProgress >= 80) {
        status = 'Biru';
      } else if (avgProgress >= 50) {
        status = 'Kuning';
      }

      // Find last updated date
      let lastUpdate = '-';
      if (group.activities.length > 0) {
        const sorted = [...group.activities].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        if (sorted[0].date) {
          lastUpdate = sorted[0].date;
        }
      }

      return {
        employeeName: group.name,
        email: group.email,
        team: group.team,
        activityCount,
        uploadCount,
        avgProgress,
        progressPercentage: avgProgress,
        target: 0,
        status,
        lastUpdate
      };
    });

    // 3. Apply filters on calculated summaries
    let filtered = summaries.filter(emp => {
      const matchesTeam = filterTeam === 'All' || emp.team === filterTeam;
      const matchesName = emp.employeeName.toLowerCase().includes(searchEmployee.toLowerCase()) ||
                          emp.email.toLowerCase().includes(searchEmployee.toLowerCase());
      return matchesTeam && matchesName;
    });

    // 4. Apply sorting
    if (sortBy === 'highest') {
      filtered.sort((a, b) => b.avgProgress - a.avgProgress);
    } else if (sortBy === 'lowest') {
      filtered.sort((a, b) => a.avgProgress - b.avgProgress);
    }

    return filtered;
  }, [allActivities, filterTeam, searchEmployee, filterMonth, filterYear, filterActivityType, filterStatus, sortBy]);

  // Color mappings
  const getStatusStyle = (status: EmployeeStats['status']) => {
    switch (status) {
      case 'Hijau':
        return {
          bg: 'bg-green-50 border border-green-100 text-green-700',
          bar: 'bg-green-500',
          text: 'text-green-700 font-bold'
        };
      case 'Biru':
        return {
          bg: 'bg-blue-50 border border-blue-100 text-blue-700',
          bar: 'bg-indigo-600',
          text: 'text-indigo-600 font-bold'
        };
      case 'Kuning':
        return {
          bg: 'bg-amber-50 border border-amber-100 text-amber-700',
          bar: 'bg-amber-500',
          text: 'text-amber-700 font-bold'
        };
      case 'Merah':
        return {
          bg: 'bg-rose-50 border border-rose-100 text-rose-700',
          bar: 'bg-rose-500',
          text: 'text-rose-700 font-bold'
        };
    }
  };

  // Generate text blocks representing ASCII progress bar (e.g., ██████░░░░ 60%)
  const renderAsciiProgressBar = (percent: number, status: EmployeeStats['status']) => {
    const totalBlocks = 10;
    const activeBlocks = Math.round((percent / 100) * totalBlocks);
    const inactiveBlocks = totalBlocks - activeBlocks;
    
    const activeStr = '█'.repeat(activeBlocks);
    const inactiveStr = '░'.repeat(inactiveBlocks);
    
    let colorClass = 'text-rose-600';
    if (status === 'Hijau') colorClass = 'text-green-600';
    else if (status === 'Biru') colorClass = 'text-indigo-600';
    else if (status === 'Kuning') colorClass = 'text-amber-500';

    return (
      <span className="font-mono text-xs font-semibold whitespace-nowrap">
        <span className={colorClass}>{activeStr}</span>
        <span className="text-slate-200">{inactiveStr}</span>
        <span className="ml-2 text-slate-600">{percent}%</span>
      </span>
    );
  };

  return (
    <div className="space-y-6" id="monitoring-view">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">Monitoring Progress Pegawai</h1>
          <p className="text-sm text-slate-500">Pusat pemantauan kinerja harian pegawai bagi Kepala Kantor untuk mengawal target kegiatan bulanan.</p>
        </div>
      </div>

      {/* FILTER BAR PANELS */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 space-y-4 shadow-xs">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-indigo-600" /> Filter Pemantauan Kepala Kantor
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500">Tim Kerja</label>
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all duration-200"
            >
              <option value="All">Semua Tim</option>
              {TEAMS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500">Nama Pegawai</label>
            <div className="relative">
              <input
                type="text"
                value={searchEmployee}
                onChange={(e) => setSearchEmployee(e.target.value)}
                placeholder="Cari pegawai..."
                className="block w-full rounded-xl bg-slate-50 border border-slate-200 pl-8 pr-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all duration-200"
              />
              <Search className="absolute left-2.5 top-3.5 w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500">Periode Bulan</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all duration-200"
            >
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500">Periode Tahun</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all duration-200"
            >
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500">Jenis Kegiatan</label>
            <select
              value={filterActivityType}
              onChange={(e) => setFilterActivityType(e.target.value)}
              className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all duration-200"
            >
              <option value="All">Semua Jenis Kegiatan</option>
              {ACTIVITY_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500">Status Laporan</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all duration-200"
            >
              <option value="All">Semua Status</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500">Urutkan Progress</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setSortBy('highest')}
                className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
                  sortBy === 'highest' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100/50'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" /> Tertinggi
              </button>
              <button
                type="button"
                onClick={() => setSortBy('lowest')}
                className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
                  sortBy === 'lowest' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100/50'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" /> Terendah
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MONITORING LIST CARDS & TABLE */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
        {employeeSummaries.length === 0 ? (
          <div className="text-center py-14 text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            Tidak ada data pegawai yang cocok dengan filter pemantauan untuk periode bulan ini.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-left">
              <thead>
                <tr className="text-slate-500 text-[10px] font-bold uppercase tracking-wider bg-slate-50/75">
                  <th className="px-4 py-3">Nama Pegawai</th>
                  <th className="px-4 py-3">Tim</th>
                  <th className="px-4 py-3 text-center">Kegiatan</th>
                  <th className="px-4 py-3 text-center">Upload</th>
                  <th className="px-4 py-3">Rata-rata Progres (%)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Terakhir Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 text-sm">
                {employeeSummaries.map((emp) => {
                  const style = getStatusStyle(emp.status);
                  return (
                    <tr key={emp.email} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4 font-bold text-slate-900 whitespace-nowrap">
                        {emp.employeeName}
                        <div className="text-[10px] text-slate-400 font-semibold font-mono">{emp.email}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-600 border border-slate-200 text-xs px-2.5 py-0.5 rounded-lg font-bold">
                          {emp.team}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center font-mono font-extrabold text-slate-700 text-xs">{emp.activityCount} log</td>
                      <td className="px-4 py-4 text-center font-mono text-xs text-slate-500 font-bold">{emp.uploadCount} file</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1.5 min-w-[140px]">
                          {renderAsciiProgressBar(emp.avgProgress, emp.status)}
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${style.bar}`} 
                              style={{ width: `${emp.avgProgress}%` }} 
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 border px-2.5 py-1 rounded-full text-xs font-bold ${style.bg}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${style.bar}`} />
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap font-mono text-xs text-slate-500 font-bold">
                        {emp.lastUpdate}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
