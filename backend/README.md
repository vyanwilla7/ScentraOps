# ScentraOps Backend

Express API yang menjadi satu-satunya pemilik akses PostgreSQL. Semua data domain saat ini memakai store in-memory yang dapat diinjeksi; PostgreSQL hanya dipakai untuk health check sampai adaptor persistensi diaktifkan.

## Menjalankan

```powershell
Copy-Item .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

`DATABASE_URL` menunjuk ke PostgreSQL lokal. Migrasi mencakup foundation, master data, tiket, transaksi, dan persistence; seed foundation aman dijalankan ulang. Jangan memasukkan kredensial produksi atau `.env` ke repository.

## Dokumentasi API (Swagger)

Saat server berjalan:

- Swagger UI: `http://localhost:3001/api/v1/docs`
- Kontrak OpenAPI: `http://localhost:3001/api/v1/openapi.json`

Kontrak mencakup seluruh endpoint, skema request/response, cookie sesi `scentra_session`, serta metadata `x-required-roles` dan `x-required-permissions`. Halaman dokumentasi bersifat publik untuk demo lokal; endpoint API tetap diperiksa di server.

## Matriks akses (proposal Tabel 7)

| Akses | CS | Staf data | Pemilik |
|---|---|---|---|
| Asisten CS dan tiket keluhan | Kelola | Baca | Baca |
| Katalog, stok, pengetahuan (tanpa HPP) | Baca | Kelola | Baca |
| HPP dan master biaya | Tidak ada | Kelola | Kelola |
| Impor dan perbaikan data transaksi | Tidak ada | Kelola | Baca |
| Laporan laba, dashboard, simulasi | Tidak ada | Baca | Penuh |
| Pengaturan dan audit log | Tidak ada | Kelola pengaturan | Baca semua |

Catatan:

- OWNER dapat membaca katalog/stok/pengetahuan dan mengelola HPP, tetapi tidak mengubah SKU atau pengetahuan.
- DATA mengelola pengaturan, tetapi tidak dapat membaca audit log kecuali username-nya tercantum di `AUDIT_VIEWER_USERS`.
- Izin dikirim bersama payload login/sesi dan diperiksa ulang oleh `requirePermission` pada setiap route.
- Frontend hanya menyembunyikan menu; otorisasi tetap di backend.

## Endpoint utama

| Endpoint | Akses |
|---|---|
| `GET /api/v1/health` | Publik |
| `POST /api/v1/auth/login` | Publik |
| `GET /api/v1/auth/session`, `POST /api/v1/auth/logout` | Sesi aktif |
| `GET /api/v1/catalog` | `catalog:read` (semua peran) |
| `GET/POST /api/v1/master-data/skus`, `PATCH /api/v1/master-data/skus/:id` | Baca: semua; tulis: `catalog:manage` (DATA) |
| `GET/POST /api/v1/master-data/skus/:id/costs` | `costs:read` / `costs:manage` (DATA, OWNER) |
| `GET/POST /api/v1/master-data/knowledge` | Baca: semua; tulis: `knowledge:manage` (DATA) |
| `GET /api/v1/master-data/audit` | `audit:read` (OWNER, DATA dengan izin eksplisit) |
| `POST /api/v1/cs/analyze` | `cs:analyze` (semua peran) |
| `GET /api/v1/tickets`, `GET /api/v1/tickets/:id` | `tickets:read` (semua peran) |
| `PATCH /api/v1/tickets/:id` | `tickets:manage` (CS) |
| `POST /api/v1/financial/calculate`, `/aggregate`, `/allocate` | `profit:read` (DATA, OWNER) |
| `GET /api/v1/transactions` | `transactions:read` (DATA, OWNER) |
| `POST /api/v1/transactions/manual`, `/import/preview`, `/import/commit`, `/adjustments` | `transactions:manage` (DATA) |
| `GET /api/v1/profit`, `GET /api/v1/profit/:id` | `profit:read` (DATA, OWNER) |
| `GET/PATCH /api/v1/settings` | Baca: DATA/OWNER; tulis: `settings:manage` (DATA) |
| `GET /api/v1/docs`, `GET /api/v1/openapi.json` | Publik (dokumentasi) |

## Struktur kode

```text
src/
├── app.js             # composition root + Swagger
├── index.js           # server bootstrap
├── config/            # env parsing
├── docs/              # OpenAPI contract
├── middleware/        # session/permission guards, CORS/headers, errors
├── modules/           # auth, master-data, cs, tickets, financial, transactions, dashboard, settings, health
├── domain/            # aturan bisnis murni tanpa Express
└── stores/            # store in-memory yang dapat diinjeksi
```

Setiap modul memisahkan `*.routes.js` (HTTP) dari `*.service.js` (use case, audit, riwayat). Aturan perhitungan, klasifikasi, izin, dan validasi pengaturan berada di `domain/` dan diuji langsung. Detail lengkap: [docs/architecture.md](../docs/architecture.md).

## Konfigurasi

- `PORT` (default `3001`)
- `DATABASE_URL` (opsional untuk health check)
- `CLIENT_ORIGIN` atau `CORS_ORIGIN` (default `http://localhost:5173`, boleh dipisah koma)
- `AUDIT_VIEWER_USERS` (daftar username DATA yang diizinkan melihat audit, dipisah koma)

Demo akun lokal: `cs-demo`, `data-demo`, atau `owner-demo`, semuanya menggunakan kata sandi `demo123`. Akun ini hanya untuk simulasi dan harus diganti sebelum penggunaan nyata.

## Tes

```powershell
npm test
```

Suite memakai store in-memory, tidak memerlukan PostgreSQL. Hasil aktual dicatat di [docs/test-report.md](../docs/test-report.md).
