// Who may send SMS through centralized-sms-gateway: the general caller rules in callerAccess.ts, with SMS wording.
// Pure, so it is unit tested with Vitest. Before this check the gateway accepted any valid token, including the
// public anon key in every browser, so anyone could send SMS charged to any practice's bundle.
import { decidePracticeAccess, type AccessMessages, type Caller } from './callerAccess.ts';

export { bearerToken } from './callerAccess.ts';

export type GatewayCaller = Caller;

export type GatewayAccess = { allowed: true } | { allowed: false; status: 401 | 403; error: string };

const SMS_MESSAGES: AccessMessages = {
  signIn: 'Sign in again to send SMS.',
  staffOnly: 'Only active practice staff can send SMS.',
  otherPractice: 'You can only send SMS for your own practice.'
};

export function decideGatewayAccess(caller: GatewayCaller, practiceId: string): GatewayAccess {
  const access = decidePracticeAccess(caller, practiceId, SMS_MESSAGES);
  if (!access.allowed) return access;
  // Every SMS is charged to the practice it names, so staff must name one (no fallback to their own practice)
  if (!caller.isServiceKey && !practiceId) return { allowed: false, status: 403, error: SMS_MESSAGES.otherPractice };
  return { allowed: true };
}
