export const DEFAULT_SETTINGS = Object.freeze({
  freshnessLimitHours: 24,
  shippingCutoffBufferMinutes: 30,
  timezone: "Asia/Jakarta",
  lowMarginPercent: null,
  highRevenueThreshold: null
});

const SETTING_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));

function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function isValidTimeZone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function validateSettingsPatch(input = {}) {
  const errors = {};
  const value = {};

  for (const [key, raw] of Object.entries(input)) {
    if (!SETTING_KEYS.has(key)) continue;

    if (key === "freshnessLimitHours") {
      if (!isIntegerInRange(raw, 1, 168)) errors[key] = "Batas kesegaran harus bilangan bulat 1–168 jam.";
      else value[key] = raw;
    } else if (key === "shippingCutoffBufferMinutes") {
      if (!isIntegerInRange(raw, 0, 240)) errors[key] = "Penyangga batas jam harus bilangan bulat 0–240 menit.";
      else value[key] = raw;
    } else if (key === "timezone") {
      if (typeof raw !== "string" || raw.trim() === "" || !isValidTimeZone(raw.trim())) {
        errors[key] = "Zona waktu harus nama IANA yang valid, misalnya Asia/Jakarta.";
      } else {
        value[key] = raw.trim();
      }
    } else if (key === "lowMarginPercent") {
      if (raw !== null && !isIntegerInRange(raw, 0, 100)) errors[key] = "Ambang margin harus 0–100 atau null.";
      else value[key] = raw;
    } else if (key === "highRevenueThreshold") {
      if (raw !== null && (!Number.isInteger(raw) || raw < 0)) errors[key] = "Ambang omzet harus bilangan bulat nol atau lebih, atau null.";
      else value[key] = raw;
    }
  }

  if (Object.keys(value).length === 0 && Object.keys(errors).length === 0) {
    errors.form = "Tidak ada pengaturan yang diubah.";
  }

  return { errors, value };
}
