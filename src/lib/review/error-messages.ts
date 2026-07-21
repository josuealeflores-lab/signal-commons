/**
 * Reviewer-facing error-message mapping for submit_review_action's
 * idempotency/rate-limit guard clauses (M11 Phase B, docs/DECISIONS.md
 * D-100), kept in its own module rather than actions.ts -- a "use server"
 * file may only export async functions, and this is a plain synchronous
 * mapping function (mirrors src/lib/copilot/error-messages.ts's existing
 * separation).
 *
 * Only the five new SC00x codes (never the predefined PL/pgSQL P0001-P0004
 * class -- see the migration's own header comment for why) get a friendly,
 * distinct mapping here. Every other submit_review_action error (the
 * reviewer gate, item_type gate, per-action status-validity checks, the
 * edit_approve column allow-list, the evidence requirement) falls through
 * to the existing raw `error.message` passthrough, unchanged from before
 * M11 -- that passthrough is the established, intentional behavior for
 * this RPC's non-idempotency errors and is not altered here.
 */

const SC00X_MESSAGES: Record<string, string> = {
  SC001: "This action may have already been submitted. Please refresh the page and try again.",
  SC002: "This action could not be completed. Please refresh the page and try again.",
  SC003: "This action could not be completed. Please refresh the page and try again.",
  SC004: "You're submitting too quickly. Please wait a moment and try again.",
  SC005: "This action is still being processed. Please wait a moment and try again.",
};

interface RpcErrorLike {
  code?: string;
  message: string;
}

export function errorMessageFor(error: RpcErrorLike): string {
  if (error.code && SC00X_MESSAGES[error.code]) {
    return SC00X_MESSAGES[error.code];
  }
  return error.message;
}
