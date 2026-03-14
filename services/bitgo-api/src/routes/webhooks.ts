import { Router } from "express";
import { BitGoMerchantService } from "../bitgo-client.js";

export function createWebhookRouter(service: BitGoMerchantService) {
  const router = Router();

  router.post("/wallet", async (req, res) => {
    try {
      const payload =
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
      const result = await service.processWebhook(payload);

      res.json({
        success: true,
        data: result,
        message: result.accepted ? "Webhook accepted" : "Webhook stored without checkout match",
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to process webhook",
      });
    }
  });

  return router;
}
