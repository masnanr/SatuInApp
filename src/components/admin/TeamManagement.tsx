/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Team } from '../../types';
import { createTeam, updateTeam, deleteTeam } from '../../lib/serverApi';
import { 
  Building2, Plus, Search, Edit3, Trash2, UserCheck, 
  XCircle, RefreshCw, Layers, ShieldCheck 
} from 'lucide-react';

interface TeamManagementProps {
  teams: Team[];
  currentAdminEmail: string;
  currentAdminName: string;
  onRefresh: () => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function TeamManagement({
  teams,
  currentAdminEmail,
  currentAdminName,
  onRefresh,
  onNotify
}: TeamManagementProps) {
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    leaderName: string;
    leaderEmail: string;
  }>({
    name: '',
    description: '',
    leaderName: '',
    leaderEmail: ''
  });

  const handleOpenAdd = () => {
    setEditingTeam(null);
    setFormData({
      name: '',
      description: '',
      leaderName: '',
      leaderEmail: ''
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description,
      leaderName: team.leaderName,
      leaderEmail: team.leaderEmail
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      onNotify('Nama Tim wajib diisi.', 'error');
      return;
    }

    const autoCode = formData.name.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4) || 'TIM';
    const payload = {
      ...formData,
      code: autoCode
    };

    setIsSubmitting(true);
    try {
      if (editingTeam) {
        const res = await updateTeam(editingTeam.id, payload, currentAdminEmail, currentAdminName);
        if (res.success) {
          onNotify(`Tim "${formData.name}" berhasil diperbarui.`, 'success');
          setIsFormOpen(false);
          onRefresh();
        } else {
          onNotify(res.message || 'Gagal memperbarui tim.', 'error');
        }
      } else {
        const res = await createTeam(payload, currentAdminEmail, currentAdminName);
        if (res.success) {
          onNotify(`Tim "${formData.name}" berhasil ditambahkan ke Database Server!`, 'success');
          setIsFormOpen(false);
          onRefresh();
        } else {
          onNotify(res.message || 'Gagal menambahkan tim.', 'error');
        }
      }
    } catch (err: any) {
      onNotify(err.message || 'Terjadi kesalahan.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (team: Team) => {
    const confirm = window.confirm(`Hapus Tim "${team.name}" dari Database Server?`);
    if (!confirm) return;

    try {
      const res = await deleteTeam(team.id, currentAdminEmail, currentAdminName);
      if (res.success) {
        onNotify(`Tim "${team.name}" berhasil dihapus.`, 'success');
        onRefresh();
      } else {
        onNotify(res.message || 'Gagal menghapus tim.', 'error');
      }
    } catch {
      onNotify('Gagal menghapus tim.', 'error');
    }
  };

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.code.toLowerCase().includes(search.toLowerCase()) ||
    t.leaderName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6" id="team-management-panel">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-indigo-100 uppercase tracking-wider">
              Struktur Organisasi
            </span>
            <span className="text-xs text-slate-400 font-semibold">• Total: {teams.length} Tim</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display mt-1">
            Master Tim Kerja Kantor
          </h1>
          <p className="text-sm text-slate-500">
            Kelola daftar tim kerja teknis dan fungsional pada database server OneInAPP.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> Tambah Tim Kerja Baru
          </button>
        </div>
      </div>

      {/* SEARCH */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari tim berdasarkan nama, kode, atau ketua tim..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-7 top-7" />
      </div>

      {/* GRID LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTeams.map((t) => (
          <div 
            key={t.id}
            className="bg-white rounded-3xl border border-slate-100 shadow-xs hover:shadow-md transition-all p-6 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-extrabold text-sm shadow-xs font-mono">
                    {t.code || 'TIM'}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base font-display">{t.name}</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">ID: {t.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(t)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    title="Edit Tim"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Hapus Tim"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-600 leading-relaxed min-h-[38px]">
                {t.description || 'Tidak ada keterangan rincian untuk tim ini.'}
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" /> Ketua Tim:
                </span>
                <span className="font-bold text-slate-800">{t.leaderName || '-'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL TAMBAH / EDIT TIM */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 font-display">
                  {editingTeam ? 'Edit Master Tim Kerja' : 'Tambah Tim Kerja Baru'}
                </h3>
                <p className="text-xs text-slate-500">
                  Data tim tersimpan di tabel database <code className="text-indigo-600">teams</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Nama Tim Kerja *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Tim Statistik Distribusi"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Deskripsi / Ruang Lingkup Kerja</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Keterangan tugas dan fungsi kegiatan tim..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Nama Ketua Tim</label>
                <input
                  type="text"
                  value={formData.leaderName}
                  onChange={(e) => setFormData({ ...formData, leaderName: e.target.value })}
                  placeholder="Masna Fitria, S.Stat"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
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
                  {isSubmitting ? 'Menyimpan...' : editingTeam ? 'Perbarui Tim' : 'Simpan ke Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
