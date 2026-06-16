import { HttpException, HttpStatus } from '@nestjs/common';

/** An optional "here's how to clear it" hint shown next to a blocker message. */
export interface BlockerAction {
  /** Button label, e.g. "Resolve NCR-0012". */
  label: string;
  /** Web route that resolves the blocker, e.g. "/ncrs/<id>". */
  link?: string;
}

/**
 * A business-rule gate that STOPS an action and tells the user *why* and *how to fix it*,
 * instead of a bare 4xx. Surfaced by {@link AllExceptionsFilter} as
 * `{ statusCode, code, message, action }` and rendered by the web BlockerBanner.
 *
 * Use this for state/lifecycle gates (open NCR, unreleased part, lost-inquiry→quote,
 * project/customer mismatch, closure checklist), NOT for input validation.
 */
export class BlockedException extends HttpException {
  constructor(
    /** Stable machine code, e.g. "INQUIRY_LOST". */
    code: string,
    /** Human-readable reason. */
    message: string,
    /** Optional one-click way to clear the blocker. */
    action?: BlockerAction,
    /** HTTP status — 409 Conflict by default (request conflicts with current state). */
    status: HttpStatus = HttpStatus.CONFLICT,
  ) {
    super({ blocked: true, code, message, action }, status);
  }
}
