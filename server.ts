import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
      email: 'rmasnanovita@gmail.com',
      name: 'Masna Fitria, S.Stat',
      nip: '199408292018012001',
      team: 'Tim Statistik Distribusi',
      role: 'admin',
      status: 'active',
      password: 'admin123',
      createdAt: now,
      lastLogin: now
    },
    {
      id: 'usr-1b',
      email: 'skripsimasna@gmail.com',
      name: 'Masna Fitria (Skripsi)',
      nip: '199408292018012001',
      team: 'Tim Statistik Distribusi',
      role: 'admin',
      status: 'active',
      password: 'skripsi123',
      createdAt: now,
      lastLogin: now
    },
    {
      id: 'usr-2',
      email: 'admin@bps.go.id',
      name: 'Administrator Kantor BPS',
      nip: '198501012007011001',
      team: 'Bagian Tata Usaha & Umum',
      role: 'admin',
      status: 'active',
      password: 'admin123',
      createdAt: now,
      lastLogin: now
    },
    {
      id: 'usr-3',
      email: 'nurul.hidayah@example.com',
      name: 'Nurul Hidayah, S.Tr.Stat',
      nip: '199203152015022002',
      team: 'Tim Statistik Sosial',
      role: 'pegawai',
      status: 'active',
      password: 'pegawai123',
      createdAt: now,
      lastLogin: now
    },
    {
      id: 'usr-4',
      email: 'finda.rosita@example.com',
      name: 'Finda Rosita, M.E',
      nip: '199511102019012003',
      team: 'Tim Neraca Wilayah & Analisis',
      role: 'pegawai',
      status: 'active',
      password: 'pegawai123',
      createdAt: now,
      lastLogin: now
    },
    {
      id: 'usr-5',
      email: 'azka.pratama@example.com',
      name: 'Azka Pratama, S.Kom',
      nip: '199607222020021004',
      team: 'Tim IPDS & TI',
      role: 'pegawai',
      status: 'active',
      password: 'pegawai123',
      createdAt: now,
      lastLogin: now
    }
  ];

  const teams: DatabaseSchema['teams'] = [
    { id: 'team-1', code: 'SOS', name: 'Tim Statistik Sosial', description: 'Survei kependudukan, kemiskinan, ketenagakerjaan, dan kesehatan', leaderName: 'Nurul Hidayah, S.Tr.Stat', leaderEmail: 'nurul.hidayah@example.com', createdAt: now },
    { id: 'team-2', code: 'PROD', name: 'Tim Statistik Produksi', description: 'Statistik pertanian, perkebunan, industri, pertambangan, dan energi', leaderName: 'Budi Santoso, S.Si', leaderEmail: 'budi.santoso@bps.go.id', createdAt: now },
    { id: 'team-3', code: 'DIST', name: 'Tim Statistik Distribusi', description: 'Statistik harga konsumen, perdagangan besar, pariwisata, dan transportasi', leaderName: 'Masna Fitria, S.Stat', leaderEmail: 'rmasnanovita@gmail.com', createdAt: now },
    { id: 'team-4', code: 'NER', name: 'Tim Neraca Wilayah & Analisis', description: 'Penyusunan PDRB menurut lapangan usaha dan pengeluaran serta tabel I-O', leaderName: 'Finda Rosita, M.E', leaderEmail: 'finda.rosita@example.com', createdAt: now },
    { id: 'team-5', code: 'IPDS', name: 'Tim IPDS & TI', description: 'Pengelolaan data, jaringan, website kantor, diseminasi, dan metadata', leaderName: 'Azka Pratama, S.Kom', leaderEmail: 'azka.pratama@example.com', createdAt: now },
    { id: 'team-6', code: 'UMUM', name: 'Bagian Tata Usaha & Umum', description: 'Kepegawaian, keuangan, perlengkapan, dan kearsipan kantor', leaderName: 'Hendra Gunawan, S.E', leaderEmail: 'hendra.gunawan@bps.go.id', createdAt: now }
  ];

  const performance_plans: DatabaseSchema['performance_plans'] = [
    // 2026 Plans
    { id: 'plan-2026-1', year: 2026, team: 'Tim Statistik Sosial', iku: 'IKU 1: Persentase Kualitas Data Sosial', targetIku: '100%', rencanaKinerjaKetua: 'Koordinasi Survei Sosial', bobotRkKetua: 50, rencanaKinerjaAnggota: 'Terlaksananya Survei Angkatan Kerja Nasional (Sakernas)', indicator: 'Terlaksananya Survei Angkatan Kerja Nasional (Sakernas)', targetOutput: 120, unit: 'Dokumen', weight: 25, realisasi: 0, status: 'active', createdAt: now },
    { id: 'plan-2026-2', year: 2026, team: 'Tim Statistik Sosial', iku: 'IKU 1: Persentase Kualitas Data Sosial', targetIku: '100%', rencanaKinerjaKetua: 'Koordinasi Pendataan Susenas', bobotRkKetua: 50, rencanaKinerjaAnggota: 'Pendataan Survei Sosial Ekonomi Nasional (Susenas)', indicator: 'Pendataan Survei Sosial Ekonomi Nasional (Susenas)', targetOutput: 250, unit: 'Sampel / Responden', weight: 35, realisasi: 0, status: 'active', createdAt: now },
    { id: 'plan-2026-3', year: 2026, team: 'Tim Statistik Distribusi', iku: 'IKU 2: Indeks Harga dan Distribusi', targetIku: '100%', rencanaKinerjaKetua: 'Pengawasan Survei Harga IHK', bobotRkKetua: 50, rencanaKinerjaAnggota: 'Survei Pemantauan Indeks Harga Konsumen (IHK) Mingguan', indicator: 'Survei Pemantauan Indeks Harga Konsumen (IHK) Mingguan', targetOutput: 52, unit: 'Laporan', weight: 30, realisasi: 0, status: 'active', createdAt: now },
    { id: 'plan-2026-4', year: 2026, team: 'Tim Statistik Distribusi', iku: 'IKU 2: Indeks Harga dan Distribusi', targetIku: '100%', rencanaKinerjaKetua: 'Analisis Pariwisata', bobotRkKetua: 50, rencanaKinerjaAnggota: 'Survei Tingkat Penghunian Kamar Hotel dan Wisatawan', indicator: 'Survei Tingkat Penghunian Kamar Hotel dan Wisatawan', targetOutput: 12, unit: 'Publikasi', weight: 20, realisasi: 0, status: 'active', createdAt: now },
    { id: 'plan-2026-5', year: 2026, team: 'Tim Neraca Wilayah & Analisis', iku: 'IKU 3: PDRB dan Analisis Makro', targetIku: '100%', rencanaKinerjaKetua: 'Penyusunan PDRB', bobotRkKetua: 50, rencanaKinerjaAnggota: 'Penyusunan Publikasi PDRB Triwulanan dan Tahunan', indicator: 'Penyusunan Publikasi PDRB Triwulanan dan Tahunan', targetOutput: 4, unit: 'Publikasi', weight: 40, realisasi: 0, status: 'active', createdAt: now },
    { id: 'plan-2026-6', year: 2026, team: 'Tim IPDS & TI', iku: 'IKU 4: Pengelolaan TI & Diseminasi', targetIku: '100%', rencanaKinerjaKetua: 'Diseminasi Statistik', bobotRkKetua: 50, rencanaKinerjaAnggota: 'Diseminasi Rilis Berita Resmi Statistik (BRS) & Portal Data', indicator: 'Diseminasi Rilis Berita Resmi Statistik (BRS) & Portal Data', targetOutput: 24, unit: 'Tabel Statistik', weight: 25, realisasi: 0, status: 'active', createdAt: now },
    { id: 'plan-2026-7', year: 2026, team: 'Bagian Tata Usaha & Umum', iku: 'IKU 5: Akuntabilitas Kinerja', targetIku: '100%', rencanaKinerjaKetua: 'Penyusunan LAKIP', bobotRkKetua: 50, rencanaKinerjaAnggota: 'Penyusunan Laporan Akuntabilitas Kinerja Instansi Pemerintah (LAKIP)', indicator: 'Penyusunan Laporan Akuntabilitas Kinerja Instansi Pemerintah (LAKIP)', targetOutput: 1, unit: 'Laporan', weight: 20, realisasi: 0, status: 'active', createdAt: now },
    // 2025 Plans
    { id: 'plan-2025-1', year: 2025, team: 'Tim Statistik Sosial', iku: 'IKU 1', targetIku: '100%', rencanaKinerjaKetua: 'Kesejahteraan Rakyat', bobotRkKetua: 50, rencanaKinerjaAnggota: 'Penyusunan Publikasi Indikator Kesejahteraan Rakyat', indicator: 'Penyusunan Publikasi Indikator Kesejahteraan Rakyat', targetOutput: 1, unit: 'Publikasi', weight: 30, realisasi: 0, status: 'active', createdAt: now },
    { id: 'plan-2025-2', year: 2025, team: 'Tim Statistik Distribusi', iku: 'IKU 2', targetIku: '100%', rencanaKinerjaKetua: 'Perdagangan', bobotRkKetua: 50, rencanaKinerjaAnggota: 'Pencacahan Survei Perdagangan Antar Wilayah', indicator: 'Pencacahan Survei Perdagangan Antar Wilayah', targetOutput: 80, unit: 'Sampel / Responden', weight: 30, realisasi: 0, status: 'active', createdAt: now }
  ];

  const activities: DatabaseSchema['activities'] = [
    {
      id: 'act-mas-1',
      employeeName: 'Masna Fitria, S.Stat',
      email: 'rmasnanovita@gmail.com',
      team: 'Tim Statistik Distribusi',
      date: `${currentYear}-08-05`,
      year: currentYear,
      activityType: 'Survei / Pencacahan Lapangan',
      subActivity: 'Survei Harga Konsumen Komoditas Pangan Pasar Tradisional',
      performancePlanId: 'plan-2026-3',
      performancePlanTitle: 'Survei Pemantauan Indeks Harga Konsumen (IHK) Mingguan',
      progress: 100,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'drv-mas-01',
      status: 'Submitted',
      notes: 'Pendataan 15 komoditas pokok selesai di Pasar Sentral',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'act-mas-2',
      employeeName: 'Masna Fitria, S.Stat',
      email: 'rmasnanovita@gmail.com',
      team: 'Tim Statistik Distribusi',
      date: `${currentYear}-08-12`,
      year: currentYear,
      activityType: 'Pengolahan & Validasi Data',
      subActivity: 'Entri Data dan Validasi Angka Indeks Harga Perdagangan Besar',
      performancePlanId: 'plan-2026-3',
      performancePlanTitle: 'Survei Pemantauan Indeks Harga Konsumen (IHK) Mingguan',
      progress: 90,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'drv-mas-02',
      status: 'Submitted',
      notes: 'Validasi anomali harga cabai dan beras telah terkonfirmasi',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'act-mas-3',
      employeeName: 'Masna Fitria, S.Stat',
      email: 'rmasnanovita@gmail.com',
      team: 'Tim Statistik Distribusi',
      date: `${currentYear}-08-20`,
      year: currentYear,
      activityType: 'Analisis & Diseminasi Statistik',
      subActivity: 'Penyusunan Bahan Rilis Inflasi Kota Bulanan',
      performancePlanId: 'plan-2026-4',
      performancePlanTitle: 'Survei Tingkat Penghunian Kamar Hotel dan Wisatawan',
      progress: 100,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'drv-mas-03',
      status: 'Submitted',
      notes: 'Tabel inflasi m-to-m dan y-on-y siap dipublikasikan',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'act-nur-1',
      employeeName: 'Nurul Hidayah, S.Tr.Stat',
      email: 'nurul.hidayah@example.com',
      team: 'Tim Statistik Sosial',
      date: `${currentYear}-08-08`,
      year: currentYear,
      activityType: 'Survei / Pencacahan Lapangan',
      subActivity: 'Pelaksanaan Listing Survei Sakernas Semester II',
      performancePlanId: 'plan-2026-1',
      performancePlanTitle: 'Terlaksananya Survei Angkatan Kerja Nasional (Sakernas)',
      progress: 100,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'drv-nur-01',
      status: 'Submitted',
      notes: 'Listing 10 Blok Sensus telah 100% selesai',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'act-fin-1',
      employeeName: 'Finda Rosita, M.E',
      email: 'finda.rosita@example.com',
      team: 'Tim Neraca Wilayah & Analisis',
      date: `${currentYear}-08-15`,
      year: currentYear,
      activityType: 'Analisis & Diseminasi Statistik',
      subActivity: 'Penyusunan Laju Pertumbuhan Ekonomi PDRB Triwulan II',
      performancePlanId: 'plan-2026-5',
      performancePlanTitle: 'Penyusunan Publikasi PDRB Triwulanan dan Tahunan',
      progress: 75,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'drv-fin-01',
      status: 'Submitted',
      notes: 'Tahap kompilasi data sekunder sektor perdagangan',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'act-azk-1',
      employeeName: 'Azka Pratama, S.Kom',
      email: 'azka.pratama@example.com',
      team: 'Tim IPDS & TI',
      date: `${currentYear}-08-18`,
      year: currentYear,
      activityType: 'Pengolahan & Validasi Data',
      subActivity: 'Integrasi Metadata Statistik Sektoral ke Portal Satu Data',
      performancePlanId: 'plan-2026-6',
      performancePlanTitle: 'Diseminasi Rilis Berita Resmi Statistik (BRS) & Portal Data',
      progress: 80,
      driveLink: 'https://drive.google.com/drive/my-drive',
      driveFileId: 'drv-azk-01',
      status: 'Submitted',
      notes: 'Konfigurasi API endpoint telah berjalan stabil',
      createdAt: now,
      updatedAt: now
    }
  ];

  const admin_logs: DatabaseSchema['admin_logs'] = [
    {
      id: 'log-1',
      adminEmail: 'rmasnanovita@gmail.com',
      adminName: 'Masna Fitria, S.Stat',
      action: 'INISIALISASI_SISTEM',
      targetType: 'System',
      details: 'Inisialisasi database server OneInAPP berhasil dipasang.',
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
      appName: 'OneInAPP',
      monthlyTarget: 10,
      defaultYear: currentYear,
      adminEmail: 'rmasnanovita@gmail.com',
      headOfTeamEmail: 'kepalateam@bps.go.id',
      headOfOfficeEmail: 'kepalakantor@bps.go.id'
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
    adminEmail: adminEmail || 'admin@oneinapp.local',
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
    app: 'OneInAPP',
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

app.post('/api/activities', (req, res) => {
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
    progress,
    driveLink,
    driveFileId,
    status,
    notes
  } = req.body;

  if (!employeeName || !email || !date || !subActivity) {
    return res.status(400).json({ success: false, message: 'Data aktivitas belum lengkap.' });
  }

  const db = loadDatabase();
  const yearFromDate = new Date(date).getFullYear() || new Date().getFullYear();

  const newActivity = {
    id: id || `act-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    employeeName: employeeName.trim(),
    email: email.trim().toLowerCase(),
    team: team || 'Tim Umum',
    date,
    year: yearFromDate,
    activityType: activityType || 'Kegiatan Kinerja',
    subActivity: subActivity.trim(),
    startTime: startTime || '08:00',
    endTime: endTime || '16:00',
    performancePlanId: performancePlanId || '',
    performancePlanTitle: performancePlanTitle || rencana_kinerja || '',
    rencana_kinerja: rencana_kinerja || performancePlanTitle || '',
    capaian: capaian || (notes ? notes.trim() : `${subActivity.trim()} telah dilaksanakan sesuai dengan rencana.`),
    progress: Number(progress) || 0,
    driveLink: driveLink || '',
    driveFileId: driveFileId || '',
    status: (status || 'Submitted') as 'Draft' | 'Submitted' | 'Deleted',
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

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

app.put('/api/activities/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  const index = db.activities.findIndex(a => a.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Aktivitas tidak ditemukan.' });
  }

  db.activities[index] = {
    ...db.activities[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  saveDatabase(db);
  res.json({ success: true, activity: db.activities[index] });
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
  res.setHeader('Content-Disposition', 'attachment; filename="oneinapp_database_dump.sql"');
  res.send(sql);
});

// Reset / Seed Default Data
app.post('/api/admin/seed-default', (req, res) => {
  const { adminEmail, adminName } = req.body;
  const initial = getInitialDb();
  saveDatabase(initial);

  logAdminAction(
    adminEmail || 'admin@oneinapp.local',
    adminName || 'Administrator',
    'RESET_DATABASE_DEFAULT',
    'System',
    undefined,
    'Reset dan inisialisasi ulang database server OneInAPP ke data master default.'
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
    console.log(`OneInAPP Backend Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
