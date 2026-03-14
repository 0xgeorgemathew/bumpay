import { Router } from "express";
import { z } from "zod";
import { BitGoMerchantService } from "../bitgo-client.js";

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

const merchantWalletSchema = z.object({
  merchantAddress: addressSchema,
  merchantName: z.string().trim().min(1).max(64).optional(),
});

const createCheckoutSchema = merchantWalletSchema.extend({
  amount: z.string().regex(/^\d+$/),
  tokenSymbol: z.string().trim().min(1).max(16),
  tokenAddress: addressSchema,
  chainId: z.coerce.number(),
  expiresInSeconds: z.coerce.number().min(30).max(3600).optional(),
});

const customerTxSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  customerAddress: addressSchema,
});

const withdrawSchema = z.object({
  merchantAddress: addressSchema,
  destinationAddress: addressSchema,
  amount: z.string().regex(/^\d+$/),
});

export function createMerchantRouter(service: BitGoMerchantService) {
  const router = Router();

  router.get("/summary", async (req, res) => {
    try {
      const merchantAddress = addressSchema.parse(req.query.merchantAddress);
      const summary = await service.getMerchantSummary(merchantAddress as `0x${string}`);

      res.json({
        success: true,
        data: summary,
        message: "Merchant summary loaded",
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to load merchant summary",
      });
    }
  });

  router.post("/checkouts", async (req, res) => {
    try {
      const parsed = createCheckoutSchema.parse(req.body);
      const checkout = await service.createCheckout({
        merchantAddress: parsed.merchantAddress as `0x${string}`,
        merchantName: parsed.merchantName,
        amount: parsed.amount,
        tokenSymbol: parsed.tokenSymbol,
        tokenAddress: parsed.tokenAddress as `0x${string}`,
        chainId: parsed.chainId,
        expiresInSeconds: parsed.expiresInSeconds,
      });

      res.json({
        success: true,
        data: checkout,
        message: "BitGo checkout created",
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create checkout",
      });
    }
  });

  router.get("/checkouts/:id", async (req, res) => {
    try {
      const checkout = await service.getCheckout(req.params.id);
      if (!checkout) {
        res.status(404).json({
          success: false,
          error: "Checkout not found",
        });
        return;
      }

      res.json({
        success: true,
        data: checkout,
        message: "Checkout loaded",
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch checkout",
      });
    }
  });

  router.post("/checkouts/:id/customer-tx", async (req, res) => {
    try {
      const parsed = customerTxSchema.parse(req.body);
      const checkout = await service.reportCustomerTransaction({
        checkoutId: req.params.id,
        txHash: parsed.txHash as `0x${string}`,
        customerAddress: parsed.customerAddress as `0x${string}`,
      });

      res.json({
        success: true,
        data: checkout,
        message: "Customer transaction attached to checkout",
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to attach customer transaction",
      });
    }
  });

  router.post("/withdrawals", async (req, res) => {
    try {
      const parsed = withdrawSchema.parse(req.body);
      const result = await service.withdrawMerchantFunds({
        merchantAddress: parsed.merchantAddress as `0x${string}`,
        destinationAddress: parsed.destinationAddress as `0x${string}`,
        amount: parsed.amount,
      });

      res.json({
        success: true,
        data: result,
        message: "Merchant withdrawal submitted",
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to withdraw merchant funds",
      });
    }
  });

  return router;
}
