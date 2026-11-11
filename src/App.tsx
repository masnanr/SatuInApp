/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
  Activity, AppSettings, UserAccount, Team, PerformancePlan, 
  AdminLog, UserRole 
} from './types';
import { initAuth, logout } from './lib/firebase';
import { 
  verifyUserLogin, fetchUsers, fetchTeams, fetchPerformancePlans, 
  fetchServerActivities, fetchAdminLogs 
} from './lib/serverApi';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import ActivityLog from './components/ActivityLog';
import SubmitKipapp from './components/SubmitKipapp';
import Monitoring from './components/Monitoring';
import Settings from './components/Settings';


// Admin Components
import UserManagement from './components/admin/UserManagement';
import TeamManagement from './components/admin/TeamManagement';
import PerformancePlanManagement from './components/admin/PerformancePlanManagement';
import AdminAuditLog from './components/admin/AdminAuditLog';

import { 
  Database, BarChart3, PlusCircle, CheckSquare, Users2, Settings2, 
  LogOut, RefreshCw, Bell, AlertCircle, Sparkles, Check, Info, X,
  ShieldCheck, UserCheck, Layers, CalendarRange, History, HardDrive,
  FileSpreadsheet, ArrowRightLeft, UserPlus, Server, Trophy, Target
} from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [currentUserAccount, setCurrentUserAccount] = useState<UserAccount | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('pegawai');
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginErrorMessage, setLoginErrorMessage] = useState<string | null>(null);

  // App Navigation state
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Server Database Data states
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [performancePlans, setPerformancePlans] = useState<PerformancePlan[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // App Settings (Drive / Target settings)
  const [settings, setSettings] = useState<AppSettings>({
    spreadsheetId: '1YIFcJxjt2flsClWeU2emocR2Nglc0-tgl1xkXk16goI',
    adminEmail: 'rmasnanovita@gmail.com',
    headOfTeamEmail: 'kepalateam@bps.go.id',
    headOfOfficeEmail: 'kepalakantor@bps.go.id',
    monthlyTarget: 10
  });

  // Custom Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);

  const triggerNotify = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // 1. Initial Data Fetching from Server Database
  const fetchAllServerData = async () => {
    setIsDataLoading(true);
    try {
      const [fetchedActivities, fetchedUsers, fetchedTeams, fetchedPlans, fetchedLogs] = await Promise.all([
        fetchServerActivities(),
        fetchUsers(),
        fetchTeams(),
        fetchPerformancePlans(),
        fetchAdminLogs()
      ]);

      setActivities(fetchedActivities);
      setUsers(fetchedUsers);
      setTeams(fetchedTeams);
      setPerformancePlans(fetchedPlans);
      setAdminLogs(fetchedLogs);
    } catch (error) {
      console.error('Error fetching data from server:', error);
      triggerNotify('Gagal sinkronisasi dengan Database Server.', 'error');
    } finally {
      setIsDataLoading(false);
    }
  };

  // 2. Auth state initialization
  useEffect(() => {
    initAuth(
      async (currentUser, cachedToken) => {
        setUser(currentUser);
        setToken(cachedToken);
        setAuthLoading(false);
      },
      () => {
        setNeedsAuth(true);
        setAuthLoading(false);
      }
    );

    // Initial server fetch
    fetchAllServerData();
  }, []);

  // 3. Login handler with Database Password Verification & Role
  const handleLogin = async (email: string, password: string, selectedRole: UserRole) => {
    setAuthLoading(true);
    setLoginErrorMessage(null);

    try {
      if (!email) {
        setLoginErrorMessage('Email atau username harus diisi.');
        setAuthLoading(false);
        return;
      }

      // Check Database Server Login & Password
      const verifyRes = await verifyUserLogin(email, password, selectedRole);

      if (!verifyRes.success || !verifyRes.user) {
        setLoginErrorMessage(verifyRes.message || 'Akses ditolak oleh Database Server SatuInApp.');
        setNeedsAuth(true);
        triggerNotify(verifyRes.message || 'Akses ditolak.', 'error');
        setAuthLoading(false);
        return;
      }

      // Successful verification
      const userAccount = verifyRes.user;
      setCurrentUserAccount(userAccount);
      setUserRole(userAccount.role);

      setUser({
        uid: userAccount.id,
        email: userAccount.email,
        displayName: userAccount.name,
        photoURL: null
      } as any);
      setToken(`token-${userAccount.id}`);

      setNeedsAuth(false);
      
      // Set default tab according to role
      if (userAccount.role === 'admin') {
        setActiveTab('admin-dashboard');
      } else {
        setActiveTab('dashboard');
      }

      triggerNotify(`Selamat datang, ${userAccount.name}! Berhasil masuk sebagai ${userAccount.role.toUpperCase()}.`, 'success');
      await fetchAllServerData();
    } catch (error: any) {
      console.error(error);
      setLoginErrorMessage('Terjadi kendala saat menghubungkan ke autentikasi.');
      triggerNotify('Gagal masuk ke aplikasi.', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    const confirmLogout = window.confirm('Apakah Anda yakin ingin keluar dari SatuInApp?');
    if (!confirmLogout) return;

    try {
      await logout();
    } catch (e) {
      console.warn('Logout warning:', e);
    } finally {
      setUser(null);
      setCurrentUserAccount(null);
      setToken(null);
      setNeedsAuth(true);
      setActiveTab('dashboard');
      triggerNotify('Anda telah berhasil keluar dari sistem.', 'success');
    }
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('satuinapp_settings', JSON.stringify(newSettings));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center space-y-4" id="app-loading-container">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <div className="font-extrabold text-slate-800 text-base font-display">SatuInApp</div>
          <p className="text-slate-500 text-xs font-medium mt-1">Menghubungkan ke Database Server &amp; Auth...</p>
        </div>
      </div>
    );
  }

  if (needsAuth || !user) {
    return (
      <LoginScreen 
        onLogin={handleLogin} 
        isLoading={authLoading} 
        errorMessage={loginErrorMessage} 
      />
    );
  }

  const teamNames = teams.map(t => t.name);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col" id="app-workspace">
      
      {/* GLOBAL NAVBAR / NAVIGATION HEADER */}
      <nav className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* BRAND LOGO */}
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-md shadow-indigo-100 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-base tracking-tight font-display text-slate-900">SatuInApp</span>
                  {userRole === 'admin' ? (
                    <span className="bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-full font-extrabold tracking-wider uppercase">
                      ADMIN
                    </span>
                  ) : (
                    <span className="bg-emerald-600 text-white text-[9px] px-2 py-0.5 rounded-full font-extrabold tracking-wider uppercase">
                      PEGAWAI
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* TAB LINKS (Desktop Only) */}
            <div className="hidden lg:flex items-center gap-1">
              {userRole === 'admin' ? (
                // ADMIN MENU NAVIGATION
                <>
                  <button
                    onClick={() => setActiveTab('admin-dashboard')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      activeTab === 'admin-dashboard' ? 'bg-indigo-50 text-indigo-700 shadow-xs' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" /> Ringkasan Admin
                  </button>
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      activeTab === 'users' ? 'bg-indigo-50 text-indigo-700 shadow-xs' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <UserPlus className="w-4 h-4" /> Pengguna (Whitelist)
                  </button>
                  <button
                    onClick={() => setActiveTab('teams')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      activeTab === 'teams' ? 'bg-indigo-50 text-indigo-700 shadow-xs' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <Layers className="w-4 h-4" /> Tim Kerja
                  </button>

                  <button
                    onClick={() => setActiveTab('plans')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      activeTab === 'plans' ? 'bg-indigo-50 text-indigo-700 shadow-xs' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <CalendarRange className="w-4 h-4" /> Rencana Kinerja
                  </button>
                  <button
                    onClick={() => setActiveTab('monitoring')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      activeTab === 'monitoring' ? 'bg-indigo-50 text-indigo-700 shadow-xs' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <Users2 className="w-4 h-4" /> Monitoring
                  </button>
                </>
              ) : (
                // PEGAWAI MENU NAVIGATION
                <>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700 shadow-xs' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" /> Dashboard
                  </button>
                  <button
                    onClick={() => setActiveTab('input')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'input' ? 'bg-indigo-50 text-indigo-700 shadow-xs' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <PlusCircle className="w-4 h-4" /> Input Kegiatan
                  </button>
                  <button
                    onClick={() => setActiveTab('kipapp')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'kipapp' ? 'bg-indigo-50 text-indigo-700 shadow-xs' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <CheckSquare className="w-4 h-4" /> Submit KIPAPP
                  </button>
                  <button
                    onClick={() => setActiveTab('monitoring')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'monitoring' ? 'bg-indigo-50 text-indigo-700 shadow-xs' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <Users2 className="w-4 h-4" /> Monitoring Pegawai
                  </button>
                </>
              )}
            </div>

            {/* LOGGED IN USER & ACTIONS */}
            <div className="flex items-center gap-3">
              {/* Refresh Database Data button */}
              <button
                type="button"
                onClick={fetchAllServerData}
                disabled={isDataLoading}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                title="Sinkronisasi Ulang Database Server"
              >
                <RefreshCw className={`w-4 h-4 ${isDataLoading ? 'animate-spin text-indigo-600' : ''}`} />
              </button>

              <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                  userRole === 'admin' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                }`}>
                  {(currentUserAccount?.name || user.displayName || 'P').substring(0, 2).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-bold text-slate-800 max-w-[160px] truncate">
                    {currentUserAccount?.name || user.displayName || 'Pegawai'}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                title="Keluar dari Aplikasi"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* MOBILE SUB NAVIGATION */}
      <div className="bg-white border-b border-slate-200/80 p-2 overflow-x-auto flex lg:hidden gap-1.5 justify-start px-4">
        {userRole === 'admin' ? (
          <>
            <button
              onClick={() => setActiveTab('admin-dashboard')}
              className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
                activeTab === 'admin-dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Ringkasan
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
                activeTab === 'users' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Pengguna
            </button>
            <button
              onClick={() => setActiveTab('teams')}
              className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
                activeTab === 'teams' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Tim
            </button>

            <button
              onClick={() => setActiveTab('plans')}
              className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
                activeTab === 'plans' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" /> Rencana
            </button>
            <button
              onClick={() => setActiveTab('monitoring')}
              className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
                activeTab === 'monitoring' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
              }`}
            >
              <Users2 className="w-3.5 h-3.5" /> Monitoring
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
                activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab('input')}
              className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
                activeTab === 'input' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" /> Input
            </button>
            <button
              onClick={() => setActiveTab('kipapp')}
              className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
                activeTab === 'kipapp' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" /> Submit KIPAPP
            </button>
            <button
              onClick={() => setActiveTab('monitoring')}
              className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
                activeTab === 'monitoring' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
              }`}
            >
              <Users2 className="w-3.5 h-3.5" /> Monitoring
            </button>
          </>
        )}
      </div>

      {/* MAIN VIEW AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* --- ADMIN VIEWS --- */}
        {userRole === 'admin' && activeTab === 'admin-dashboard' && (
          <div className="space-y-6" id="admin-dashboard-summary">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-indigo-100 uppercase tracking-wider">
                  Panel Administrator
                </span>
                <h1 className="text-2xl font-extrabold text-slate-900 font-display mt-1">
                  Pusat Kendali Administrasi SatuInApp
                </h1>
                <p className="text-sm text-slate-500">
                  Ringkasan data master, struktur tim, rencana kinerja tahunan, dan aktivitas server database.
                </p>
              </div>
            </div>

            {/* STATS OVERVIEW CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div 
                onClick={() => setActiveTab('users')}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pengguna</div>
                  <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <UserPlus className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 text-3xl font-black font-display text-slate-900">{users.length}</div>
                <div className="mt-1 text-xs text-indigo-600 font-bold flex items-center gap-1">
                  Lihat Whitelist Pengguna &rarr;
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('teams')}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Master Tim Kerja</div>
                  <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                    <Layers className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 text-3xl font-black font-display text-slate-900">{teams.length}</div>
                <div className="mt-1 text-xs text-blue-600 font-bold flex items-center gap-1">
                  Kelola Tim Kantor &rarr;
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('plans')}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rencana Kinerja</div>
                  <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
                    <CalendarRange className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 text-3xl font-black font-display text-slate-900">{performancePlans.length}</div>
                <div className="mt-1 text-xs text-amber-600 font-bold flex items-center gap-1">
                  Atur Target Tahunan &rarr;
                </div>
              </div>
            </div>

            {/* QUICK ACTIONS & RECENT ACTIVITIES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* RECENT ADMIN ACTIONS */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-900 text-sm font-display">Tindakan Admin Terbaru</h3>
                  <button 
                    onClick={() => setActiveTab('logs')}
                    className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                  >
                    Lihat Semua Log
                  </button>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {adminLogs.slice(0, 5).map(log => (
                    <div key={log.id} className="py-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-800">{log.action}</div>
                        <div className="text-slate-500 mt-0.5">{log.details}</div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleDateString('id-ID')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* QUICK ACCESS TO MONITORING */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4 flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm font-display">Monitoring Kinerja Pegawai Terpadu</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Pantau capaian target bulanan pegawai, persentase progress, dan rekap dokumen lampiran Google Drive seluruh tim secara langsung.
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('monitoring')}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-md cursor-pointer transition-all text-center"
                  >
                    Buka Dashboard Monitoring Pegawai
                  </button>
                </div>
              </div>
            </div>

            {/* EMBEDDED AUDIT LOGS IN ADMIN SUMMARY */}
            <div className="pt-6">
              <AdminAuditLog
                logs={adminLogs}
                onRefresh={fetchAllServerData}
              />
            </div>
          </div>
        )}

        {userRole === 'admin' && activeTab === 'users' && (
          <UserManagement
            users={users}
            teams={teamNames}
            currentAdminEmail={user.email || 'admin@satuinapp.local'}
            currentAdminName={currentUserAccount?.name || user.displayName || 'Administrator'}
            token={token || undefined}
            onRefresh={fetchAllServerData}
            onNotify={triggerNotify}
          />
        )}

        {userRole === 'admin' && activeTab === 'teams' && (
          <TeamManagement
            teams={teams}
            currentAdminEmail={user.email || 'admin@satuinapp.local'}
            currentAdminName={currentUserAccount?.name || user.displayName || 'Administrator'}
            onRefresh={fetchAllServerData}
            onNotify={triggerNotify}
          />
        )}

        {userRole === 'admin' && activeTab === 'plans' && (
          <PerformancePlanManagement
            plans={performancePlans}
            teams={teams}
            currentAdminEmail={user.email || 'admin@satuinapp.local'}
            currentAdminName={currentUserAccount?.name || user.displayName || 'Administrator'}
            onRefresh={fetchAllServerData}
            onNotify={triggerNotify}
          />
        )}

        {/* --- COMMON / PEGAWAI VIEWS --- */}
        {activeTab === 'dashboard' && (
          <Dashboard
            allActivities={activities}
            performancePlans={performancePlans}
            users={users}
            teams={teams}
            settings={settings}
            onNotify={triggerNotify}
          />
        )}

        {activeTab === 'input' && (
          <ActivityLog
            token={token || ''}
            userEmail={user.email || ''}
            userName={currentUserAccount?.name || user.displayName || ''}
            userTeam={currentUserAccount?.team}
            currentUserAccount={currentUserAccount}
            settings={settings}
            teams={teams}
            performancePlans={performancePlans}
            onRefreshData={fetchAllServerData}
            allActivities={activities}
            onNotify={triggerNotify}
          />
        )}

        {activeTab === 'kipapp' && (
          <SubmitKipapp
            userEmail={user.email || ''}
            allActivities={activities}
            onNotify={triggerNotify}
            isAdmin={userRole === 'admin'}
          />
        )}

        {activeTab === 'monitoring' && (
          <Monitoring
            allActivities={activities}
            settings={settings}
          />
        )}

        {activeTab === 'settings' && (
          <Settings
            token={token || ''}
            settings={settings}
            currentUserAccount={currentUserAccount}
            onSaveSettings={handleSaveSettings}
            onUpdateUserAccount={(updated) => setCurrentUserAccount(updated)}
            onNotify={triggerNotify}
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200/80 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400">
          <p><strong>SatuInApp</strong> &copy; 2026 • Developed by Masna Novita Rahmaniar</p>
        </div>
      </footer>

      {/* CUSTOM TOAST NOTIFICATION CONTAINER */}
      <div className="fixed bottom-5 right-5 space-y-2.5 z-50 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-xl pointer-events-auto bg-white/95 backdrop-blur-xs ${
              toast.type === 'success' 
                ? 'border-emerald-200 text-emerald-800' 
                : toast.type === 'error' 
                  ? 'border-rose-200 text-rose-800' 
                  : 'border-blue-200 text-blue-800'
            }`}
          >
            <div className="mt-0.5">
              {toast.type === 'success' && <Check className="w-4 h-4 text-emerald-600" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
              {toast.type === 'info' && <Info className="w-4 h-4 text-blue-600" />}
            </div>
            <div className="flex-1 text-xs font-semibold leading-relaxed">
              {toast.message}
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
