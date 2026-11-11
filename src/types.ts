/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'pegawai';
export type UserStatus = 'active' | 'inactive';

export interface UserAccount {
  id: string;
  username?: string;
  password?: string;
  email: string;
  name: string;
  nip?: string;
  team?: string;
  role: UserRole;
  status: UserStatus;
  driveSkripsiLink?: string;
  employeeSpreadsheetId?: string;
  employeeSpreadsheetUrl?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface Team {
  id: string;
  code: string;
  name: string;
  description: string;
  leaderName: string;
  leaderEmail: string;
  createdAt: string;
}

export interface PerformancePlan {
  id: string;
  year: number; // e.g. 2024, 2025, 2026, 2027
  team: string; // Tim
  iku: string; // IKU
  targetIku: string | number; // Target IKU
  rencanaKinerjaKetua: string; // Rencana Kinerja Ketua
  bobotRkKetua: number; // Bobot RK Ketua
  rencanaKinerjaAnggota: string; // Rencana Kinerja Anggota
  bobotRkAnggota?: number; // Bobot RK Anggota
  indicator: string; // alias to rencanaKinerjaAnggota
  weight: number; // Bobot RK Anggota (%)
  targetOutput: number; // Target Total
  unit: string; // Satuan
  realisasi?: number; // Realisasi
  status: 'active' | 'archived';
  createdAt: string;
}

export interface Activity {
  id: string;
  employeeName: string;
  email: string;
  team: string;
  date: string; // YYYY-MM-DD
  year?: number;
  activityType: string;
  subActivity: string;
  startTime?: string; // e.g. 08:00
  endTime?: string;   // e.g. 16:00
  performancePlanId?: string;
  performancePlanTitle?: string;
  rencana_kinerja?: string;
  capaian?: string;
  realisasi?: number; // Realisasi input
  satuan?: string; // Satuan corresponding to selected plan
  progress: number; // 0 - 100
  driveLink: string;
  driveFileId: string;
  status: 'Draft' | 'Submitted' | 'Deleted';
  notes?: string;
  photoData?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminLog {
  id: string;
  adminEmail: string;
  adminName: string;
  action: string; // e.g., 'TAMBAH_PENGGUNA', 'UBAH_TIM', 'TAMBAH_RENCANA_KINERJA', 'HAPUS_DATA'
  targetType: 'User' | 'Team' | 'PerformancePlan' | 'Activity' | 'System';
  targetId?: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

export interface EmployeeStats {
  employeeName: string;
  email: string;
  team: string;
  activityCount: number;
  uploadCount: number;
  avgProgress: number;
  progressPercentage: number;
  target: number;
  status: 'Hijau' | 'Biru' | 'Kuning' | 'Merah';
  lastUpdate: string;
}

export interface AppSettings {
  spreadsheetId: string;
  masterSpreadsheetId?: string;
  masterSpreadsheetUrl?: string;
  adminEmail: string;
  headOfTeamEmail: string;
  headOfOfficeEmail: string;
  monthlyTarget: number;
}

export interface DatabaseTableInfo {
  name: string;
  description: string;
  rowCount: number;
  columns: { name: string; type: string; key?: string }[];
  sizeKb: number;
  lastUpdated: string;
}

export const DEFAULT_TEAMS: Omit<Team, 'id' | 'createdAt'>[] = [
  { code: 'SOS', name: 'Tim Statistik Sosial', description: 'Survei kependudukan, kemiskinan, ketenagakerjaan, dan kesehatan', leaderName: 'Nurul Hidayah, S.Tr.Stat', leaderEmail: 'nurul.hidayah@bps.go.id' },
  { code: 'PROD', name: 'Tim Statistik Produksi', description: 'Statistik pertanian, perkebunan, peternakan, industri, pertambangan, dan energi', leaderName: 'Budi Santoso, S.Si', leaderEmail: 'budi.santoso@bps.go.id' },
  { code: 'DIST', name: 'Tim Statistik Distribusi', description: 'Statistik harga konsumen, perdagangan besar, pariwisata, dan transportasi', leaderName: 'Masna Novita Rahmaniar', leaderEmail: 'rmasnanovita@gmail.com' },
  { code: 'NER', name: 'Tim Neraca Wilayah & Analisis', description: 'Penyusunan PDRB menurut lapangan usaha dan pengeluaran serta tabel I-O', leaderName: 'Finda Rosita, M.E', leaderEmail: 'finda.rosita@bps.go.id' },
  { code: 'IPDS', name: 'Tim IPDS & TI', description: 'Pengelolaan data, jaringan, website kantor, diseminasi, dan metadata statistik', leaderName: 'Azka Pratama, S.Kom', leaderEmail: 'azka.pratama@bps.go.id' },
  { code: 'UMUM', name: 'Bagian Tata Usaha & Umum', description: 'Kepegawaian, keuangan, perlengkapan, dan kearsipan kantor', leaderName: 'Hendra Gunawan, S.E', leaderEmail: 'hendra.gunawan@bps.go.id' }
];

export const ACTIVITY_TYPES = [
  'Survei / Pencacahan Lapangan',
  'Pengolahan & Validasi Data',
  'Analisis & Diseminasi Statistik',
  'Rapat / Koordinasi Tim',
  'Administrasi / Tata Usaha',
  'Pelatihan / Pembinaan Teknis',
  'Supervisi & Monitoring Kualitas'
];

export const UNITS = [
  'Dokumen',
  'Laporan',
  'Berkas / Berita Acara',
  'Kegiatan / Rapat',
  'Desa / Kelurahan',
  'Sampel / Responden',
  'Publikasi',
  'Tabel Statistik'
];

export const TEAMS = DEFAULT_TEAMS.map(t => t.name);

export const cleanIkuTitle = (rawIku?: string | null): string => {
  if (!rawIku) return '';
  return rawIku.trim().replace(/^IKU\s*\d+\s*[:\-]\s*/i, '').trim();
};
