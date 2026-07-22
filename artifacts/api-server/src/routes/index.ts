import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import documentsRouter from "./documents";
import adminUsersRouter from "./admin-users";
import adminDocumentsRouter from "./admin-documents";
import adminEmailLogsRouter from "./admin-email-logs";
import adminRecipientsRouter from "./admin-recipients";
import adminSettingsRouter from "./admin-settings";
import adminDashboardRouter from "./admin-dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(documentsRouter);
router.use(adminUsersRouter);
router.use(adminDocumentsRouter);
router.use(adminEmailLogsRouter);
router.use(adminRecipientsRouter);
router.use(adminSettingsRouter);
router.use(adminDashboardRouter);

export default router;
