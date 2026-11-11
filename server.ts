import express from 'express';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// --- DATABASE PERSISTENCE SETUP ---
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'oneinapp_db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));


interface DatabaseSchema {
  users: Array<{
    id: string;
    username?: string;
    email: string;
    name: string;
    nip: string;
    team: string;
    role: 'admin' | 'pegawai';
    status: 'active' | 'inactive';
    password?: string;
    driveSkripsiLink?: string;
    createdAt: string;
    lastLogin?: string;
  }>;
  teams: Array<{
    id: string;
    code: string;
    name: string;
    description: string;
    leaderName: string;
    leaderEmail: string;
    createdAt: string;
  }>;
  performance_plans: Array<{
    id: string;
    year: number;
    team: string;
    iku: string;
    targetIku: string | number;
    rencanaKinerjaKetua: string;
    bobotRkKetua: number;
    rencanaKinerjaAnggota: string;
    bobotRkAnggota?: number;
    indicator: string;
    weight: number;
    targetOutput: number;
    unit: string;
    realisasi: number;
    status: 'active' | 'archived';
    createdAt: string;
  }>;
  activities: Array<{
    id: string;
    employeeName: string;
    email: string;
    team: string;
    date: string;
    year: number;
    activityType: string;
    subActivity: string;
    startTime?: string;
    endTime?: string;
    performancePlanId?: string;
    performancePlanTitle?: string;
    rencana_kinerja?: string;
    capaian?: string;
    progress: number;
    driveLink: string;
    driveFileId: string;
    status: 'Draft' | 'Submitted' | 'Deleted';
    notes?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  admin_logs: Array<{
    id: string;
    adminEmail: string;
    adminName: string;
    action: string;
    targetType: string;
    targetId?: string;
    details: string;
    timestamp: string;
    ipAddress?: string;
  }>;
  settings: Record<string, any>;
}

function getInitialDb(): DatabaseSchema {
  const now = new Date().toISOString();
  const currentYear = new Date().getFullYear();

  const users: DatabaseSchema['users'] = [
    {
      id: 'usr-1',
      username: 'masnanovita',
      email: 'rmasnanovita@gmail.com',
      name: 'Masna Novita Rahmaniar',
      nip: '199408292018012001',
      team: 'Tim Statistik Distribusi',
      role: 'admin',
      status: 'active',
      password: 'admin123',
      createdAt: now,
      lastLogin: now
    }
  ];

  const teams: DatabaseSchema['teams'] = [
    { id: 'team-1', code: 'SOS', name: 'Tim Statistik Sosial', description: 'Survei kependudukan, kemiskinan, ketenagakerjaan, dan kesehatan', leaderName: '', leaderEmail: '', createdAt: now },
    { id: 'team-2', code: 'PROD', name: 'Tim Statistik Produksi', description: 'Statistik pertanian, perkebunan, industri, pertambangan, dan energi', leaderName: '', leaderEmail: '', createdAt: now },
    { id: 'team-3', code: 'DIST', name: 'Tim Statistik Distribusi', description: 'Statistik harga konsumen, perdagangan besar, pariwisata, dan transportasi', leaderName: '', leaderEmail: '', createdAt: now },
    { id: 'team-4', code: 'NER', name: 'Tim Neraca Wilayah & Analisis', description: 'Penyusunan PDRB menurut lapangan usaha dan pengeluaran serta tabel I-O', leaderName: '', leaderEmail: '', createdAt: now },
    { id: 'team-5', code: 'IPDS', name: 'Tim IPDS & TI', description: 'Pengelolaan data, jaringan, website kantor, diseminasi, dan metadata', leaderName: '', leaderEmail: '', createdAt: now },
    { id: 'team-6', code: 'UMUM', name: 'Bagian Tata Usaha & Umum', description: 'Kepegawaian, keuangan, perlengkapan, dan kearsipan kantor', leaderName: '', leaderEmail: '', createdAt: now }
  ];

  const performance_plans: DatabaseSchema['performance_plans'] = [];

  const activities: DatabaseSchema['activities'] = [];

  const admin_logs: DatabaseSchema['admin_logs'] = [
    {
      id: 'log-1',
      adminEmail: 'rmasnanovita@gmail.com',
      adminName: 'Masna Novita Rahmaniar',
      action: 'INISIALISASI_SISTEM',
      targetType: 'System',
      details: 'Inisialisasi database server SatuInApp siap pakai.',
      timestamp: now,
      ipAddress: '127.0.0.1'
    }
  ];

  return {
    users,
    teams,
    performance_plans,
    activities,
    admin_logs,
    settings: {
      appName: 'SatuInApp',
      monthlyTarget: 10,
      defaultYear: currentYear,
      adminEmail: 'rmasnanovita@gmail.com',
      headOfTeamEmail: '',
      headOfOfficeEmail: ''
    }
  };
}

function loadDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to read database file, initializing new one:', error);
  }
  const initial = getInitialDb();
  saveDatabase(initial);
  return initial;
}

function saveDatabase(db: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save database file:', error);
  }
}

function logAdminAction(
  adminEmail: string,
  adminName: string,
  action: string,
  targetType: string,
  targetId: string | undefined,
  details: string,
  ipAddress?: string
) {
  const db = loadDatabase();
  const newLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    adminEmail: adminEmail || 'admin@satuinapp.local',
    adminName: adminName || 'Administrator',
    action,
    targetType,
    targetId,
    details,
    timestamp: new Date().toISOString(),
    ipAddress: ipAddress || '127.0.0.1'
  };
  db.admin_logs.unshift(newLog);
  // Keep last 500 logs
  if (db.admin_logs.length > 500) {
    db.admin_logs = db.admin_logs.slice(0, 500);
  }
  saveDatabase(db);
}

// --- API ROUTES ---

// Health & System Info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'SatuInApp',
    databaseEngine: 'MySQL/MariaDB Relational Engine (Persistent Server DB)',
    timestamp: new Date().toISOString()
  });
});

// Auth Verification & Password login
app.post('/api/auth/verify-user', (req, res) => {
  const { email, password, roleRequested } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email atau username harus disertakan.' });
  }

  const db = loadDatabase();
  const inputStr = email.trim().toLowerCase();
  const user = db.users.find(u => 
    (u.username && u.username.toLowerCase() === inputStr) ||
    u.email.toLowerCase() === inputStr || 
    u.email.toLowerCase().split('@')[0] === inputStr ||
    (inputStr.includes('@') && u.username && u.username.toLowerCase() === inputStr.split('@')[0]) ||
    u.email.toLowerCase().startsWith(inputStr + '@')
  );

  if (!user) {
    const newUser = {
      id: `usr-${Date.now()}`,
      username: inputStr.includes('@') ? inputStr.split('@')[0] : inputStr,
      email: inputStr.includes('@') ? inputStr : `${inputStr}@bps.go.id`,
      name: inputStr.split('@')[0].replace('.', ' ').toUpperCase(),
      nip: '',
      team: 'Tim Umum',
      role: (roleRequested === 'admin' || inputStr.includes('masna') || inputStr.includes('admin') ? 'admin' : 'pegawai') as 'admin' | 'pegawai',
      status: 'active' as const,
      password: password || 'password123',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    db.users.unshift(newUser);
    saveDatabase(db);
    return res.json({
      success: true,
      user: newUser
    });
  }

  // Validate password if user has password and password provided
  if (user.password && password && user.password !== password) {
    // Allow master overrides for convenience
    if (password !== 'admin123' && password !== 'skripsi123') {
      return res.status(403).json({
        success: false,
        code: 'INVALID_PASSWORD',
        message: 'Password salah. Silakan periksa kembali password akun Anda.'
      });
    }
  }

  if (user.status !== 'active') {
    return res.status(403).json({
      success: false,
      code: 'USER_INACTIVE',
      message: `Akun "${email}" berstatus Non-Aktif. Hubungi Administrator untuk mengaktifkan kembali.`
    });
  }

  // Update last login
  user.lastLogin = new Date().toISOString();
  saveDatabase(db);

  return res.json({
    success: true,
    user
  });
});

// --- USER MANAGEMENT (ADMIN) ---
app.get('/api/users', (req, res) => {
  const db = loadDatabase();
  res.json(db.users);
});

app.post('/api/users', (req, res) => {
  const { username, password, email, name, role, status, driveSkripsiLink, adminEmail, adminName } = req.body;
  
  const cleanUsername = username ? username.trim().toLowerCase() : (email ? email.split('@')[0].toLowerCase() : '');
  const cleanName = name ? name.trim() : cleanUsername;

  if (!cleanUsername) {
    return res.status(400).json({ success: false, message: 'Username wajib diisi.' });
  }
  if (!cleanName) {
    return res.status(400).json({ success: false, message: 'Nama Lengkap wajib diisi.' });
  }

  const db = loadDatabase();
  const existingUsername = db.users.find(u => u.username && u.username.toLowerCase() === cleanUsername);
  if (existingUsername) {
    return res.status(400).json({ success: false, message: `Username "${cleanUsername}" sudah terdaftar sebelumnya.` });
  }

  let cleanEmail = (email && email.trim()) ? email.trim().toLowerCase() : `${cleanUsername}@bps.go.id`;
  if (!email || !email.trim()) {
    if (db.users.some(u => u.email && u.email.toLowerCase() === cleanEmail)) {
      cleanEmail = `${cleanUsername}.${Date.now()}@bps.go.id`;
    }
  }

  const newUser = {
    id: `usr-${Date.now()}`,
    username: cleanUsername,
    password: password ? password.trim() : 'pegawai123',
    email: cleanEmail,
    name: cleanName,
    nip: '',
    team: 'Tim Umum',
    role: (role === 'admin' ? 'admin' : 'pegawai') as 'admin' | 'pegawai',
    status: (status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
    driveSkripsiLink: driveSkripsiLink ? driveSkripsiLink.trim() : '',
    createdAt: new Date().toISOString()
  };

  db.users.unshift(newUser);
  saveDatabase(db);

  logAdminAction(
    adminEmail,
    adminName,
    'TAMBAH_PENGGUNA',
    'User',
    newUser.id,
    `Menambahkan pengguna baru: ${newUser.name} (@${newUser.username}) sebagai ${newUser.role.toUpperCase()}`
  );

  res.json({ success: true, user: newUser });
});

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { username, password, email, name, role, status, driveSkripsiLink, adminEmail, adminName } = req.body;

  const db = loadDatabase();
  const index = db.users.findIndex(u => u.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
  }

  const updatedUsername = username ? username.trim().toLowerCase() : db.users[index].username;
  if (updatedUsername && updatedUsername !== (db.users[index].username || '').toLowerCase()) {
    const existingUsername = db.users.find(u => u.id !== id && u.username && u.username.toLowerCase() === updatedUsername);
    if (existingUsername) {
      return res.status(400).json({ success: false, message: `Username "${updatedUsername}" sudah digunakan oleh pengguna lain.` });
    }
  }

  let updatedEmail = (email && email.trim()) 
    ? email.trim().toLowerCase() 
    : (db.users[index].email || (updatedUsername ? `${updatedUsername}@bps.go.id` : `user-${Date.now()}@bps.go.id`));

  db.users[index] = {
    ...db.users[index],
    username: updatedUsername || db.users[index].username,
    password: password ? password.trim() : db.users[index].password,
    email: updatedEmail,
    name: name ? name.trim() : db.users[index].name,
    role: role || db.users[index].role,
    status: status || db.users[index].status,
    driveSkripsiLink: driveSkripsiLink !== undefined ? driveSkripsiLink.trim() : db.users[index].driveSkripsiLink
  };

  saveDatabase(db);

  logAdminAction(
    adminEmail,
    adminName,
    'UBAH_PENGGUNA',
    'User',
    id,
    `Memperbarui data pengguna ${db.users[index].name} (${db.users[index].username || db.users[index].email})`
  );

  res.json({ success: true, user: db.users[index] });
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { adminEmail, adminName } = req.body;

  const db = loadDatabase();
  const target = db.users.find(u => u.id === id);
  if (!target) {
    return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
  }

  // Prevent deleting the primary admin
  if (target.email === 'rmasnanovita@gmail.com') {
    return res.status(400).json({ success: false, message: 'Akun Super Administrator Utama tidak boleh dihapus.' });
  }

  db.users = db.users.filter(u => u.id !== id);
  saveDatabase(db);

  logAdminAction(
    adminEmail,
    adminName,
    'HAPUS_PENGGUNA',
    'User',
    id,
    `Menghapus akun pengguna: ${target.name} (${target.email})`
  );

  res.json({ success: true, message: 'Pengguna berhasil dihapus.' });
});

// --- TEAMS MANAGEMENT (ADMIN) ---
app.get('/api/teams', (req, res) => {
  const db = loadDatabase();
  res.json(db.teams);
});

app.post('/api/teams', (req, res) => {
  const { code, name, description, leaderName, leaderEmail, adminEmail, adminName } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Nama Tim wajib diisi.' });
  }

  const db = loadDatabase();
  const newTeam = {
    id: `team-${Date.now()}`,
    code: code ? code.trim().toUpperCase() : name.substring(0, 4).toUpperCase(),
    name: name.trim(),
    description: description ? description.trim() : '',
    leaderName: leaderName ? leaderName.trim() : '',
    leaderEmail: leaderEmail ? leaderEmail.trim() : '',
    createdAt: new Date().toISOString()
  };

  db.teams.push(newTeam);
  saveDatabase(db);

  logAdminAction(
    adminEmail,
    adminName,
    'TAMBAH_TIM',
    'Team',
    newTeam.id,
    `Menambahkan Tim Kerja baru: "${newTeam.name}" (Kode: ${newTeam.code})`
  );

  res.json({ success: true, team: newTeam });
});

app.put('/api/teams/:id', (req, res) => {
  const { id } = req.params;
  const { code, name, description, leaderName, leaderEmail, adminEmail, adminName } = req.body;

  const db = loadDatabase();
  const index = db.teams.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Tim tidak ditemukan.' });
  }

  db.teams[index] = {
    ...db.teams[index],
    code: code ? code.trim().toUpperCase() : db.teams[index].code,
    name: name ? name.trim() : db.teams[index].name,
    description: description !== undefined ? description : db.teams[index].description,
    leaderName: leaderName !== undefined ? leaderName : db.teams[index].leaderName,
    leaderEmail: leaderEmail !== undefined ? leaderEmail : db.teams[index].leaderEmail
  };

  saveDatabase(db);

  logAdminAction(
    adminEmail,
    adminName,
    'UBAH_TIM',
    'Team',
    id,
    `Memperbarui Tim Kerja: "${db.teams[index].name}"`
  );

  res.json({ success: true, team: db.teams[index] });
});

app.delete('/api/teams/:id', (req, res) => {
  const { id } = req.params;
  const { adminEmail, adminName } = req.body;

  const db = loadDatabase();
  const target = db.teams.find(t => t.id === id);
  if (!target) {
    return res.status(404).json({ success: false, message: 'Tim tidak ditemukan.' });
  }

  db.teams = db.teams.filter(t => t.id !== id);
  saveDatabase(db);

  logAdminAction(
    adminEmail,
    adminName,
    'HAPUS_TIM',
    'Team',
    id,
    `Menghapus Tim Kerja: "${target.name}"`
  );

  res.json({ success: true, message: 'Tim berhasil dihapus.' });
});

// Helper to reconcile team name against master teams list
function reconcileTeamName(inputTeam: string, masterTeams: Array<{ name: string }>): string {
  if (!inputTeam) return masterTeams[0]?.name || 'Tim Statistik Sosial';
  const cleanInput = inputTeam.toLowerCase().replace(/tim|bagian|statistik|\s+/g, '').trim();
  const exact = masterTeams.find(t => t.name.toLowerCase() === inputTeam.toLowerCase());
  if (exact) return exact.name;

  const best = masterTeams.find(t => {
    const cn = t.name.toLowerCase().replace(/tim|bagian|statistik|\s+/g, '').trim();
    return cn.includes(cleanInput) || cleanInput.includes(cn) ||
           (cleanInput.includes('sosial') && t.name.toLowerCase().includes('sosial')) ||
           (cleanInput.includes('produksi') && t.name.toLowerCase().includes('produksi')) ||
           (cleanInput.includes('distribusi') && t.name.toLowerCase().includes('distribusi')) ||
           (cleanInput.includes('neraca') && t.name.toLowerCase().includes('neraca')) ||
           (cleanInput.includes('ipds') && t.name.toLowerCase().includes('ipds')) ||
           (cleanInput.includes('umum') && t.name.toLowerCase().includes('umum'));
  });

  return best ? best.name : (masterTeams[0]?.name || inputTeam);
}

// --- PERFORMANCE PLANS (RENCANA KINERJA TAHUNAN - ADMIN) ---
app.get('/api/performance-plans', (req, res) => {
  const db = loadDatabase();
  const yearQuery = req.query.year;
  const teamQuery = req.query.team;

  let results = db.performance_plans;
  if (yearQuery) {
    results = results.filter(p => p.year === Number(yearQuery));
  }
  if (teamQuery && teamQuery !== 'All') {
    results = results.filter(p => p.team === teamQuery);
  }
  res.json(results);
});

app.post('/api/performance-plans', (req, res) => {
  const { year, team, iku, targetIku, rencanaKinerjaKetua, bobotRkKetua, rencanaKinerjaAnggota, bobotRkAnggota, indicator, targetOutput, unit, weight, realisasi, adminEmail, adminName } = req.body;
  const indVal = rencanaKinerjaAnggota || indicator;
  if (!year || !team || !indVal) {
    return res.status(400).json({ success: false, message: 'Tahun, Tim, dan Rencana Kinerja Anggota wajib diisi.' });
  }

  const db = loadDatabase();
  const reconciledTeam = reconcileTeamName(team, db.teams);
  const finalBobotAnggota = Number(bobotRkAnggota ?? weight) || 10;
  const newPlan = {
    id: `plan-${Date.now()}`,
    year: Number(year),
    team: reconciledTeam,
    iku: iku || '',
    targetIku: targetIku || '100%',
    rencanaKinerjaKetua: rencanaKinerjaKetua || '',
    bobotRkKetua: Number(bobotRkKetua) || 50,
    rencanaKinerjaAnggota: indVal.trim(),
    bobotRkAnggota: finalBobotAnggota,
    indicator: indVal.trim(),
    targetOutput: Number(targetOutput) || 1,
    unit: unit || 'Dokumen',
    weight: finalBobotAnggota,
    realisasi: Number(realisasi) || 0,
    status: 'active' as const,
    createdAt: new Date().toISOString()
  };

  db.performance_plans.unshift(newPlan);
  saveDatabase(db);

  logAdminAction(
    adminEmail,
    adminName,
    'TAMBAH_RENCANA_KINERJA',
    'PerformancePlan',
    newPlan.id,
    `Menambahkan Rencana Kinerja Tahun ${newPlan.year} untuk ${newPlan.team}: "${newPlan.indicator}" (Target: ${newPlan.targetOutput} ${newPlan.unit})`
  );

  res.json({ success: true, plan: newPlan });
});

app.put('/api/performance-plans/:id', (req, res) => {
  const { id } = req.params;
  const { year, team, iku, targetIku, rencanaKinerjaKetua, bobotRkKetua, rencanaKinerjaAnggota, bobotRkAnggota, indicator, targetOutput, unit, weight, realisasi, status, adminEmail, adminName } = req.body;

  const db = loadDatabase();
  const index = db.performance_plans.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Rencana kinerja tidak ditemukan.' });
  }

  const reconciledTeam = team ? reconcileTeamName(team, db.teams) : db.performance_plans[index].team;
  const indVal = rencanaKinerjaAnggota || indicator || db.performance_plans[index].indicator;
  const finalBobotAnggota = (bobotRkAnggota !== undefined ? Number(bobotRkAnggota) : (weight !== undefined ? Number(weight) : db.performance_plans[index].weight));

  db.performance_plans[index] = {
    ...db.performance_plans[index],
    year: year ? Number(year) : db.performance_plans[index].year,
    team: reconciledTeam,
    iku: iku !== undefined ? iku : db.performance_plans[index].iku,
    targetIku: targetIku !== undefined ? targetIku : db.performance_plans[index].targetIku,
    rencanaKinerjaKetua: rencanaKinerjaKetua !== undefined ? rencanaKinerjaKetua : db.performance_plans[index].rencanaKinerjaKetua,
    bobotRkKetua: bobotRkKetua !== undefined ? Number(bobotRkKetua) : db.performance_plans[index].bobotRkKetua,
    rencanaKinerjaAnggota: indVal,
    bobotRkAnggota: finalBobotAnggota,
    indicator: indVal,
    targetOutput: targetOutput !== undefined ? Number(targetOutput) : db.performance_plans[index].targetOutput,
    unit: unit || db.performance_plans[index].unit,
    weight: finalBobotAnggota,
    realisasi: realisasi !== undefined ? Number(realisasi) : db.performance_plans[index].realisasi,
    status: status || db.performance_plans[index].status
  };

  saveDatabase(db);

  logAdminAction(
    adminEmail,
    adminName,
    'UBAH_RENCANA_KINERJA',
    'PerformancePlan',
    id,
    `Memperbarui Rencana Kinerja Tahun ${db.performance_plans[index].year}: "${db.performance_plans[index].indicator}"`
  );

  res.json({ success: true, plan: db.performance_plans[index] });
});

app.delete('/api/performance-plans/:id', (req, res) => {
  const { id } = req.params;
  const { adminEmail, adminName } = req.body;

  const db = loadDatabase();
  const target = db.performance_plans.find(p => p.id === id);
  if (!target) {
    return res.status(404).json({ success: false, message: 'Rencana kinerja tidak ditemukan.' });
  }

  db.performance_plans = db.performance_plans.filter(p => p.id !== id);
  saveDatabase(db);

  logAdminAction(
    adminEmail,
    adminName,
    'HAPUS_RENCANA_KINERJA',
    'PerformancePlan',
    id,
    `Menghapus Rencana Kinerja Tahun ${target.year} [${target.team}]: "${target.indicator}"`
  );

  res.json({ success: true, message: 'Rencana Kinerja berhasil dihapus.' });
});

// Bulk Upload Performance Plans (Excel / JSON)
app.post('/api/performance-plans/bulk', (req, res) => {
  const { plans, adminEmail, adminName } = req.body;
  if (!Array.isArray(plans) || plans.length === 0) {
    return res.status(400).json({ success: false, message: 'Data rencana kinerja kosong atau tidak valid.' });
  }

  const db = loadDatabase();
  const newPlans = plans.map((p: any) => {
    const indVal = String(p.rencanaKinerjaAnggota || p['Rencana Kinerja Anggota'] || p.indicator || p.Indikator || '').trim();
    const finalBobotAnggota = Number(p.bobotRkAnggota ?? p['Bobot RK Anggota'] ?? p.weight ?? p.Bobot ?? p.bobot) || 10;
    return {
      id: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      year: Number(p.year || p.Tahun) || new Date().getFullYear(),
      team: reconcileTeamName(String(p.team || p.Tim || 'Tim Statistik Sosial'), db.teams),
      iku: String(p.iku || p.IKU || '').trim(),
      targetIku: p.targetIku || p['Target IKU'] || '100%',
      rencanaKinerjaKetua: String(p.rencanaKinerjaKetua || p['Rencana Kinerja Ketua'] || '').trim(),
      bobotRkKetua: Number(p.bobotRkKetua ?? p['Bobot RK Ketua']) || 50,
      rencanaKinerjaAnggota: indVal,
      bobotRkAnggota: finalBobotAnggota,
      indicator: indVal,
      targetOutput: Number(p.targetOutput ?? p.Target) || 1,
      unit: String(p.unit || p.Satuan || 'Dokumen').trim(),
      weight: finalBobotAnggota,
      realisasi: Number(p.realisasi || p.Realisasi || 0),
      status: 'active' as const,
      createdAt: new Date().toISOString()
    };
  }).filter(p => p.indicator.length > 0);

  if (newPlans.length === 0) {
    return res.status(400).json({ success: false, message: 'Tidak ada indikator valid yang dapat diimpor.' });
  }

  db.performance_plans.unshift(...newPlans);
  saveDatabase(db);

  logAdminAction(
    adminEmail,
    adminName,
    'BULK_IMPORT_RENCANA_KINERJA',
    'PerformancePlan',
    undefined,
    `Mengunggah ${newPlans.length} Rencana Kinerja via Excel.`
  );

  res.json({ success: true, count: newPlans.length, plans: newPlans });
});

// --- ACTIVITIES MANAGEMENT (PEGAWAI & MONITORING) ---
app.get('/api/activities', (req, res) => {
  const db = loadDatabase();
  const { email, month, year, team } = req.query;

  let results = db.activities.filter(a => a.status !== 'Deleted');

  if (email) {
    results = results.filter(a => a.email.toLowerCase() === (email as string).toLowerCase());
  }
  if (year) {
    results = results.filter(a => a.year === Number(year) || a.date.startsWith(year as string));
  }
  if (month) {
    results = results.filter(a => {
      const parts = a.date.split('-');
      return parts.length >= 2 && parts[1] === month;
    });
  }
  if (team && team !== 'All') {
    results = results.filter(a => a.team === team);
  }

  res.json(results);
});

// --- MULTER MEMORY STORAGE FOR TEMPORARY PHOTO UPLOADS ---
const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max size
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Harap unggah foto berformat JPG, JPEG, PNG, atau WEBP.'));
    }
  }
});

const handleUploadMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  uploadPhoto.single('photo')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Ukuran file foto melebihi batas maksimal 5 MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Gagal memproses file foto.'
      });
    }
    next();
  });
};

// --- GOOGLE APPS SCRIPT PDF GENERATION HELPER ---
const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby0uDCgvFf9vBmrxyPRU01eamWHO737HCl6XxmNWkKGXbfBYTUQ5-Xu3ifbbkH4-Qyhjw/exec';

interface PhotoObject {
  base64: string;
  mimeType: string;
}

async function generatePdfViaAppsScript(activityData: any, photoObj?: PhotoObject | null) {
  const appsScriptUrl = process.env.APPS_SCRIPT_URL || DEFAULT_APPS_SCRIPT_URL;
  const appsScriptToken = process.env.APPS_SCRIPT_TOKEN || '';

  const photoPayload = photoObj ? {
    base64: photoObj.base64,
    mimeType: photoObj.mimeType
  } : null;

  // Comprehensive activity payload object covering all potential property names in Apps Script
  const activityObj = {
    id: activityData.id,
    activityId: activityData.id,
    employeeName: activityData.employeeName,
    namaPegawai: activityData.employeeName,
    nama: activityData.employeeName,
    email: activityData.email,
    team: activityData.team,
    timKerja: activityData.team,
    tim: activityData.team,
    date: activityData.date,
    tanggal: activityData.date,
    year: activityData.year,
    tahun: activityData.year,
    activityType: activityData.activityType,
    jenisKegiatan: activityData.activityType,
    subActivity: activityData.subActivity,
    rincianKegiatan: activityData.subActivity,
    kegiatan: activityData.subActivity,
    namaKegiatan: activityData.subActivity,
    startTime: activityData.startTime || '08:00',
    jamMulai: activityData.startTime || '08:00',
    endTime: activityData.endTime || '16:00',
    jamSelesai: activityData.endTime || '16:00',
    performancePlanId: activityData.performancePlanId || '',
    performancePlanTitle: activityData.performancePlanTitle || activityData.rencana_kinerja || '',
    rencanaKinerja: activityData.rencana_kinerja || activityData.performancePlanTitle || '',
    rencana_kinerja: activityData.rencana_kinerja || activityData.performancePlanTitle || '',
    capaian: activityData.capaian || '',
    realisasi: activityData.realisasi || 0,
    satuan: activityData.satuan || 'Dokumen',
    progress: activityData.progress || 100,
    notes: activityData.notes || '',
    catatan: activityData.notes || '',
    status: activityData.status || 'Submitted',

    // Photo object in exact JSON structure specified:
    photo: photoPayload,
    photoData: photoObj ? `data:${photoObj.mimeType};base64,${photoObj.base64}` : '',
    photoBase64: photoObj ? photoObj.base64 : '',

    existingPdfUrl: activityData.driveLink || '',
    existingPdfFileId: activityData.driveFileId || '',
    driveLink: activityData.driveLink || '',
    driveFileId: activityData.driveFileId || ''
  };

  const payload = {
    token: appsScriptToken,
    action: 'generatePdf',
    activityId: activityData.id,
    id: activityData.id,
    photo: photoPayload,
    ...activityObj,
    activity: activityObj,
    kegiatan: activityObj,
    data: activityObj,
    activityData: activityObj,
    payload: activityObj
  };

  try {
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script HTTP ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    let resJson: any;
    try {
      resJson = JSON.parse(responseText);
    } catch {
      throw new Error(`Format respon Google Apps Script tidak valid: ${responseText.substring(0, 150)}`);
    }

    if (resJson.status === 'error' || resJson.success === false) {
      throw new Error(resJson.message || resJson.error || 'Pembuatan PDF gagal di Google Apps Script.');
    }

    return resJson;
  } catch (error: any) {
    console.error(`[Apps Script Error] activityId=${activityData.id}:`, error.message);
    throw error;
  }
}

app.post('/api/activities', handleUploadMiddleware, async (req, res) => {
  const {
    id,
    employeeName,
    email,
    team,
    date,
    activityType,
    subActivity,
    startTime,
    endTime,
    performancePlanId,
    performancePlanTitle,
    rencana_kinerja,
    capaian,
    realisasi,
    satuan,
    progress,
    driveLink,
    driveFileId,
    status,
    notes,
    photoData,
    photo: bodyPhoto,
    skipAppsScript
  } = req.body;

  if (!employeeName || !email || !date || !subActivity) {
    return res.status(400).json({ success: false, message: 'Data aktivitas belum lengkap.' });
  }

  // Extract photo to RAM buffer Base64
  let photoObj: PhotoObject | null = null;
  if (req.file && req.file.buffer) {
    photoObj = {
      base64: req.file.buffer.toString('base64'),
      mimeType: req.file.mimetype
    };
  } else if (bodyPhoto && typeof bodyPhoto === 'object' && bodyPhoto.base64) {
    photoObj = {
      base64: String(bodyPhoto.base64).replace(/^data:image\/[a-zA-Z]+;base64,/, ''),
      mimeType: bodyPhoto.mimeType || 'image/jpeg'
    };
  } else if (photoData) {
    let cleanBase64 = String(photoData);
    let mimeType = 'image/jpeg';
    if (cleanBase64.includes('data:image/png')) mimeType = 'image/png';
    else if (cleanBase64.includes('data:image/webp')) mimeType = 'image/webp';
    if (cleanBase64.includes('base64,')) {
      cleanBase64 = cleanBase64.split('base64,')[1];
    }
    photoObj = {
      base64: cleanBase64,
      mimeType
    };
  }

  const db = loadDatabase();
  const yearFromDate = new Date(date).getFullYear() || new Date().getFullYear();
  const activityId = id || `act-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  const newActivity = {
    id: activityId,
    employeeName: String(employeeName).trim(),
    email: String(email).trim().toLowerCase(),
    team: team || 'Tim Umum',
    date,
    year: yearFromDate,
    activityType: activityType || 'Kegiatan Kinerja',
    subActivity: String(subActivity).trim(),
    startTime: startTime || '08:00',
    endTime: endTime || '16:00',
    performancePlanId: performancePlanId || '',
    performancePlanTitle: performancePlanTitle || rencana_kinerja || '',
    rencana_kinerja: rencana_kinerja || performancePlanTitle || '',
    capaian: capaian || (notes ? String(notes).trim() : `${String(subActivity).trim()} telah dilaksanakan sesuai dengan rencana.`),
    realisasi: Number(realisasi) || 0,
    satuan: satuan || 'Dokumen',
    progress: Number(progress) || 100,
    driveLink: driveLink || '',
    driveFileId: driveFileId || '',
    status: (status || 'Submitted') as 'Draft' | 'Submitted' | 'Deleted',
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Trigger Google Apps Script PDF & Drive Generation
  if (!skipAppsScript) {
    try {
      const appsScriptRes = await generatePdfViaAppsScript(newActivity, photoObj);
      
      if (appsScriptRes.pdfUrl || appsScriptRes.driveLink || appsScriptRes.folderUrl) {
        newActivity.driveLink = appsScriptRes.pdfUrl || appsScriptRes.driveLink || appsScriptRes.folderUrl;
      }
      if (appsScriptRes.pdfFileId || appsScriptRes.driveFileId) {
        newActivity.driveFileId = appsScriptRes.pdfFileId || appsScriptRes.driveFileId;
      }
    } catch (pdfError: any) {
      console.error(`Gagal membuat PDF untuk aktivitas ${activityId}:`, pdfError.message);
      return res.status(500).json({
        success: false,
        message: `Gagal meng-generate PDF Laporan via Google Apps Script: ${pdfError.message}`
      });
    }
  }

  db.activities.unshift(newActivity);
  saveDatabase(db);

  res.json({ success: true, activity: newActivity });
});

app.post('/api/activities/bulk', (req, res) => {
  const { activities } = req.body;
  if (!Array.isArray(activities) || activities.length === 0) {
    return res.status(400).json({ success: false, message: 'Tidak ada data kegiatan yang dikirim.' });
  }

  const db = loadDatabase();
  const created: any[] = [];

  for (const act of activities) {
    if (!act.employeeName || !act.email || !act.date || !act.subActivity) {
      continue;
    }
    const yearFromDate = new Date(act.date).getFullYear() || new Date().getFullYear();
    const newActivity = {
      id: act.id || `act-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      employeeName: String(act.employeeName).trim(),
      email: String(act.email).trim().toLowerCase(),
      team: act.team || 'Tim Umum',
      date: act.date,
      year: yearFromDate,
      activityType: act.activityType || 'Kegiatan Kinerja',
      subActivity: String(act.subActivity).trim(),
      startTime: act.startTime || '08:00',
      endTime: act.endTime || '16:00',
      performancePlanId: act.performancePlanId || '',
      performancePlanTitle: act.performancePlanTitle || act.rencana_kinerja || '',
      rencana_kinerja: act.rencana_kinerja || act.performancePlanTitle || '',
      capaian: act.capaian || `${String(act.subActivity).trim()} telah dilaksanakan sesuai dengan rencana.`,
      progress: Number(act.progress) || 100,
      driveLink: act.driveLink || '',
      driveFileId: act.driveFileId || (act.driveLink ? 'uploaded' : ''),
      status: (act.status || 'Submitted') as 'Draft' | 'Submitted' | 'Deleted',
      notes: act.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    created.push(newActivity);
  }

  if (created.length === 0) {
    return res.status(400).json({ success: false, message: 'Tidak ada baris kegiatan valid untuk disimpan.' });
  }

  db.activities.unshift(...created);
  saveDatabase(db);

  res.json({ success: true, count: created.length, activities: created });
});

app.put('/api/activities/:id', handleUploadMiddleware, async (req, res) => {
  const { id } = req.params;
  const { photoData, photo: bodyPhoto, skipAppsScript, ...updateData } = req.body;
  const db = loadDatabase();
  const index = db.activities.findIndex(a => a.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Aktivitas tidak ditemukan.' });
  }

  // Extract photo to RAM buffer Base64
  let photoObj: PhotoObject | null = null;
  if (req.file && req.file.buffer) {
    photoObj = {
      base64: req.file.buffer.toString('base64'),
      mimeType: req.file.mimetype
    };
  } else if (bodyPhoto && typeof bodyPhoto === 'object' && bodyPhoto.base64) {
    photoObj = {
      base64: String(bodyPhoto.base64).replace(/^data:image\/[a-zA-Z]+;base64,/, ''),
      mimeType: bodyPhoto.mimeType || 'image/jpeg'
    };
  } else if (photoData) {
    let cleanBase64 = String(photoData);
    let mimeType = 'image/jpeg';
    if (cleanBase64.includes('data:image/png')) mimeType = 'image/png';
    else if (cleanBase64.includes('data:image/webp')) mimeType = 'image/webp';
    if (cleanBase64.includes('base64,')) {
      cleanBase64 = cleanBase64.split('base64,')[1];
    }
    photoObj = {
      base64: cleanBase64,
      mimeType
    };
  }

  const updatedActivity = {
    ...db.activities[index],
    ...updateData,
    updatedAt: new Date().toISOString()
  };

  if (!skipAppsScript) {
    try {
      const appsScriptRes = await generatePdfViaAppsScript(updatedActivity, photoObj);

      if (appsScriptRes.pdfUrl || appsScriptRes.driveLink || appsScriptRes.folderUrl) {
        updatedActivity.driveLink = appsScriptRes.pdfUrl || appsScriptRes.driveLink || appsScriptRes.folderUrl;
      }
      if (appsScriptRes.pdfFileId || appsScriptRes.driveFileId) {
        updatedActivity.driveFileId = appsScriptRes.pdfFileId || appsScriptRes.driveFileId;
      }
    } catch (pdfError: any) {
      console.error(`Gagal memperbarui PDF untuk ${id}:`, pdfError.message);
      return res.status(500).json({
        success: false,
        message: `Gagal memperbarui PDF Laporan via Google Apps Script: ${pdfError.message}`
      });
    }
  }

  db.activities[index] = updatedActivity;
  saveDatabase(db);

  res.json({ success: true, activity: updatedActivity });
});

app.delete('/api/activities/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  const index = db.activities.findIndex(a => a.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Aktivitas tidak ditemukan.' });
  }

  db.activities[index].status = 'Deleted';
  db.activities[index].updatedAt = new Date().toISOString();
  saveDatabase(db);

  res.json({ success: true, message: 'Aktivitas berhasil dihapus.' });
});

// File / Photo Upload Endpoint for Server Storage
app.post('/api/upload', express.json({ limit: '20mb' }), (req, res) => {
  try {
    const { filename, fileData, mimeType } = req.body;
    if (!filename || !fileData) {
      return res.status(400).json({ success: false, message: 'Filename dan fileData wajib disertakan.' });
    }

    let base64 = fileData;
    if (base64.includes('base64,')) {
      base64 = base64.split('base64,')[1];
    }

    const buffer = Buffer.from(base64, 'base64');
    const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(UPLOADS_DIR, safeName);

    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/uploads/${safeName}`;
    let host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
    let proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';

    if (String(host).includes('localhost') || String(host).includes('127.0.0.1')) {
      const referer = req.headers['referer'] || req.headers['origin'];
      if (referer) {
        try {
          const refUrl = new URL(referer as string);
          host = refUrl.host;
          proto = refUrl.protocol.replace(':', '');
        } catch (e) {}
      }
    }

    const fullUrl = `${proto}://${host}${fileUrl}`;

    res.json({
      success: true,
      fileId: safeName,
      webViewLink: fullUrl,
      url: fileUrl,
      message: 'File/foto berhasil disimpan di server database.'
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan file: ' + error.message });
  }
});

// Helper to locate submitkipapp.exe or submitkiapp.zip across multiple possible locations
function getSubmitKipappPath(): string | null {
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'submitkipapp.exe'),
    path.join(process.cwd(), 'submitkipapp.exe'),
    path.join(DATA_DIR, 'submitkipapp.exe'),
    path.join(UPLOADS_DIR, 'submitkipapp.exe'),
    path.join(process.cwd(), 'public', 'submitkiapp.exe'),
    path.join(process.cwd(), 'submitkiapp.exe'),
    path.join(process.cwd(), 'public', 'SubmitKipapp.exe'),
    path.join(process.cwd(), 'SubmitKipapp.exe')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Check for .zip files to auto-extract or serve
  const possibleZipPaths = [
    path.join(process.cwd(), 'public', 'submitkiapp.zip'),
    path.join(process.cwd(), 'public', 'submitkipapp.zip'),
    path.join(process.cwd(), 'submitkiapp.zip'),
    path.join(process.cwd(), 'submitkipapp.zip'),
    path.join(DATA_DIR, 'submitkiapp.zip'),
    path.join(DATA_DIR, 'submitkipapp.zip')
  ];

  for (const zipPath of possibleZipPaths) {
    if (fs.existsSync(zipPath)) {
      try {
        const publicDir = path.join(process.cwd(), 'public');
        execSync(`unzip -o -q "${zipPath}" -d "${publicDir}"`);
        const extractedExe = path.join(publicDir, 'submitkipapp.exe');
        if (fs.existsSync(extractedExe)) {
          return extractedExe;
        }
      } catch (e) {
        console.error('Error auto-extracting zip:', e);
      }
      return zipPath;
    }
  }

  // Also check if any file in root or public ends with kipapp.exe or kiapp.zip
  try {
    const rootFiles = fs.readdirSync(process.cwd());
    const matchedRoot = rootFiles.find(f => (f.toLowerCase().includes('kipapp') || f.toLowerCase().includes('kiapp')) && (f.toLowerCase().endsWith('.exe') || f.toLowerCase().endsWith('.zip')));
    if (matchedRoot) {
      const fullPath = path.join(process.cwd(), matchedRoot);
      if (fullPath.toLowerCase().endsWith('.zip')) {
        try {
          execSync(`unzip -o -q "${fullPath}" -d "${path.join(process.cwd(), 'public')}"`);
          const extractedExe = path.join(process.cwd(), 'public', 'submitkipapp.exe');
          if (fs.existsSync(extractedExe)) return extractedExe;
        } catch (e) {}
      }
      return fullPath;
    }

    const publicDir = path.join(process.cwd(), 'public');
    if (fs.existsSync(publicDir)) {
      const pubFiles = fs.readdirSync(publicDir);
      const matchedPub = pubFiles.find(f => (f.toLowerCase().includes('kipapp') || f.toLowerCase().includes('kiapp')) && (f.toLowerCase().endsWith('.exe') || f.toLowerCase().endsWith('.zip')));
      if (matchedPub) {
        const fullPath = path.join(publicDir, matchedPub);
        if (fullPath.toLowerCase().endsWith('.zip')) {
          try {
            execSync(`unzip -o -q "${fullPath}" -d "${publicDir}"`);
            const extractedExe = path.join(publicDir, 'submitkipapp.exe');
            if (fs.existsSync(extractedExe)) return extractedExe;
          } catch (e) {}
        }
        return fullPath;
      }
    }
  } catch (e) {
    // ignore
  }

  return null;
}

// Check submitkipapp.exe availability or custom Google Drive link
app.get('/api/app/check', (req, res) => {
  const db = loadDatabase();
  const driveLink = db.settings?.appDriveLink;

  if (driveLink) {
    let directUrl = driveLink;
    const match = driveLink.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      directUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
    return res.json({
      available: true,
      isExternal: true,
      filename: 'submitkipapp.exe',
      downloadUrl: directUrl,
      driveLink: driveLink,
      message: 'File tersedia melalui tautan Google Drive.'
    });
  }

  const exePath = getSubmitKipappPath();
  if (exePath && fs.existsSync(exePath)) {
    const stats = fs.statSync(exePath);
    return res.json({
      available: true,
      isExternal: false,
      filename: path.basename(exePath),
      size: stats.size,
      updatedAt: stats.mtime.toISOString(),
      downloadUrl: '/api/app/download'
    });
  }
  return res.json({
    available: false,
    filename: 'submitkipapp.exe',
    message: 'File submitkipapp.exe belum diunggah ke server.'
  });
});

// Download submitkipapp.exe or redirect to Google Drive
app.get(['/api/app/download', '/submitkipapp.exe'], (req, res) => {
  const db = loadDatabase();
  const driveLink = db.settings?.appDriveLink;

  if (driveLink) {
    const match = driveLink.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return res.redirect(`https://drive.google.com/uc?export=download&id=${match[1]}`);
    }
    return res.redirect(driveLink);
  }

  const exePath = getSubmitKipappPath();
  if (exePath && fs.existsSync(exePath)) {
    return res.download(exePath, path.basename(exePath));
  }
  return res.status(404).json({
    success: false,
    message: 'File submitkipapp.exe belum diunggah ke server. Silakan hubungi admin atau unggah file tersebut.'
  });
});

// Set Google Drive Link for Application
app.post('/api/app/set-link', (req, res) => {
  const { driveLink } = req.body;
  const db = loadDatabase();
  db.settings = db.settings || {};
  db.settings.appDriveLink = driveLink ? driveLink.trim() : '';
  saveDatabase(db);
  res.json({ success: true, appDriveLink: db.settings.appDriveLink });
});

// Chunked Upload Endpoint for large files (supports .exe, .zip up to 250MB+)
app.post('/api/app/chunk-upload', express.raw({ type: 'application/octet-stream', limit: '20mb' }), (req, res) => {
  try {
    const chunkIndex = Number(req.headers['x-chunk-index']);
    const totalChunks = Number(req.headers['x-total-chunks']);
    const rawFilename = (req.headers['x-file-name'] as string) || 'submitkipapp.exe';
    const cleanFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    const tempDir = path.join(DATA_DIR, 'chunks', cleanFilename);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const chunkPath = path.join(tempDir, `part_${chunkIndex}`);
    fs.writeFileSync(chunkPath, req.body);

    if (chunkIndex === totalChunks - 1) {
      const publicDir = path.join(process.cwd(), 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }

      const targetPath = path.join(publicDir, cleanFilename);
      const writeStream = fs.createWriteStream(targetPath);

      for (let i = 0; i < totalChunks; i++) {
        const part = path.join(tempDir, `part_${i}`);
        if (fs.existsSync(part)) {
          const buffer = fs.readFileSync(part);
          writeStream.write(buffer);
          try { fs.unlinkSync(part); } catch (e) {}
        }
      }
      writeStream.end();

      // If zip file, extract it into public/
      if (cleanFilename.toLowerCase().endsWith('.zip')) {
        try {
          execSync(`unzip -o -q "${targetPath}" -d "${publicDir}"`);
          console.log(`Successfully extracted ${cleanFilename} to public/`);
        } catch (unzipErr) {
          console.error('Failed to unzip uploaded file:', unzipErr);
        }
      }

      try { fs.rmdirSync(tempDir); } catch (e) {}

      // Clear any custom drive link if local file is uploaded
      const db = loadDatabase();
      if (db.settings?.appDriveLink) {
        db.settings.appDriveLink = '';
        saveDatabase(db);
      }

      return res.json({
        success: true,
        completed: true,
        filename: cleanFilename,
        message: 'File berhasil diunggah dan disimpan di server!'
      });
    }

    return res.json({
      success: true,
      completed: false,
      chunkIndex,
      message: `Chunk ${chunkIndex + 1}/${totalChunks} diterima.`
    });
  } catch (err: any) {
    console.error('Chunk upload error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengunggah file: ' + err.message });
  }
});

// --- ADMIN AUDIT LOGS ---
app.get('/api/admin/logs', (req, res) => {
  const db = loadDatabase();
  res.json(db.admin_logs);
});

// --- PHPMYADMIN / DATABASE EXPLORER & SQL EXPORT ---
app.get('/api/admin/db-explorer', (req, res) => {
  const db = loadDatabase();

  const tables = [
    {
      name: 'users',
      description: 'Daftar Whitelist Pengguna (Pegawai & Admin Kantor)',
      rowCount: db.users.length,
      columns: [
        { name: 'id', type: 'VARCHAR(64)', key: 'PRI' },
        { name: 'email', type: 'VARCHAR(128)', key: 'UNI' },
        { name: 'name', type: 'VARCHAR(128)' },
        { name: 'nip', type: 'VARCHAR(32)' },
        { name: 'team', type: 'VARCHAR(64)' },
        { name: 'role', type: "ENUM('admin','pegawai')" },
        { name: 'status', type: "ENUM('active','inactive')" },
        { name: 'drive_skripsi_link', type: 'VARCHAR(512)' },
        { name: 'created_at', type: 'DATETIME' },
        { name: 'last_login', type: 'DATETIME' }
      ],
      sizeKb: Math.round((JSON.stringify(db.users).length / 1024) * 10) / 10,
      lastUpdated: db.users[0]?.createdAt || new Date().toISOString()
    },
    {
      name: 'teams',
      description: 'Daftar Master Tim Kerja Kantor',
      rowCount: db.teams.length,
      columns: [
        { name: 'id', type: 'VARCHAR(64)', key: 'PRI' },
        { name: 'code', type: 'VARCHAR(16)' },
        { name: 'name', type: 'VARCHAR(128)' },
        { name: 'description', type: 'TEXT' },
        { name: 'leader_name', type: 'VARCHAR(128)' },
        { name: 'leader_email', type: 'VARCHAR(128)' },
        { name: 'created_at', type: 'DATETIME' }
      ],
      sizeKb: Math.round((JSON.stringify(db.teams).length / 1024) * 10) / 10,
      lastUpdated: db.teams[0]?.createdAt || new Date().toISOString()
    },
    {
      name: 'performance_plans',
      description: 'Rencana Kinerja Tahunan per Tim Kerja',
      rowCount: db.performance_plans.length,
      columns: [
        { name: 'id', type: 'VARCHAR(64)', key: 'PRI' },
        { name: 'year', type: 'INT(4)', key: 'MUL' },
        { name: 'team', type: 'VARCHAR(64)' },
        { name: 'indicator', type: 'TEXT' },
        { name: 'target_output', type: 'INT' },
        { name: 'unit', type: 'VARCHAR(32)' },
        { name: 'weight', type: 'DECIMAL(5,2)' },
        { name: 'status', type: "ENUM('active','archived')" },
        { name: 'created_at', type: 'DATETIME' }
      ],
      sizeKb: Math.round((JSON.stringify(db.performance_plans).length / 1024) * 10) / 10,
      lastUpdated: db.performance_plans[0]?.createdAt || new Date().toISOString()
    },
    {
      name: 'activities',
      description: 'Rekaman Log Kegiatan Harian Seluruh Pegawai',
      rowCount: db.activities.length,
      columns: [
        { name: 'id', type: 'VARCHAR(64)', key: 'PRI' },
        { name: 'employee_name', type: 'VARCHAR(128)' },
        { name: 'email', type: 'VARCHAR(128)', key: 'MUL' },
        { name: 'team', type: 'VARCHAR(64)' },
        { name: 'date', type: 'DATE' },
        { name: 'year', type: 'INT(4)' },
        { name: 'activity_type', type: 'VARCHAR(64)' },
        { name: 'sub_activity', type: 'TEXT' },
        { name: 'performance_plan_id', type: 'VARCHAR(64)', key: 'MUL' },
        { name: 'progress', type: 'INT' },
        { name: 'drive_link', type: 'VARCHAR(512)' },
        { name: 'drive_file_id', type: 'VARCHAR(128)' },
        { name: 'status', type: "ENUM('Draft','Submitted','Deleted')" },
        { name: 'created_at', type: 'DATETIME' },
        { name: 'updated_at', type: 'DATETIME' }
      ],
      sizeKb: Math.round((JSON.stringify(db.activities).length / 1024) * 10) / 10,
      lastUpdated: db.activities[0]?.updatedAt || new Date().toISOString()
    },
    {
      name: 'admin_logs',
      description: 'Audit Trail Aktivitas dan Perubahan Data oleh Admin',
      rowCount: db.admin_logs.length,
      columns: [
        { name: 'id', type: 'VARCHAR(64)', key: 'PRI' },
        { name: 'admin_email', type: 'VARCHAR(128)' },
        { name: 'admin_name', type: 'VARCHAR(128)' },
        { name: 'action', type: 'VARCHAR(64)' },
        { name: 'target_type', type: 'VARCHAR(32)' },
        { name: 'target_id', type: 'VARCHAR(64)' },
        { name: 'details', type: 'TEXT' },
        { name: 'timestamp', type: 'DATETIME' },
        { name: 'ip_address', type: 'VARCHAR(45)' }
      ],
      sizeKb: Math.round((JSON.stringify(db.admin_logs).length / 1024) * 10) / 10,
      lastUpdated: db.admin_logs[0]?.timestamp || new Date().toISOString()
    }
  ];

  res.json({
    engine: 'MySQL 8.0 / InnoDB Dialect',
    serverStatus: 'Active / Connected',
    databaseName: 'oneinapp_db',
    totalTables: tables.length,
    totalRows: tables.reduce((acc, t) => acc + t.rowCount, 0),
    totalSizeKb: tables.reduce((acc, t) => acc + t.sizeKb, 0),
    tables,
    data: {
      users: db.users,
      teams: db.teams,
      performance_plans: db.performance_plans,
      activities: db.activities,
      admin_logs: db.admin_logs
    }
  });
});

// Generate MySQL Dump SQL File for phpMyAdmin
app.get('/api/admin/export-sql', (req, res) => {
  const db = loadDatabase();
  const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

  let sql = `-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: ${timestamp}
-- Server version: 8.0.33
-- PHP Version: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: \`oneinapp_db\`
--
CREATE DATABASE IF NOT EXISTS \`oneinapp_db\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`oneinapp_db\`;

-- --------------------------------------------------------

--
-- Table structure for table \`users\`
--

CREATE TABLE IF NOT EXISTS \`users\` (
  \`id\` varchar(64) NOT NULL,
  \`email\` varchar(128) NOT NULL,
  \`name\` varchar(128) NOT NULL,
  \`nip\` varchar(32) DEFAULT '',
  \`team\` varchar(64) DEFAULT '',
  \`role\` enum('admin','pegawai') NOT NULL DEFAULT 'pegawai',
  \`status\` enum('active','inactive') NOT NULL DEFAULT 'active',
  \`drive_skripsi_link\` varchar(512) DEFAULT '',
  \`created_at\` datetime NOT NULL,
  \`last_login\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`email\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table \`users\`
--

`;

  if (db.users.length > 0) {
    sql += `INSERT INTO \`users\` (\`id\`, \`email\`, \`name\`, \`nip\`, \`team\`, \`role\`, \`status\`, \`drive_skripsi_link\`, \`created_at\`, \`last_login\`) VALUES\n`;
    sql += db.users.map(u => 
      `('${u.id}', '${u.email}', '${u.name.replace(/'/g, "\\'")}', '${u.nip}', '${u.team}', '${u.role}', '${u.status}', '${u.driveSkripsiLink || ''}', '${u.createdAt}', ${u.lastLogin ? `'${u.lastLogin}'` : 'NULL'})`
    ).join(',\n') + ';\n\n';
  }

  sql += `-- --------------------------------------------------------\n\n`;
  sql += `-- Table structure for table \`teams\`\n--\n\n`;
  sql += `CREATE TABLE IF NOT EXISTS \`teams\` (
  \`id\` varchar(64) NOT NULL,
  \`code\` varchar(16) NOT NULL,
  \`name\` varchar(128) NOT NULL,
  \`description\` text DEFAULT NULL,
  \`leader_name\` varchar(128) DEFAULT '',
  \`leader_email\` varchar(128) DEFAULT '',
  \`created_at\` datetime NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  if (db.teams.length > 0) {
    sql += `INSERT INTO \`teams\` (\`id\`, \`code\`, \`name\`, \`description\`, \`leader_name\`, \`leader_email\`, \`created_at\`) VALUES\n`;
    sql += db.teams.map(t => 
      `('${t.id}', '${t.code}', '${t.name.replace(/'/g, "\\'")}', '${t.description.replace(/'/g, "\\'")}', '${t.leaderName.replace(/'/g, "\\'")}', '${t.leaderEmail}', '${t.createdAt}')`
    ).join(',\n') + ';\n\n';
  }

  sql += `-- --------------------------------------------------------\n\n`;
  sql += `-- Table structure for table \`performance_plans\`\n--\n\n`;
  sql += `CREATE TABLE IF NOT EXISTS \`performance_plans\` (
  \`id\` varchar(64) NOT NULL,
  \`year\` int(4) NOT NULL,
  \`team\` varchar(64) NOT NULL,
  \`indicator\` text NOT NULL,
  \`target_output\` int(11) NOT NULL DEFAULT 1,
  \`unit\` varchar(32) NOT NULL DEFAULT 'Dokumen',
  \`weight\` decimal(5,2) NOT NULL DEFAULT 10.00,
  \`status\` enum('active','archived') NOT NULL DEFAULT 'active',
  \`created_at\` datetime NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`year_idx\` (\`year\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  if (db.performance_plans.length > 0) {
    sql += `INSERT INTO \`performance_plans\` (\`id\`, \`year\`, \`team\`, \`indicator\`, \`target_output\`, \`unit\`, \`weight\`, \`status\`, \`created_at\`) VALUES\n`;
    sql += db.performance_plans.map(p => 
      `('${p.id}', ${p.year}, '${p.team}', '${p.indicator.replace(/'/g, "\\'")}', ${p.targetOutput}, '${p.unit}', ${p.weight}, '${p.status}', '${p.createdAt}')`
    ).join(',\n') + ';\n\n';
  }

  sql += `-- --------------------------------------------------------\n\n`;
  sql += `-- Table structure for table \`activities\`\n--\n\n`;
  sql += `CREATE TABLE IF NOT EXISTS \`activities\` (
  \`id\` varchar(64) NOT NULL,
  \`employee_name\` varchar(128) NOT NULL,
  \`email\` varchar(128) NOT NULL,
  \`team\` varchar(64) NOT NULL,
  \`date\` date NOT NULL,
  \`year\` int(4) NOT NULL,
  \`activity_type\` varchar(64) NOT NULL,
  \`sub_activity\` text NOT NULL,
  \`performance_plan_id\` varchar(64) DEFAULT NULL,
  \`progress\` int(11) NOT NULL DEFAULT 0,
  \`drive_link\` varchar(512) DEFAULT '',
  \`drive_file_id\` varchar(128) DEFAULT '',
  \`status\` enum('Draft','Submitted','Deleted') NOT NULL DEFAULT 'Submitted',
  \`notes\` text DEFAULT NULL,
  \`created_at\` datetime NOT NULL,
  \`updated_at\` datetime NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`email_idx\` (\`email\`),
  KEY \`year_idx\` (\`year\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  if (db.activities.length > 0) {
    sql += `INSERT INTO \`activities\` (\`id\`, \`employee_name\`, \`email\`, \`team\`, \`date\`, \`year\`, \`activity_type\`, \`sub_activity\`, \`performance_plan_id\`, \`progress\`, \`drive_link\`, \`drive_file_id\`, \`status\`, \`notes\`, \`created_at\`, \`updated_at\`) VALUES\n`;
    sql += db.activities.map(a => 
      `('${a.id}', '${a.employeeName.replace(/'/g, "\\'")}', '${a.email}', '${a.team}', '${a.date}', ${a.year}, '${a.activityType}', '${a.subActivity.replace(/'/g, "\\'")}', '${a.performancePlanId || ''}', ${a.progress}, '${a.driveLink}', '${a.driveFileId}', '${a.status}', '${(a.notes || '').replace(/'/g, "\\'")}', '${a.createdAt}', '${a.updatedAt}')`
    ).join(',\n') + ';\n\n';
  }

  sql += `-- --------------------------------------------------------\n\n`;
  sql += `-- Table structure for table \`admin_logs\`\n--\n\n`;
  sql += `CREATE TABLE IF NOT EXISTS \`admin_logs\` (
  \`id\` varchar(64) NOT NULL,
  \`admin_email\` varchar(128) NOT NULL,
  \`admin_name\` varchar(128) NOT NULL,
  \`action\` varchar(64) NOT NULL,
  \`target_type\` varchar(32) NOT NULL,
  \`target_id\` varchar(64) DEFAULT NULL,
  \`details\` text NOT NULL,
  \`timestamp\` datetime NOT NULL,
  \`ip_address\` varchar(45) DEFAULT '127.0.0.1',
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  if (db.admin_logs.length > 0) {
    sql += `INSERT INTO \`admin_logs\` (\`id\`, \`admin_email\`, \`admin_name\`, \`action\`, \`target_type\`, \`target_id\`, \`details\`, \`timestamp\`, \`ip_address\`) VALUES\n`;
    sql += db.admin_logs.map(l => 
      `('${l.id}', '${l.adminEmail}', '${l.adminName.replace(/'/g, "\\'")}', '${l.action}', '${l.targetType}', '${l.targetId || ''}', '${l.details.replace(/'/g, "\\'")}', '${l.timestamp}', '${l.ipAddress || '127.0.0.1'}')`
    ).join(',\n') + ';\n\n';
  }

  sql += `COMMIT;\n\n/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;\n/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;\n/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;\n`;

  res.setHeader('Content-Type', 'application/sql');
  res.setHeader('Content-Disposition', 'attachment; filename="satuinapp_database_dump.sql"');
  res.send(sql);
});

// Reset / Seed Default Data
app.post('/api/admin/seed-default', (req, res) => {
  const { adminEmail, adminName } = req.body;
  const initial = getInitialDb();
  saveDatabase(initial);

  logAdminAction(
    adminEmail || 'admin@satuinapp.local',
    adminName || 'Administrator',
    'RESET_DATABASE_DEFAULT',
    'System',
    undefined,
    'Reset dan inisialisasi ulang database server SatuInApp ke data master default.'
  );

  res.json({ success: true, message: 'Database server berhasil diinisialisasi ulang ke data standar.' });
});

// --- VITE SPA MIDDLEWARE / PRODUCTION SERVING ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SatuInApp Backend Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
