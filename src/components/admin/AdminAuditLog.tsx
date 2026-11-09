/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AdminLog } from '../../types';
import { 
  History, Search, ShieldCheck, RefreshCw, Filter, 
  Terminal, ArrowUpRight, Clock, User, HardDrive 
} from 'lucide-react';

interface AdminAuditLogProps {
  logs: AdminLog[];
  onRefresh: () => void;
}

export default function AdminAuditLog({ logs, onRefresh }: AdminAuditLogProps) {
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState<string>('All');

  const filteredLogs = logs.filter(l => {
    const matchSearch = l.adminName.toLowerCase().includes(search.toLowerCase()) ||
                        l.adminEmail.toLowerCase().includes(search.toLowerCase()) ||
                        l.details.toLowerCase().includes(search.toLowerCase()) ||
                        l.action.toLowerCase().includes(search.toLowerCase());
    const matchAction = filterAction === 'All' || l.action === filterAction;
    return matchSearch && matchAction;
  });

  const actionTypes = Array.from(new Set(logs.map(l => l.action)));

  return (
    <div className="space-y-6" id="admin-audit-logs-panel">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-indigo-100 uppercase tracking-wider">
              Security &amp; Audit Trail
            </span>
            <span className="text-xs text-slate-400 font-semibold">• Total: {logs.length} Rekaman Log</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display mt-1">
            Log Aktivitas &amp; Audit Admin
          </h1>
          <p className="text-sm text-slate-500">
            Seluruh tindakan penambahan, pengubahan, dan penghapusan data oleh Administrator terekam otomatis pada database server.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-200 text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all"
        >
          <RefreshCw className="w-4 h-4" /> Perbarui Log
        </button>
      </div>

      {/* FILTER & SEARCH */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-8 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari dalam catatan audit (nama, email admin, keterangan aksi)..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        </div>

        <div className="sm:col-span-4">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
          >
            <option value="All">Semua Jenis Aksi</option>
            {actionTypes.map(act => (
              <option key={act} value={act}>{act}</option>
            ))}
          </select>
        </div>
      </div>

      {/* AUDIT LOG TIMELINE / TABLE */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left">
            <thead>
              <tr className="bg-slate-50/75 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3.5">Waktu &amp; IP</th>
                <th className="px-6 py-3.5">Administrator</th>
                <th className="px-6 py-3.5">Jenis Tindakan</th>
                <th className="px-6 py-3.5">Kategori Objek</th>
                <th className="px-6 py-3.5">Rincian Perubahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs">
                    Belum ada riwayat aktivitas yang sesuai dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const dateFormatted = new Date(log.timestamp).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {dateFormatted}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          IP: {log.ipAddress || '127.0.0.1'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-xs">{log.adminName}</div>
                        <div className="text-[11px] font-mono text-slate-500">{log.adminEmail}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2.5 py-1 rounded-md border ${
                          log.action.includes('TAMBAH') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          log.action.includes('HAPUS') ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          log.action.includes('UBAH') ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {log.targetType}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-md">
                        <p className="text-xs text-slate-700 font-medium leading-relaxed">
                          {log.details}
                        </p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
