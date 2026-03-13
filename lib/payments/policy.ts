export interface PaymentPolicy {
  allowedChains: number[];
  allowedProtocols: string[];
  allowSwap: boolean;
  allowBridge: boolean;
  allowBorrow: boolean;
  maxSlippageBps: number;
  requireUserConfirmation: boolean;
}

export const DEFAULT_PAYMENT_POLICY: PaymentPolicy = {
  allowedChains: [84532],
  allowedProtocols: [],
  allowSwap: false,
  allowBridge: false,
  allowBorrow: false,
  maxSlippageBps: 100,
  requireUserConfirmation: true,
};

