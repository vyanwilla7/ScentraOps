const errorResponse = (description) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
});

const jsonResponse = (description, schema) => ({
  description,
  content: { "application/json": { schema } }
});

const requestBody = (schema, required = true) => ({
  required,
  content: { "application/json": { schema } }
});

const secured = (permission, roles) => ({
  security: [{ sessionCookie: [] }],
  "x-required-permissions": [permission],
  "x-required-roles": roles
});

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const arrayOf = (schema) => ({ type: "array", items: schema });

const unauthorized = errorResponse("Sesi tidak ada atau sudah berakhir.");
const forbidden = errorResponse("Peran tidak memiliki izin.");
const notFound = errorResponse("Data tidak ditemukan.");
const invalid = errorResponse("Input tidak valid.");

const transactionInputProperties = {
  marketplace: { type: "string", example: "Shopee" },
  orderId: { type: "string", example: "D001" },
  lineId: { oneOf: [{ type: "integer" }, { type: "string" }], example: 1 },
  orderDate: { type: "string", format: "date", example: "2026-11-12" },
  status: { type: "string", enum: ["selesai"], example: "selesai" },
  sku: { type: "string", example: "KRM-AJW-500" },
  quantity: { type: "integer", minimum: 1, example: 1 },
  grossSales: { type: "integer", minimum: 0, example: 100000 },
  sellerDiscount: { type: "integer", minimum: 0, nullable: true, example: 10000 },
  refund: { type: "integer", minimum: 0, nullable: true, example: 0 },
  unitProductCost: { type: "integer", minimum: 0, nullable: true, example: 50000 },
  recoverableReturnedProductCost: { type: "integer", minimum: 0, nullable: true, example: 0 },
  netCommission: { type: "integer", minimum: 0, nullable: true, example: 5000 },
  sellerShipping: { type: "integer", minimum: 0, nullable: true, example: 3000 },
  packaging: { type: "integer", minimum: 0, nullable: true, example: 2000 },
  returnCost: { type: "integer", minimum: 0, nullable: true, example: 0 },
  otherCost: { type: "integer", minimum: 0, nullable: true, example: 0 }
};

export const openapiDocument = {
  openapi: "3.0.3",
  info: {
    title: "ScentraOps API",
    version: "1.0.0",
    description: [
      "API internal ScentraOps untuk asisten CS, tiket, master data, transaksi, dan laba kontribusi.",
      "Semua data adalah sintetis. Otorisasi diperiksa di server berdasarkan Tabel 7 proposal.",
      "Login menggunakan cookie sesi HTTP-only `scentra_session`; buka `/api/v1/docs` lalu login lewat endpoint `/auth/login`."
    ].join("\n\n")
  },
  servers: [{ url: "/api/v1", description: "API versi 1" }],
  tags: [
    { name: "Health", description: "Status layanan" },
    { name: "Auth", description: "Login, sesi, dan logout" },
    { name: "Catalog", description: "Baca katalog tanpa HPP" },
    { name: "Master data", description: "SKU, stok, HPP berversi, pengetahuan, audit" },
    { name: "CS", description: "Analisis pesan dan pembuatan tiket" },
    { name: "Tickets", description: "Antrean dan riwayat tiket" },
    { name: "Financial", description: "Fungsi hitung, agregasi, dan alokasi murni" },
    { name: "Transactions", description: "Input manual, impor CSV, dan penyesuaian" },
    { name: "Dashboard", description: "Laba kontribusi dan drill-down" },
    { name: "Settings", description: "Pengaturan batas kesegaran, penyangga, ambang, zona waktu" }
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Status API dan koneksi database",
        responses: {
          200: jsonResponse("Layanan sehat", {
            type: "object",
            properties: {
              service: { type: "string" },
              status: { type: "string" },
              database: { type: "string", enum: ["connected", "unavailable", "not-configured"] },
              simulatedData: { type: "boolean" },
              apiVersion: { type: "string" }
            }
          })
        }
      }
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login dan buat sesi HTTP-only",
        requestBody: requestBody({
          type: "object",
          required: ["username", "password"],
          properties: { username: { type: "string" }, password: { type: "string", format: "password" } }
        }),
        responses: {
          200: jsonResponse("Login berhasil", { type: "object", properties: { user: ref("User") } }),
          400: invalid,
          401: errorResponse("Nama pengguna atau kata sandi salah.")
        }
      }
    },
    "/auth/session": {
      get: {
        tags: ["Auth"],
        summary: "Sesi aktif beserta izin peran",
        ...secured("session:read", ["CS", "DATA", "OWNER"]),
        responses: {
          200: jsonResponse("Sesi aktif", { type: "object", properties: { user: ref("User") } }),
          401: unauthorized
        }
      }
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Hapus sesi aktif",
        ...secured("session:read", ["CS", "DATA", "OWNER"]),
        responses: { 200: jsonResponse("Logout berhasil", { type: "object", properties: { ok: { type: "boolean" } } }), 401: unauthorized }
      }
    },
    "/catalog": {
      get: {
        tags: ["Catalog"],
        summary: "Baca katalog tanpa HPP",
        ...secured("catalog:read", ["CS", "DATA", "OWNER"]),
        responses: { 200: jsonResponse("Daftar SKU", arrayOf(ref("Sku"))), 401: unauthorized, 403: forbidden }
      }
    },
    "/master-data/skus": {
      get: {
        tags: ["Master data"],
        summary: "Daftar SKU, stok, dan status aktif",
        ...secured("catalog:read", ["CS", "DATA", "OWNER"]),
        responses: { 200: jsonResponse("Daftar SKU", { type: "object", properties: { items: arrayOf(ref("Sku")) } }), 401: unauthorized, 403: forbidden }
      },
      post: {
        tags: ["Master data"],
        summary: "Buat SKU (staf data)",
        ...secured("catalog:manage", ["DATA"]),
        requestBody: requestBody(ref("SkuInput")),
        responses: { 201: jsonResponse("SKU dibuat", { type: "object", properties: { item: ref("Sku") } }), 400: invalid, 401: unauthorized, 403: forbidden, 409: errorResponse("Kode SKU duplikat.") }
      }
    },
    "/master-data/skus/{id}": {
      patch: {
        tags: ["Master data"],
        summary: "Perbarui nama, alias, stok, atau status aktif (staf data)",
        ...secured("catalog:manage", ["DATA"]),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: requestBody(ref("SkuPatch")),
        responses: { 200: jsonResponse("SKU diperbarui", { type: "object", properties: { item: ref("Sku") } }), 400: invalid, 401: unauthorized, 403: forbidden, 404: notFound }
      }
    },
    "/master-data/skus/{id}/costs": {
      get: {
        tags: ["Master data"],
        summary: "Riwayat HPP berversi untuk satu SKU",
        ...secured("costs:read", ["DATA", "OWNER"]),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: jsonResponse("Riwayat HPP", { type: "object", properties: { items: arrayOf(ref("Cost")) } }), 401: unauthorized, 403: forbidden }
      },
      post: {
        tags: ["Master data"],
        summary: "Tambah versi HPP baru",
        ...secured("costs:manage", ["DATA", "OWNER"]),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: requestBody(ref("CostInput")),
        responses: { 201: jsonResponse("HPP dibuat", { type: "object", properties: { item: ref("Cost") } }), 400: invalid, 401: unauthorized, 403: forbidden, 404: notFound }
      }
    },
    "/master-data/knowledge": {
      get: {
        tags: ["Master data"],
        summary: "Daftar pengetahuan beserta status kesegaran",
        ...secured("knowledge:read", ["CS", "DATA", "OWNER"]),
        responses: { 200: jsonResponse("Daftar pengetahuan", { type: "object", properties: { items: arrayOf(ref("Knowledge")) } }), 401: unauthorized, 403: forbidden }
      },
      post: {
        tags: ["Master data"],
        summary: "Tambah versi pengetahuan (staf data)",
        ...secured("knowledge:manage", ["DATA"]),
        requestBody: requestBody(ref("KnowledgeInput")),
        responses: { 201: jsonResponse("Pengetahuan dibuat", { type: "object", properties: { item: ref("Knowledge") } }), 400: invalid, 401: unauthorized, 403: forbidden }
      }
    },
    "/master-data/audit": {
      get: {
        tags: ["Master data"],
        summary: "Audit log (OWNER; DATA hanya jika diizinkan eksplisit)",
        ...secured("audit:read", ["OWNER", "DATA (explicit)"]),
        responses: { 200: jsonResponse("Audit log", { type: "object", properties: { items: arrayOf(ref("AuditEntry")) } }), 401: unauthorized, 403: forbidden }
      }
    },
    "/cs/analyze": {
      post: {
        tags: ["CS"],
        summary: "Analisis pesan pelanggan sintetis",
        ...secured("cs:analyze", ["CS", "DATA", "OWNER"]),
        requestBody: requestBody(ref("AnalyzeInput")),
        responses: { 200: jsonResponse("Hasil analisis dan tiket opsional", ref("AnalyzeResponse")), 400: invalid, 401: unauthorized, 403: forbidden }
      }
    },
    "/tickets": {
      get: {
        tags: ["Tickets"],
        summary: "Antrean tiket dengan filter",
        ...secured("tickets:read", ["CS", "DATA", "OWNER"]),
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["Baru", "Diproses", "Selesai"] } },
          { name: "priority", in: "query", schema: { type: "string", enum: ["Rendah", "Sedang", "Tinggi"] } },
          { name: "assignee", in: "query", schema: { type: "string" } }
        ],
        responses: { 200: jsonResponse("Daftar tiket", { type: "object", properties: { items: arrayOf(ref("Ticket")) } }), 401: unauthorized, 403: forbidden }
      }
    },
    "/tickets/{id}": {
      get: {
        tags: ["Tickets"],
        summary: "Detail tiket dan riwayat",
        ...secured("tickets:read", ["CS", "DATA", "OWNER"]),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: jsonResponse("Detail tiket", { type: "object", properties: { item: ref("Ticket"), history: arrayOf(ref("TicketHistory")) } }), 401: unauthorized, 403: forbidden, 404: notFound }
      },
      patch: {
        tags: ["Tickets"],
        summary: "Ubah status, prioritas, atau assignee (CS)",
        ...secured("tickets:manage", ["CS"]),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: requestBody(ref("TicketPatch")),
        responses: { 200: jsonResponse("Tiket diperbarui", { type: "object", properties: { item: ref("Ticket"), history: arrayOf(ref("TicketHistory")) } }), 400: invalid, 401: unauthorized, 403: forbidden, 404: notFound }
      }
    },
    "/financial/calculate": {
      post: {
        tags: ["Financial"],
        summary: "Hitung satu baris rupiah",
        ...secured("profit:read", ["DATA", "OWNER"]),
        requestBody: requestBody(ref("TransactionInput")),
        responses: { 200: jsonResponse("Baris terhitung", { type: "object", properties: { line: ref("TransactionLine") } }), 401: unauthorized, 403: forbidden }
      }
    },
    "/financial/aggregate": {
      post: {
        tags: ["Financial"],
        summary: "Agregasi baris aktif dan lengkap",
        ...secured("profit:read", ["DATA", "OWNER"]),
        requestBody: requestBody({ type: "object", required: ["lines"], properties: { lines: arrayOf(ref("TransactionLine")) } }),
        responses: { 200: jsonResponse("Ringkasan", { type: "object", properties: { summary: ref("Summary") } }), 400: invalid, 401: unauthorized, 403: forbidden }
      }
    },
    "/financial/allocate": {
      post: {
        tags: ["Financial"],
        summary: "Alokasi biaya berdasarkan grossSales atau quantity",
        ...secured("profit:read", ["DATA", "OWNER"]),
        requestBody: requestBody({
          type: "object",
          required: ["lines", "amount", "basis"],
          properties: {
            amount: { type: "integer", minimum: 0 },
            basis: { type: "string", enum: ["grossSales", "quantity"] },
            lines: arrayOf({ type: "object", additionalProperties: true })
          }
        }),
        responses: { 200: jsonResponse("Hasil alokasi", { type: "object", properties: { items: arrayOf({ type: "object", properties: { lineId: {}, amount: { type: "integer" } } }) } }), 400: errorResponse("Basis alokasi tidak valid."), 401: unauthorized, 403: forbidden }
      }
    },
    "/transactions": {
      get: {
        tags: ["Transactions"],
        summary: "Baris transaksi tersimpan",
        ...secured("transactions:read", ["DATA", "OWNER"]),
        responses: { 200: jsonResponse("Daftar transaksi", { type: "object", properties: { items: arrayOf(ref("TransactionLine")) } }), 401: unauthorized, 403: forbidden }
      }
    },
    "/transactions/manual": {
      post: {
        tags: ["Transactions"],
        summary: "Input transaksi manual (staf data)",
        ...secured("transactions:manage", ["DATA"]),
        requestBody: requestBody(ref("ManualTransactionInput")),
        responses: { 201: jsonResponse("Transaksi diproses", ref("CommitResult")), 400: errorResponse("Validasi gagal; lihat result.preview[].errors."), 401: unauthorized, 403: forbidden, 409: errorResponse("Pembaruan memerlukan persetujuan.") }
      }
    },
    "/transactions/import/preview": {
      post: {
        tags: ["Transactions"],
        summary: "Pratinjau CSV dengan mapping kolom",
        ...secured("transactions:manage", ["DATA"]),
        requestBody: requestBody({ type: "object", required: ["csvText", "mapping"], properties: { csvText: { type: "string", maxLength: 5242880 }, mapping: { type: "object", additionalProperties: { type: "string" } } } }),
        responses: { 200: jsonResponse("Pratinjau validasi", { type: "object", properties: { rows: arrayOf(ref("ImportRow")), rowCount: { type: "integer" } } }), 400: errorResponse("CSV tidak valid."), 401: unauthorized, 403: forbidden }
      }
    },
    "/transactions/import/commit": {
      post: {
        tags: ["Transactions"],
        summary: "Commit CSV atau baris pratinjau",
        ...secured("transactions:manage", ["DATA"]),
        requestBody: requestBody({
          type: "object",
          required: ["reason"],
          properties: {
            csvText: { type: "string" },
            mapping: { type: "object", additionalProperties: { type: "string" } },
            lines: arrayOf(ref("TransactionInput")),
            approveUpdates: { type: "boolean", default: false },
            reason: { type: "string" }
          }
        }),
        responses: { 201: jsonResponse("Import selesai", ref("CommitResult")), 400: errorResponse("Baris ditolak atau import tidak valid."), 401: unauthorized, 403: forbidden, 409: errorResponse("Persetujuan pembaruan diperlukan.") }
      }
    },
    "/transactions/adjustments": {
      post: {
        tags: ["Transactions"],
        summary: "Penyesuaian dengan referensi sumber",
        ...secured("transactions:manage", ["DATA"]),
        requestBody: requestBody(ref("AdjustmentInput")),
        responses: { 201: jsonResponse("Penyesuaian dibuat", { type: "object", properties: { item: ref("Adjustment") } }), 400: invalid, 401: unauthorized, 403: forbidden }
      }
    },
    "/profit": {
      get: {
        tags: ["Dashboard"],
        summary: "Laporan laba kontribusi dengan filter",
        ...secured("profit:read", ["DATA", "OWNER"]),
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "marketplace", in: "query", schema: { type: "string" } },
          { name: "sku", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["Lengkap", "Belum lengkap", "Ditolak"] } }
        ],
        responses: { 200: jsonResponse("Laporan dashboard", ref("Dashboard")), 401: unauthorized, 403: forbidden }
      }
    },
    "/profit/{id}": {
      get: {
        tags: ["Dashboard"],
        summary: "Drill-down satu baris transaksi",
        ...secured("profit:read", ["DATA", "OWNER"]),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: jsonResponse("Baris transaksi", { type: "object", properties: { item: ref("TransactionLine") } }), 401: unauthorized, 403: forbidden, 404: notFound }
      }
    },
    "/settings": {
      get: {
        tags: ["Settings"],
        summary: "Baca pengaturan (DATA/OWNER)",
        ...secured("settings:read", ["DATA", "OWNER"]),
        responses: { 200: jsonResponse("Pengaturan aktif", { type: "object", properties: { item: ref("Settings") } }), 401: unauthorized, 403: forbidden }
      },
      patch: {
        tags: ["Settings"],
        summary: "Ubah pengaturan (DATA) dengan alasan",
        ...secured("settings:manage", ["DATA"]),
        requestBody: requestBody(ref("SettingsPatch")),
        responses: { 200: jsonResponse("Pengaturan diperbarui", { type: "object", properties: { item: ref("Settings") } }), 400: invalid, 401: unauthorized, 403: forbidden }
      }
    }
  },
  components: {
    securitySchemes: {
      sessionCookie: { type: "apiKey", in: "cookie", name: "scentra_session" }
    },
    schemas: {
      Error: {
        type: "object",
        properties: { code: { type: "string", example: "FORBIDDEN" }, message: { type: "string" }, errors: { type: "object", additionalProperties: { type: "string" } } }
      },
      User: {
        type: "object",
        properties: {
          id: { oneOf: [{ type: "integer" }, { type: "string" }] },
          username: { type: "string" },
          displayName: { type: "string" },
          role: { type: "string", enum: ["CS", "DATA", "OWNER"] },
          permissions: arrayOf({ type: "string" })
        }
      },
      Sku: {
        type: "object",
        properties: {
          id: { type: "string" },
          code: { type: "string" },
          name: { type: "string" },
          aliases: arrayOf({ type: "string" }),
          stock: { type: "integer", nullable: true, description: "0 berarti habis; null berarti belum diketahui." },
          stockUpdatedAt: { type: "string", format: "date-time", nullable: true },
          active: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          createdBy: { type: "string" }
        }
      },
      SkuInput: {
        type: "object",
        required: ["code", "name"],
        properties: {
          code: { type: "string", example: "KRM-AJW-500" },
          name: { type: "string", example: "Kurma Ajwa 500gr" },
          aliases: arrayOf({ type: "string" }),
          stock: { type: "integer", nullable: true, minimum: 0 },
          stockUpdatedAt: { type: "string", format: "date-time" },
          reason: { type: "string" }
        }
      },
      SkuPatch: {
        type: "object",
        properties: {
          name: { type: "string" },
          aliases: arrayOf({ type: "string" }),
          stock: { type: "integer", nullable: true, minimum: 0 },
          stockUpdatedAt: { type: "string", format: "date-time" },
          active: { type: "boolean" },
          reason: { type: "string" }
        }
      },
      Cost: {
        type: "object",
        properties: {
          id: { type: "string" },
          skuId: { type: "string" },
          amount: { type: "integer" },
          effectiveFrom: { type: "string", format: "date" },
          reason: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          createdBy: { type: "string" }
        }
      },
      CostInput: {
        type: "object",
        required: ["amount", "effectiveFrom", "reason"],
        properties: {
          amount: { type: "integer", minimum: 0, example: 50000 },
          effectiveFrom: { type: "string", format: "date", example: "2026-11-01" },
          reason: { type: "string", example: "Pembaruan harga pemasok" }
        }
      },
      Knowledge: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          source: { type: "string" },
          version: { type: "string" },
          effectiveAt: { type: "string", format: "date-time" },
          expiresAt: { type: "string", format: "date-time", nullable: true },
          freshness: { type: "string", enum: ["Valid", "Usang", "Belum diketahui"] },
          createdAt: { type: "string", format: "date-time" },
          createdBy: { type: "string" }
        }
      },
      KnowledgeInput: {
        type: "object",
        required: ["title", "content", "source", "version", "effectiveAt"],
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          source: { type: "string" },
          version: { type: "string" },
          effectiveAt: { type: "string", format: "date-time" },
          expiresAt: { type: "string", format: "date-time", nullable: true },
          reason: { type: "string" }
        }
      },
      AuditEntry: {
        type: "object",
        properties: {
          id: { type: "string" },
          action: { type: "string" },
          entity: { type: "string" },
          entityId: { type: "string" },
          actor: { type: "string" },
          reason: { type: "string" },
          before: { type: "object", additionalProperties: true },
          after: { type: "object", additionalProperties: true },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      Ticket: {
        type: "object",
        properties: {
          id: { type: "string" },
          number: { type: "string", example: "TKT-000001" },
          type: { type: "string" },
          priority: { type: "string", enum: ["Rendah", "Sedang", "Tinggi"] },
          status: { type: "string", enum: ["Baru", "Diproses", "Selesai"] },
          assignee: { type: "string", nullable: true },
          originalMessage: { type: "string" },
          normalizedMessage: { type: "string" },
          reason: { type: "string" },
          skuId: { type: "string", nullable: true },
          createdBy: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      TicketHistory: {
        type: "object",
        properties: {
          id: { type: "string" },
          ticketId: { type: "string" },
          action: { type: "string" },
          from: { nullable: true },
          to: { nullable: true },
          actor: { type: "string" },
          reason: { type: "string" },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      TicketPatch: {
        type: "object",
        required: ["reason"],
        properties: {
          status: { type: "string", enum: ["Baru", "Diproses", "Selesai"] },
          priority: { type: "string", enum: ["Rendah", "Sedang", "Tinggi"] },
          assignee: { type: "string", nullable: true },
          reason: { type: "string", example: "Diverifikasi ke staf data" }
        }
      },
      AnalyzeInput: {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string", example: "kurma ajva 500g ada gk?" },
          now: { type: "string", format: "date-time" },
          cutoff: { type: "string", format: "date-time" },
          bufferMinutes: { type: "integer", minimum: 0 },
          freshnessLimitHours: { type: "integer", minimum: 1 }
        }
      },
      Analysis: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["Keluhan", "Informasi belum pasti", "Pertanyaan umum"] },
          reason: { type: "string" },
          normalized: { type: "string" },
          candidate: { type: "object", nullable: true, additionalProperties: true },
          stock: { type: "integer", nullable: true },
          matching: { type: "object", additionalProperties: true },
          multiIntent: { type: "boolean" },
          status: { type: "string", enum: ["Valid", "Usang", "Belum diketahui"] },
          stockStatus: { type: "string" },
          knowledgeStatus: { type: "string", nullable: true },
          source: { type: "string", nullable: true },
          version: { type: "string", nullable: true },
          updatedAt: { type: "string", nullable: true },
          knowledge: { type: "object", nullable: true, additionalProperties: true },
          shipping: { type: "object", nullable: true, additionalProperties: true },
          suggestion: { type: "string" },
          verificationRequired: { type: "boolean" },
          complaint: { type: "boolean" },
          automaticSending: { type: "boolean" }
        }
      },
      AnalyzeResponse: {
        type: "object",
        properties: { analysis: ref("Analysis"), ticket: { ...ref("Ticket"), nullable: true } }
      },
      TransactionInput: {
        type: "object",
        required: ["marketplace", "orderId", "lineId", "orderDate", "status", "sku", "quantity", "grossSales"],
        properties: transactionInputProperties
      },
      ManualTransactionInput: {
        type: "object",
        required: ["marketplace", "orderId", "lineId", "orderDate", "status", "sku", "quantity", "grossSales", "reason"],
        properties: { ...transactionInputProperties, reason: { type: "string" } }
      },
      TransactionLine: {
        type: "object",
        additionalProperties: true,
        properties: {
          id: { type: "string" },
          active: { type: "boolean" },
          validation: { type: "object", properties: { status: { type: "string", enum: ["Lengkap", "Belum lengkap", "Ditolak"] }, errors: { type: "object", additionalProperties: { type: "string" } } } },
          netRevenue: { type: "integer", nullable: true },
          netProductCost: { type: "integer", nullable: true },
          contributionProfit: { type: "integer", nullable: true },
          margin: { type: "number", nullable: true }
        }
      },
      Summary: {
        type: "object",
        properties: {
          completeCount: { type: "integer" },
          totalCount: { type: "integer" },
          coverage: { type: "number", nullable: true },
          netRevenue: { type: "integer" },
          contributionProfit: { type: "integer" },
          margin: { type: "number", nullable: true },
          zeroRevenueCount: { type: "integer" },
          incompleteCount: { type: "integer" }
        }
      },
      ImportRow: {
        type: "object",
        properties: {
          sourceRow: { type: "integer" },
          key: { type: "string" },
          status: { type: "string", enum: ["Lengkap", "Belum lengkap", "Ditolak"] },
          errors: { type: "object", additionalProperties: { type: "string" } },
          line: ref("TransactionLine")
        }
      },
      CommitResult: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["COMMITTED", "REJECTED", "APPROVAL_REQUIRED"] },
          preview: arrayOf(ref("ImportRow")),
          inserted: arrayOf(ref("TransactionLine")),
          skipped: arrayOf(ref("TransactionLine")),
          updated: arrayOf(ref("TransactionLine")),
          updateKey: { type: "string" }
        }
      },
      AdjustmentInput: {
        type: "object",
        required: ["sourceReference", "amount", "note"],
        properties: {
          sourceReference: { type: "string", example: "RF-001" },
          amount: { type: "integer", minimum: 0, example: 150000 },
          note: { type: "string", example: "Retur penuh" }
        }
      },
      Adjustment: {
        type: "object",
        additionalProperties: true,
        properties: {
          id: { type: "string" },
          sourceReference: { type: "string" },
          amount: { type: "integer" },
          note: { type: "string" },
          actor: { type: "string" },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      GroupRow: {
        type: "object",
        properties: {
          key: { type: "string" },
          completeCount: { type: "integer" },
          totalCount: { type: "integer" },
          coverage: { type: "number", nullable: true },
          netRevenue: { type: "integer" },
          contributionProfit: { type: "integer" },
          margin: { type: "number", nullable: true },
          zeroRevenueCount: { type: "integer" },
          incompleteCount: { type: "integer" }
        }
      },
      Dashboard: {
        type: "object",
        properties: {
          filters: { type: "object", additionalProperties: true },
          summary: ref("Summary"),
          signals: {
            type: "object",
            properties: {
              losses: { type: "integer" },
              zeroRevenue: { type: "integer" },
              incomplete: { type: "integer" },
              lowMargin: { type: "integer", nullable: true, description: "null berarti ambang belum diatur." },
              lowMarginThreshold: { type: "number", nullable: true },
              disclaimer: { type: "string" }
            }
          },
          byMarketplace: arrayOf(ref("GroupRow")),
          bySku: arrayOf(ref("GroupRow")),
          items: arrayOf(ref("TransactionLine"))
        }
      },
      Settings: {
        type: "object",
        properties: {
          freshnessLimitHours: { type: "integer", minimum: 1, maximum: 168, default: 24 },
          shippingCutoffBufferMinutes: { type: "integer", minimum: 0, maximum: 240, default: 30 },
          timezone: { type: "string", default: "Asia/Jakarta" },
          lowMarginPercent: { type: "integer", nullable: true, minimum: 0, maximum: 100, default: null },
          highRevenueThreshold: { type: "integer", nullable: true, minimum: 0, default: null }
        }
      },
      SettingsPatch: {
        type: "object",
        required: ["reason"],
        properties: {
          freshnessLimitHours: { type: "integer", minimum: 1, maximum: 168 },
          shippingCutoffBufferMinutes: { type: "integer", minimum: 0, maximum: 240 },
          timezone: { type: "string" },
          lowMarginPercent: { type: "integer", nullable: true, minimum: 0, maximum: 100 },
          highRevenueThreshold: { type: "integer", nullable: true, minimum: 0 },
          reason: { type: "string" }
        }
      }
    }
  }
};
