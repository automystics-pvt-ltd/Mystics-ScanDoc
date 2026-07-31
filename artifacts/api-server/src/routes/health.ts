import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// /api/healthz — schema-validated
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// /api/health — plain fingerprint used by deploy smoke-test to confirm
// this binary (not a stale/foreign process) is running on the port.
router.get("/health", (_req, res) => {
  res.json({ status: "ok", app: "docscan-api" });
});

export default router;
