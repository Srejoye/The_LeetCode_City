import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyIpnSignature } from "@/lib/nowpayments";
import { autoEquipIfSolo, fulfillItemPurchase } from "@/lib/items";
import { sendPurchaseNotification, sendGiftSentNotification } from "@/lib/notification-senders/purchase";
import { sendGiftReceivedNotification } from "@/lib/notification-senders/gift";
import { SKY_AD_PLANS, isValidPlanId } from "@/lib/skyAdPlans";


export const dynamic = "force-dynamic";

/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch (err) { console.warn("[app/api/webhooks/nowpayments/route.ts] error:", err); return NextResponse.json({ error: "Invalid body" }, { status: 400 });
   }
  // Verify HMAC-SHA512 signature
  const signature = request.headers.get("x-nowpayments-sig");
  if (!signature || !verifyIpnSignature(body, signature)) {
    console.error("NOWPayments webhook signature mismatch");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();

  const paymentStatus: string = body.payment_status;
  const orderId: string | undefined = body.order_id;
  const paymentId = body.payment_id ? String(body.payment_id) : undefined;

  if (!orderId) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (paymentStatus) {
      case "finished":
      case "confirmed": {
        // Check if it is a sky ad purchase (linked to orderId)
        let { data: ad } = await sb
          .from("sky_ads")
          .select("id, plan_id, active")
          .eq("stripe_session_id", orderId)
          .maybeSingle();

        if (ad) {
          if (!ad.active) {
            const planId = ad.plan_id;
            if (planId && isValidPlanId(planId)) {
              const plan = SKY_AD_PLANS[planId];
              const now = new Date();
              const endsAt = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

              await sb
                .from("sky_ads")
                .update({
                  active: true,
                  starts_at: now.toISOString(),
                  ends_at: endsAt.toISOString(),
                  purchaser_email: body.customer_email ?? null,
                })
                .eq("id", ad.id)
                .eq("active", false);

              if (plan.vehicle === "plane") {
                await sb
                  .from("sky_ads")
                  .update({ active: false })
                  .eq("id", "advertise")
                  .eq("active", true);
              }
            }
          }
          break;
        }

        // Atomic claim: prevents double-fulfillment on NOWPayments' frequent retries.
        const { data: claimed } = await sb
          .from("purchases")
          .update({ status: "processing" })
          .eq("provider", "nowpayments")
          .eq("status", "pending")
          .eq("provider_tx_id", orderId)
          .select("id, developer_id, item_id, gifted_to")
          .maybeSingle();

        if (!claimed) break; // already claimed or not found

        const ownerId = claimed.gifted_to ?? claimed.developer_id;
        const { status: purchaseStatus } = await fulfillItemPurchase(ownerId, claimed.item_id, sb);

        await sb
          .from("purchases")
          .update({
            status: purchaseStatus,
            provider_tx_id: paymentId ?? orderId,
          })
          .eq("id", claimed.id);

        // Auto-equip if solo item in zone
        await autoEquipIfSolo(ownerId, claimed.item_id);

        // Insert feed event
        const { data: dev } = await sb
          .from("developers")
          .select("github_login")
          .eq("id", claimed.developer_id)
          .single();

        if (claimed.gifted_to) {
          const { data: receiver } = await sb
            .from("developers")
            .select("github_login")
            .eq("id", claimed.gifted_to)
            .single();
          await sb.from("activity_feed").insert({
            event_type: "gift_sent",
            actor_id: claimed.developer_id,
            target_id: claimed.gifted_to,
            metadata: {
              giver_login: dev?.github_login,
              receiver_login: receiver?.github_login ?? "unknown",
              item_id: claimed.item_id,
            },
          });
          sendGiftSentNotification(claimed.developer_id, dev?.github_login ?? "", receiver?.github_login ?? "unknown", claimed.id, claimed.item_id);
          sendGiftReceivedNotification(claimed.gifted_to, dev?.github_login ?? "someone", receiver?.github_login ?? "unknown", claimed.id, claimed.item_id);
        } else {
          await sb.from("activity_feed").insert({
            event_type: "item_purchased",
            actor_id: claimed.developer_id,
            metadata: { login: dev?.github_login, item_id: claimed.item_id },
          });
          sendPurchaseNotification(claimed.developer_id, dev?.github_login ?? "", claimed.id, claimed.item_id);
        }
        break;
      }

      case "expired":
      case "failed":
      case "refunded": {
        const newStatus = paymentStatus === "refunded" ? "refunded" : "expired";
        await sb
          .from("purchases")
          .update({ status: newStatus })
          .eq("provider_tx_id", orderId)
          .eq("status", "pending")
          .eq("provider", "nowpayments");
        break;
      }

      // "waiting", "confirming", "sending", "partially_paid" — no action needed
    }
  } catch (err) {
    console.error("NOWPayments webhook handler error:", err);
  }

  return NextResponse.json({ received: true });
}
