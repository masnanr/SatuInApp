/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserAccount, UserRole, UserStatus } from '../../types';
import { createUser, updateUser, deleteUser } from '../../lib/serverApi';
import { 
  Users, UserPlus, Search, ShieldCheck, UserCheck, ShieldAlert, 
  Trash2, Edit3, CheckCircle2, XCircle, RefreshCw, Mail, Building, FileText, AlertTriangle 
} from 'lucide-react';

interface UserManagementProps {
  users: UserAccount[];
  teams: string[];
  currentAdminEmail: string;
  currentAdminName: string;
  token?: string;
  onRefresh: () => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function UserManagement({
  users,
  teams,
  currentAdminEmail,
  currentAdminName,
  onRefresh,
  onNotify
}: UserManagementProps) {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'All' | UserRole>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | UserStatus>('All');
  
  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<{
    username: string;
    password: string;
    name: string;
    role: UserRole;
    status: UserStatus;
    driveSkripsiLink: string;
    email?: string;
  }>({
    username: '',
    email: '',
    password: '',
    name: '',
    role: 'pegawai',
    status: 'active',
    driveSkripsiLink: ''
  });

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      name: '',
      role: 'pegawai',
      status: 'active',
      driveSkripsiLink: ''
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (user: UserAccount) => {
    setEditingUser(user);
    setFormData({
      username: user.username || (user.email ? user.email.split('@')[0] : ''),
      email: user.email || '',
      password: user.password || '',
      name: user.name,
      role: user.role,
      status: user.status,
      driveSkripsiLink: user.driveSkripsiLink || ''
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.name.trim()) {
      onNotify('Username dan Nama Lengkap wajib diisi.', 'error');
      return;
    }

    if (!editingUser && !formData.password.trim()) {
      onNotify('Password wajib diisi untuk pengguna baru.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingUser) {
        const res = await updateUser(editingUser.id, formData, currentAdminEmail, currentAdminName);
        if (res.success && res.user) {
          onNotify(`Data pengguna "${formData.name}" berhasil diperbarui.`, 'success');
          setIsFormOpen(false);
          onRefresh();
        } else {
          onNotify(res.message || 'Gagal memperbarui pengguna.', 'error');
        }
      } else {
        const res = await createUser(formData, currentAdminEmail, currentAdminName);
        if (res.success && res.user) {
          onNotify(`Pengguna "${formData.name}" (${formData.username}) berhasil didaftarkan ke Database Server!`, 'success');
          setIsFormOpen(false);
          onRefresh();
        } else {
          onNotify(res.message || 'Gagal menambahkan pengguna.', 'error');
        }
      }
    } catch (err: any) {
      onNotify(err.message || 'Terjadi kesalahan.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (user: UserAccount) => {
    if (user.email === 'rmasnanovita@gmail.com' || user.username === 'masna') {
      onNotify('Akun Super Administrator Utama tidak dapat dihapus.', 'error');
      return;
    }

    const confirm = window.confirm(`Apakah Anda yakin ingin menghapus "${user.name}" (${user.username || user.email}) dari whitelist server database?`);
    if (!confirm) return;

    try {
      const res = await deleteUser(user.id, currentAdminEmail, currentAdminName);
      if (res.success) {
        onNotify(`Pengguna "${user.name}" berhasil dihapus.`, 'success');
        onRefresh();
      } else {
        onNotify(res.message || 'Gagal menghapus pengguna.', 'error');
      }
    } catch {
      onNotify('Gagal menghapus pengguna.', 'error');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || 
                        (u.username && u.username.toLowerCase().includes(search.toLowerCase())) ||
                        u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'All' || u.role === filterRole;
    const matchStatus = filterStatus === 'All' || u.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  return (
    <div className="space-y-6" id="user-management-panel">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-indigo-100 uppercase tracking-wider">
              Whitelist Security
            </span>
            <span className="text-xs text-slate-400 font-semibold">• Total: {users.length} Akun</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display mt-1">
            Manajemen Pengguna &amp; Hak Akses
          </h1>
          <p className="text-sm text-slate-500">
            Daftarkan username dan password pegawai ke Database Server OneInAPP agar dapat login sebagai Pegawai atau Administrator.
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
            <UserPlus className="w-4 h-4" /> Tambah Pengguna Baru
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-6 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari berdasarkan nama atau username..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        </div>

        <div className="sm:col-span-3">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as any)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
          >
            <option value="All">Semua Role</option>
            <option value="admin">Administrator</option>
            <option value="pegawai">Pegawai</option>
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
          >
            <option value="All">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Non-Aktif</option>
          </select>
        </div>
      </div>

      {/* TABLE LIST */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left">
            <thead>
              <tr className="bg-slate-50/75 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3.5">Pengguna (Nama &amp; Username)</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5">Link Google Drive</th>
                <th className="px-6 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs">
                    Tidak ditemukan pengguna yang sesuai dengan pencarian atau filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                          u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-xs font-mono text-slate-500 flex items-center gap-1">
                            @{u.username || (u.email ? u.email.split('@')[0] : 'user')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Administrator
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Pegawai
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {u.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                          <CheckCircle2 className="w-3 h-3 text-green-600" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          <XCircle className="w-3 h-3 text-slate-400" /> Non-Aktif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-600 max-w-xs truncate">
                      {u.driveSkripsiLink ? (
                        <a 
                          href={u.driveSkripsiLink} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-indigo-600 hover:underline font-bold truncate block"
                        >
                          {u.driveSkripsiLink}
                        </a>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Pengguna"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {u.email !== 'rmasnanovita@gmail.com' && u.username !== 'masna' && (
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Pengguna"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL FORM TAMBAH / EDIT PENGGUNA */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 font-display">
                  {editingUser ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}
                </h3>
                <p className="text-xs text-slate-500">
                  Data ini disimpan ke Database Server untuk verifikasi login pengguna.
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
                  <label className="block text-xs font-bold text-slate-700">Username *</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Contoh: masna"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Password *</label>
                  <input
                    type="text"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Contoh: pass123"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Masna Fitria"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Role Hak Akses</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-extrabold"
                  >
                    <option value="pegawai">Pegawai Biasa</option>
                    <option value="admin">Administrator Kantor</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Status Akun</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as UserStatus })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  >
                    <option value="active">Aktif (Dapat Login)</option>
                    <option value="inactive">Non-Aktif (Akses Dikunci)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Link Google Drive</label>
                <input
                  type="url"
                  value={formData.driveSkripsiLink}
                  onChange={(e) => setFormData({ ...formData, driveSkripsiLink: e.target.value })}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-400">Link folder Google Drive pribadi untuk penyimpanan dokumen/berkas pegawai ini.</p>
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
                  {isSubmitting ? 'Menyimpan...' : editingUser ? 'Perbarui Data' : 'Simpan ke Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
