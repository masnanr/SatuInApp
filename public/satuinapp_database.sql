-- ========================================================
-- SatuInApp Database Dump & Table Structure
-- Compatible with MySQL 5.7+, MySQL 8.0+, MariaDB, phpMyAdmin
-- Generated for: SatuInApp © 2026 • Developed by Masna Novita Rahmaniar
-- ========================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+07:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- --------------------------------------------------------
-- Table structure for table `users`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `users` (
  `id` varchar(64) NOT NULL,
  `username` varchar(64) DEFAULT NULL,
  `email` varchar(128) NOT NULL,
  `name` varchar(128) NOT NULL,
  `nip` varchar(32) DEFAULT '',
  `team` varchar(128) NOT NULL DEFAULT 'Tim Umum',
  `role` enum('admin','pegawai') NOT NULL DEFAULT 'pegawai',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `password` varchar(255) DEFAULT 'pegawai123',
  `drive_skripsi_link` varchar(512) DEFAULT '',
  `created_at` datetime NOT NULL,
  `last_login` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_uniq` (`email`),
  KEY `username_idx` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping default users (Hanya Super Admin Utama)
INSERT INTO `users` (`id`, `username`, `email`, `name`, `nip`, `team`, `role`, `status`, `password`, `drive_skripsi_link`, `created_at`, `last_login`) VALUES
('usr-1', 'masnanovita', 'rmasnanovita@gmail.com', 'Masna Novita Rahmaniar', '199408292018012001', 'Tim Statistik Distribusi', 'admin', 'active', 'admin123', '', NOW(), NOW())
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- --------------------------------------------------------
-- Table structure for table `teams`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `teams` (
  `id` varchar(64) NOT NULL,
  `code` varchar(32) NOT NULL,
  `name` varchar(128) NOT NULL,
  `description` text DEFAULT NULL,
  `leader_name` varchar(128) DEFAULT '',
  `leader_email` varchar(128) DEFAULT '',
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping default teams (Nama dan Email Ketua Tim dikosongkan agar siap diisi baru)
INSERT INTO `teams` (`id`, `code`, `name`, `description`, `leader_name`, `leader_email`, `created_at`) VALUES
('team-1', 'SOS', 'Tim Statistik Sosial', 'Survei kependudukan, kemiskinan, ketenagakerjaan, dan kesehatan', '', '', NOW()),
('team-2', 'PROD', 'Tim Statistik Produksi', 'Statistik pertanian, perkebunan, industri, pertambangan, dan energi', '', '', NOW()),
('team-3', 'DIST', 'Tim Statistik Distribusi', 'Statistik harga konsumen, perdagangan besar, pariwisata, dan transportasi', '', '', NOW()),
('team-4', 'NER', 'Tim Neraca Wilayah & Analisis', 'Penyusunan PDRB menurut lapangan usaha dan pengeluaran serta tabel I-O', '', '', NOW()),
('team-5', 'IPDS', 'Tim IPDS & TI', 'Pengelolaan data, jaringan, website kantor, diseminasi, dan metadata', '', '', NOW()),
('team-6', 'UMUM', 'Bagian Tata Usaha & Umum', 'Kepegawaian, keuangan, perlengkapan, dan kearsipan kantor', '', '', NOW())
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- --------------------------------------------------------
-- Table structure for table `performance_plans`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `performance_plans` (
  `id` varchar(64) NOT NULL,
  `year` int(4) NOT NULL,
  `team` varchar(128) NOT NULL,
  `iku` varchar(255) DEFAULT '',
  `target_iku` varchar(64) DEFAULT '100%',
  `rencana_kinerja_ketua` text DEFAULT NULL,
  `bobot_rk_ketua` decimal(5,2) NOT NULL DEFAULT 50.00,
  `rencana_kinerja_anggota` text NOT NULL,
  `bobot_rk_anggota` decimal(5,2) NOT NULL DEFAULT 10.00,
  `indicator` text NOT NULL,
  `target_output` int(11) NOT NULL DEFAULT 1,
  `unit` varchar(64) NOT NULL DEFAULT 'Dokumen',
  `weight` decimal(5,2) NOT NULL DEFAULT 10.00,
  `realisasi` int(11) NOT NULL DEFAULT 0,
  `status` enum('active','archived') NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `year_idx` (`year`),
  KEY `team_idx` (`team`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel performance_plans dikosongkan (siap input baru)

-- --------------------------------------------------------
-- Table structure for table `activities`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `activities` (
  `id` varchar(64) NOT NULL,
  `employee_name` varchar(128) NOT NULL,
  `email` varchar(128) NOT NULL,
  `team` varchar(128) NOT NULL,
  `date` date NOT NULL,
  `year` int(4) NOT NULL,
  `activity_type` varchar(64) NOT NULL,
  `sub_activity` text NOT NULL,
  `start_time` varchar(16) DEFAULT '08:00',
  `end_time` varchar(16) DEFAULT '16:00',
  `performance_plan_id` varchar(64) DEFAULT NULL,
  `performance_plan_title` text DEFAULT NULL,
  `rencana_kinerja` text DEFAULT NULL,
  `capaian` text DEFAULT NULL,
  `progress` int(11) NOT NULL DEFAULT 100,
  `drive_link` varchar(512) DEFAULT '',
  `drive_file_id` varchar(128) DEFAULT '',
  `status` enum('Draft','Submitted','Deleted') NOT NULL DEFAULT 'Submitted',
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `email_idx` (`email`),
  KEY `year_idx` (`year`),
  KEY `date_idx` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel activities dikosongkan (siap input baru)

-- --------------------------------------------------------
-- Table structure for table `admin_logs`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `admin_logs` (
  `id` varchar(64) NOT NULL,
  `admin_email` varchar(128) NOT NULL,
  `admin_name` varchar(128) NOT NULL,
  `action` varchar(64) NOT NULL,
  `target_type` varchar(32) NOT NULL,
  `target_id` varchar(64) DEFAULT NULL,
  `details` text NOT NULL,
  `timestamp` datetime NOT NULL,
  `ip_address` varchar(45) DEFAULT '127.0.0.1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Log awal inisialisasi
INSERT INTO `admin_logs` (`id`, `admin_email`, `admin_name`, `action`, `target_type`, `target_id`, `details`, `timestamp`, `ip_address`) VALUES
('log-1', 'rmasnanovita@gmail.com', 'Masna Novita Rahmaniar', 'INISIALISASI_SISTEM', 'System', NULL, 'Inisialisasi database server SatuInApp siap pakai.', NOW(), '127.0.0.1')
ON DUPLICATE KEY UPDATE `details`=VALUES(`details`);

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
