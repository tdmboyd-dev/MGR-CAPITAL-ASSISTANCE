/**
 * Safety Boundaries
 *
 * These tests lock the rule that unconfigured or unverified external providers
 * must fail closed instead of manufacturing successful legal/financial/PII
 * results.
 */

import { describe, expect, it } from "@jest/globals";
import { paymentService } from "../../src/services/PaymentService.js";
import { skipTraceService } from "../../src/services/SkipTraceService.js";
import { documentSigningService } from "../../src/services/DocumentSigningService.js";
import { nickelPaymentService } from "../../src/services/NickelPaymentService.js";

describe("Provider safety boundaries", () => {
  it("does not simulate a Stripe payment when Stripe is unavailable", async () => {
    const status = paymentService.getServiceStatus();

    if (!status.stripe) {
      const result = await paymentService.createPayment(12500, "stripe", {
        description: "test",
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe("failed");
      expect(result.error).toContain("not configured");
    }
  });

  it("does not fabricate skip-trace PII when Tracerfy is unavailable", async () => {
    const status = skipTraceService.getStatus();

    if (!status.configured) {
      const result = await skipTraceService.tracePerson({
        firstName: "Test",
        lastName: "Person",
      });

      expect(result.status).toBe("error");
      expect(result.matchConfidence).toBe(0);
      expect(result.phones).toEqual([]);
      expect(result.emails).toEqual([]);
      expect(result.addresses).toEqual([]);
      expect(result.relatives).toEqual([]);
    }
  });

  it("does not fabricate e-signature requests while adapter is unverified", async () => {
    const status = documentSigningService.getServiceStatus();
    expect(status.adapterVerified).toBe(false);

    const result = await documentSigningService.createSignatureRequest({
      documentId: "doc_test",
      documentName: "Test Document",
      documentBase64: Buffer.from("test").toString("base64"),
      signers: [{ name: "Test Signer", email: "signer@example.com" }],
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe("pending");
    expect(result.signingUrl).toBeUndefined();
  });

  it("blocks historical Nickel money movement until current API reintegration", async () => {
    await expect(
      nickelPaymentService.createPaymentLink({
        amount: 100,
        description: "test",
        clientEmail: "client@example.com",
        clientName: "Test Client",
      })
    ).rejects.toThrow(/blocked pending current OpenAPI integration/i);
  });
});
