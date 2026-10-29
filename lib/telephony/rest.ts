import twilio from "twilio";

/**
 * Moves a live call to new TwiML. Used to take a caller off the agent's
 * stream and onto Amy's screened ring; the agent leg ends when Twilio
 * fetches the new URL.
 */
export async function redirectLiveCall(input: {
  accountSid: string;
  authToken: string;
  callSid: string;
  url: string;
}): Promise<void> {
  await twilio(input.accountSid, input.authToken).calls(input.callSid).update({ url: input.url, method: "POST" });
}

/**
 * Amy's callback from the business number: rings Amy first, from the line the
 * customer called; when she answers, `url` (callback-bridge) dials the customer.
 */
export async function startCallbackCall(input: {
  accountSid: string;
  authToken: string;
  ownerPhone: string;
  lineE164: string;
  url: string;
}): Promise<string> {
  const call = await twilio(input.accountSid, input.authToken).calls.create({
    to: input.ownerPhone,
    from: input.lineE164,
    url: input.url,
    method: "POST",
  });
  return call.sid;
}
