import express from "express";

export function createHealthRouter({ database }) {
  const router = express.Router();

  router.get("/health", async (_request, response) => {
    let databaseStatus = "not-configured";
    if (database) {
      try {
        await database.query("SELECT 1");
        databaseStatus = "connected";
      } catch {
        databaseStatus = "unavailable";
      }
    }
    response.json({
      service: "scentraops-backend",
      status: "ok",
      database: databaseStatus,
      simulatedData: true,
      apiVersion: "v1"
    });
  });

  return router;
}
