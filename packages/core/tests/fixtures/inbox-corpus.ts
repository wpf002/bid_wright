import type { InboundEmail } from "../../src/inbox/detect";

/**
 * A 100-email corpus for the Phase 5 exit criterion ("zero false positives on
 * non-ITB email in a 100-email test set").
 *
 * The negatives are deliberately adversarial: construction email is full of
 * mail that mentions bids, comes from real GCs, and carries PDFs without being
 * a solicitation — invoices, payment applications, award notices, addenda for
 * jobs already bid. An easy corpus of newsletters would prove nothing.
 */

let seq = 0;
const pdf = (fileName: string) => ({ fileName, contentType: "application/pdf", size: 240_000 });
const xlsx = (fileName: string) => ({
  fileName,
  contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  size: 40_000,
});

function email(p: Partial<InboundEmail> & { subject: string; from: string }): InboundEmail {
  seq++;
  return {
    messageId: `<msg-${seq}@example.com>`,
    to: "u-abc123@inbox.bidwright.app",
    text: "",
    attachments: [],
    fromName: null,
    html: null,
    ...p,
  };
}

/** Real solicitations — these must be detected. */
export const ITB_EMAILS: InboundEmail[] = [
  email({
    from: "malvarez@turnerridge.com",
    subject: "Invitation to Bid — Northside Elementary Electrical Renovation",
    text: "We invite you to bid the electrical scope. Bids due August 12, 2026 at 2:00 PM. Pre-bid walkthrough July 29. Plans and specs attached.",
    attachments: [pdf("northside-itb.pdf"), pdf("drawings-E1.pdf")],
  }),
  email({
    from: "estimating@austincommercial.com",
    subject: "ITB: DFW Concourse D — Structural Steel Package",
    text: "Please review the attached bid documents. Scope of work covers structural steel erection. Bid due 8/20.",
    attachments: [pdf("concourse-d-itb.pdf")],
  }),
  email({
    from: "bids@ryancompanies.com",
    subject: "Request for Quote - Municipal Water Treatment Phase 2 Plumbing",
    text: "Please quote the plumbing scope per the attached drawings and specifications. Bid date 7/30.",
    attachments: [pdf("water-treatment-rfq.pdf")],
  }),
  email({
    from: "jsmith@hoarconstruction.com",
    subject: "Bid Invitation — Retail Center HVAC Retrofit",
    text: "You are invited to submit a bid for the HVAC retrofit. Scope of work and plans attached. Job walk on Friday.",
    attachments: [pdf("hvac-retrofit.pdf")],
  }),
  email({
    from: "precon@alstonco.com",
    subject: "Notice to Bidders: Warehouse Slab on Grade",
    text: "Bid documents attached. Bids due at 3pm. Please confirm your intent to bid.",
    attachments: [pdf("warehouse-slab.pdf")],
  }),
  email({
    from: "kwong@turnerridge.com",
    subject: "Bid Package 3 — Interior Finishes",
    text: "Attached is bid package 3. Scope of work includes drywall and painting. Pre-bid meeting Tuesday. Bids due 9/1.",
    attachments: [pdf("bp3-interior.pdf")],
  }),
  email({
    from: "solicitations@dallasisd.org",
    subject: "Bid Solicitation 2026-114 — Fire Alarm Upgrade",
    text: "Solicitation number 2026-114. Sealed bids due. Drawings and specifications attached. Prevailing wage applies.",
    attachments: [pdf("solicitation-2026-114.pdf")],
  }),
  email({
    from: "mbrown@austincommercial.com",
    subject: "Invite to Bid – Parking Structure Concrete",
    text: "Please see attached. Scope of work: cast in place concrete. Bid due date 8/15. Plan room link also available.",
    attachments: [pdf("parking-concrete.pdf")],
  }),
  email({
    from: "estimating@gcpartners.com",
    subject: "RFQ — Roofing Replacement, Building C",
    text: "Request for quotation for roof replacement. Please provide a quote by 8/5. Bid documents attached.",
    attachments: [pdf("roofing-rfq.pdf")],
  }),
  email({
    from: "tnguyen@hoarconstruction.com",
    subject: "Bidding Opportunity: Medical Office Fitout — Low Voltage",
    text: "Trade partner, we have a bidding opportunity. Scope of work attached. Bids due 8/22. Pre-bid walkthrough 8/10.",
    attachments: [pdf("mob-lowvoltage.pdf")],
  }),
  email({
    from: "bids@ryancompanies.com",
    subject: "Call for Bids — Site Utilities, Phase 1",
    text: "Call for bids. Please review attached bid documents and submit your bid by the bid date.",
    attachments: [pdf("site-utilities.pdf")],
  }),
  email({
    from: "precon@alstonco.com",
    subject: "Invitation for Bid — Cold Storage Insulation",
    text: "Invitation for bid attached. Scope of work: insulation. Bid bond required. Bids due 9/12.",
    attachments: [pdf("cold-storage.pdf")],
  }),
  email({
    from: "estimating@turnerridge.com",
    subject: "ITB — Elementary School Masonry Package",
    text: "Attached bid documents for the masonry package. Prebid walkthrough next week. Bids due at 2pm on 8/30.",
    attachments: [pdf("masonry-itb.pdf"), xlsx("bid-form.xlsx")],
  }),
  email({
    from: "dlee@gcpartners.com",
    subject: "Bid Request: Glazing and Curtainwall",
    text: "Bid request attached. Please provide a quote for glazing. Drawings and specifications included. Bid due 9/5.",
    attachments: [pdf("glazing.pdf")],
  }),
  email({
    from: "estimating@austincommercial.com",
    subject: "Invitation to Bid - Demolition Package - Old Terminal",
    text: "You are invited to bid the demolition package. Scope of work attached. Job walk required. Bids due 8/18.",
    attachments: [pdf("demo-package.pdf")],
  }),
];

/**
 * Non-solicitations. Every one of these must be rejected — several are
 * from real GC domains, carry PDFs, and use the word "bid".
 */
export const NON_ITB_EMAILS: InboundEmail[] = [
  // --- money: invoices, payment apps, lien waivers (GC domains + PDFs) ---
  email({
    from: "ap@turnerridge.com",
    subject: "Invoice 44821 — Northside Elementary",
    text: "Please find attached invoice 44821 for work completed. Payment due in 30 days.",
    attachments: [pdf("invoice-44821.pdf")],
  }),
  email({
    from: "accounting@austincommercial.com",
    subject: "Payment Application #6 — DFW Concourse",
    text: "Attached is payment application 6 (AIA G702) for your review and signature.",
    attachments: [pdf("payapp-6.pdf")],
  }),
  email({
    from: "ap@hoarconstruction.com",
    subject: "Remittance advice — payment received",
    text: "Remittance advice attached. Payment received and processed for invoice 3321.",
    attachments: [pdf("remittance.pdf")],
  }),
  email({
    from: "billing@ryancompanies.com",
    subject: "Statement of account — July",
    text: "Your statement of account is attached. Past due balance shown.",
    attachments: [pdf("statement-july.pdf")],
  }),
  email({
    from: "contracts@turnerridge.com",
    subject: "Lien waiver required for payment — Northside",
    text: "Please sign and return the attached lien waiver so we can release payment.",
    attachments: [pdf("lien-waiver.pdf")],
  }),
  email({
    from: "ap@gcpartners.com",
    subject: "Pay app rejected — resubmit",
    text: "Your pay app was rejected. Please resubmit with updated backup.",
    attachments: [pdf("payapp-rejection.pdf")],
  }),
  // --- award / results: mentions bids heavily, but the bid is over ---
  email({
    from: "estimating@austincommercial.com",
    subject: "Bid results — Concourse D Structural Steel",
    text: "Bid results are attached. Thank you for your bid on the scope of work. The project was awarded.",
    attachments: [pdf("bid-results.pdf")],
  }),
  email({
    from: "precon@alstonco.com",
    subject: "Award notice — Warehouse Slab",
    text: "Award notice attached. We regret to inform you that your bid was not selected for this scope of work.",
    attachments: [pdf("award-notice.pdf")],
  }),
  email({
    from: "bids@ryancompanies.com",
    subject: "Thank you for your bid — Water Treatment",
    text: "We regret to inform you that another subcontractor was selected. Bid results attached.",
    attachments: [pdf("results.pdf")],
  }),
  // --- automated / notifications ---
  email({
    from: "no-reply@planroom.com",
    subject: "New plans available in the plan room",
    text: "Plans and specs have been posted to the plan room for a project you follow. Click to view. Unsubscribe from this list.",
    attachments: [],
  }),
  email({
    from: "notifications@procore.com",
    subject: "You have 3 new documents on Northside Elementary",
    text: "Documents were added. Scope of work drawings updated. Manage your preferences.",
    attachments: [],
  }),
  email({
    from: "noreply@buildingconnected.com",
    subject: "Invitation to Bid — Weekly digest",
    text: "Here is your weekly digest of bidding opportunities. Unsubscribe from this list to stop receiving these.",
    attachments: [],
  }),
  email({
    from: "mailer-daemon@googlemail.com",
    subject: "Delivery Status Notification (Failure)",
    text: "Undeliverable: your message to estimating@turnerridge.com could not be delivered.",
    attachments: [],
  }),
  email({
    from: "postmaster@outlook.com",
    subject: "Undeliverable: Invitation to Bid — Northside",
    text: "Mail delivery failed. The recipient mailbox is full.",
    attachments: [pdf("original-message.pdf")],
  }),
  email({
    from: "malvarez@turnerridge.com",
    subject: "Automatic reply: Bid question",
    text: "Out of office. I am away until Monday and will respond to your bid question then.",
    attachments: [],
  }),
  email({
    from: "calendar-notification@google.com",
    subject: "Invitation: Pre-bid walkthrough @ Fri Jul 29",
    text: "You have been invited to a meeting. Pre-bid walkthrough at the site. Calendar invite attached.",
    attachments: [],
  }),
  email({
    from: "no-reply@zoom.us",
    subject: "Meeting invitation: Prebid conference",
    text: "Has invited you to a meeting. Join Zoom meeting for the prebid conference.",
    attachments: [],
  }),
  // --- marketing / newsletters ---
  email({
    from: "newsletter@constructiondive.com",
    subject: "Bidding opportunities heat up in Q3",
    text: "This week in construction: bidding opportunities, scope of work trends. Unsubscribe. Manage your preferences.",
    attachments: [],
  }),
  email({
    from: "marketing@toolsupplier.com",
    subject: "Save 20% on conduit benders this month",
    text: "Special offer for contractors. You are receiving this because you subscribed. Unsubscribe.",
    attachments: [pdf("catalog.pdf")],
  }),
  email({
    from: "events@agc.org",
    subject: "Webinar: How to win more bids in 2026",
    text: "Join our webinar on bidding strategy. Register now. Unsubscribe from this list.",
    attachments: [],
  }),
  email({
    from: "marketing@planhub.com",
    subject: "Your free trial of PlanHub bid management",
    text: "Find bidding opportunities near you. Marketing message. Unsubscribe.",
    attachments: [],
  }),
  // --- account / security ---
  email({
    from: "no-reply@accounts.google.com",
    subject: "Security alert for your account",
    text: "A new sign-in. If this was not you, secure your account. Two-factor recommended.",
    attachments: [],
  }),
  email({
    from: "support@quickbooks.com",
    subject: "Password reset requested",
    text: "Click here to reset your password. Verify your email address.",
    attachments: [],
  }),
  email({
    from: "no-reply@dropbox.com",
    subject: "Someone shared 'Northside Plans' with you",
    text: "A folder with drawings and specifications was shared with you. View files.",
    attachments: [],
  }),
  // --- commerce ---
  email({
    from: "orders@grainger.com",
    subject: "Your order has shipped",
    text: "Shipping confirmation. Tracking number 1Z999. Your order of EMT conduit is on the way.",
    attachments: [pdf("packing-slip.pdf")],
  }),
  email({
    from: "receipts@homedepot.com",
    subject: "Your receipt from Home Depot Pro",
    text: "Receipt attached for your purchase.",
    attachments: [pdf("receipt.pdf")],
  }),
  // --- ordinary project correspondence from real GCs (the hardest cases) ---
  email({
    from: "malvarez@turnerridge.com",
    subject: "RFI response — Northside Elementary",
    text: "See attached response to RFI 12 regarding the transformer location on the drawings.",
    attachments: [pdf("rfi-12-response.pdf")],
  }),
  email({
    from: "pm@turnerridge.com",
    subject: "Addendum 2 — Northside Elementary",
    text: "Addendum 2 attached for the project you are already contracted on. Please review the revised drawings.",
    attachments: [pdf("addendum-2.pdf")],
  }),
  email({
    from: "super@austincommercial.com",
    subject: "Schedule update — steel erection pushed to Monday",
    text: "The schedule has shifted. Steel erection now starts Monday. See attached updated schedule.",
    attachments: [pdf("schedule.pdf")],
  }),
  email({
    from: "safety@hoarconstruction.com",
    subject: "Site safety orientation required before mobilization",
    text: "All trade partners must complete safety orientation. See attached site requirements.",
    attachments: [pdf("safety-orientation.pdf")],
  }),
  email({
    from: "contracts@ryancompanies.com",
    subject: "Executed subcontract — Water Treatment Phase 2",
    text: "Attached is the fully executed subcontract for the scope of work you were awarded.",
    attachments: [pdf("subcontract.pdf")],
  }),
  email({
    from: "pm@gcpartners.com",
    subject: "Punch list — Building C roofing",
    text: "Punch list attached. Please schedule the corrections.",
    attachments: [pdf("punchlist.pdf")],
  }),
  email({
    from: "coi@turnerridge.com",
    subject: "Certificate of insurance renewal needed",
    text: "Your certificate of insurance renewal is required to remain compliant on site.",
    attachments: [pdf("coi-request.pdf")],
  }),
  email({
    from: "jsmith@hoarconstruction.com",
    subject: "Quick question about your crew size",
    text: "How many electricians can you field next month? Thanks.",
    attachments: [],
  }),
  email({
    from: "malvarez@turnerridge.com",
    subject: "Re: Bid question — conduit spec",
    text: "Answering your question: use EMT throughout. No attachment needed.",
    attachments: [],
  }),
  email({
    from: "pm@austincommercial.com",
    subject: "Change order 4 for signature",
    text: "Change order 4 attached. Please sign and return.",
    attachments: [pdf("co-4.pdf")],
  }),
  // --- internal / personal ---
  email({
    from: "wife@example.com",
    subject: "Dinner tonight?",
    text: "Are you home by 6?",
    attachments: [],
  }),
  email({
    from: "payroll@fotielectric.com",
    subject: "Payroll processed for period ending 7/15",
    text: "Payroll has been processed. Statement attached.",
    attachments: [pdf("payroll.pdf")],
  }),
  email({
    from: "hr@fotielectric.com",
    subject: "Open enrollment starts Monday",
    text: "Benefits open enrollment. Review the attached plan documents.",
    attachments: [pdf("benefits.pdf")],
  }),
  email({
    from: "apprentice@fotielectric.com",
    subject: "Timesheet for approval",
    text: "My timesheet is attached for approval.",
    attachments: [xlsx("timesheet.xlsx")],
  }),
  // --- supplier quotes (we are the buyer, not the bidder) ---
  email({
    from: "sales@electricalsupply.com",
    subject: "Your quote for LED troffers",
    text: "Attached is our quote for the LED troffers you requested. Pricing valid 30 days.",
    attachments: [pdf("supplier-quote.pdf")],
  }),
  email({
    from: "quotes@wireandcable.com",
    subject: "Quotation #8871 — THHN copper wire",
    text: "Please find our quotation attached for the copper wire.",
    attachments: [pdf("quote-8871.pdf")],
  }),
  // --- misc no-attachment noise ---
  email({ from: "linkedin@e.linkedin.com", subject: "You appeared in 9 searches this week", text: "See who's viewing your profile. Unsubscribe." }),
  email({ from: "no-reply@indeed.com", subject: "New electrician jobs near you", text: "Jobs matching your search. Unsubscribe." }),
  email({ from: "info@chamber.org", subject: "Chamber of commerce mixer", text: "Join us for networking. Unsubscribe from this list." }),
  email({ from: "no-reply@fuelcard.com", subject: "Your fuel statement is ready", text: "Statement of account available. Past due balance $0." }),
  email({ from: "alerts@bank.com", subject: "Large transaction alert", text: "A transaction over $5,000 posted to your account. Security alert." }),
  email({ from: "no-reply@docusign.net", subject: "Completed: Subcontract agreement", text: "All parties have completed the document." }),
  email({ from: "team@slack.com", subject: "New message in #estimating", text: "You have unread messages. Manage your preferences." }),
  email({ from: "noreply@github.com", subject: "Security alert: vulnerable dependency", text: "A vulnerability was found. Security alert." }),
  email({ from: "sales@cat.com", subject: "Equipment rental specials", text: "Rent a lift this month. Unsubscribe." }),
  email({ from: "no-reply@osha.gov", subject: "Newsletter: Safety standards update", text: "Newsletter. Unsubscribe from this list." }),
  email({ from: "spam@lottery.example", subject: "You have won", text: "Claim your prize now. Unsubscribe." }),
  email({ from: "phish@example.com", subject: "Verify your email to continue", text: "Verify your email address immediately." }),
  email({ from: "no-reply@zoom.us", subject: "Your meeting recording is ready", text: "The recording of your meeting is available." }),
  email({ from: "billing@nylas.com", subject: "Your invoice is available", text: "Invoice attached for your subscription.", attachments: [pdf("nylas-invoice.pdf")] }),
  email({ from: "no-reply@stripe.com", subject: "Payment received", text: "You received a payment. Receipt attached.", attachments: [pdf("stripe-receipt.pdf")] }),
  email({ from: "support@procore.com", subject: "Your support ticket was updated", text: "Ticket 4421 updated. Manage your preferences." }),
  email({ from: "no-reply@autodesk.com", subject: "Your subscription renews soon", text: "Your subscription will renew. Invoice will follow." }),
  email({ from: "newsletter@enr.com", subject: "ENR: Top contractors of 2026", text: "This week's rankings. Unsubscribe." }),
  email({ from: "no-reply@ups.com", subject: "Package delivered", text: "Your order was delivered. Tracking number 1Z998." }),
  email({ from: "hello@fotielectric.com", subject: "Website contact form submission", text: "A homeowner asked for a quote on a panel upgrade." }),
  email({ from: "no-reply@quickbooks.com", subject: "Invoice 992 is overdue", text: "Invoice past due. Please remit payment.", attachments: [pdf("inv-992.pdf")] }),
  email({ from: "training@nfpa.org", subject: "NEC code update seminar", text: "Register for the seminar. Unsubscribe." }),
  email({ from: "no-reply@indeed.com", subject: "Your job post expires soon", text: "Renew your job post. Manage your preferences." }),
  email({ from: "notifications@bluebeam.com", subject: "A session was shared with you", text: "Drawings and specifications shared in a Studio session." }),
  email({ from: "no-reply@fleetio.com", subject: "Vehicle maintenance due", text: "Van 3 is due for service." }),
  email({ from: "no-reply@adp.com", subject: "Tax documents available", text: "Your documents are ready. Statement attached.", attachments: [pdf("tax.pdf")] }),
  email({ from: "sales@toolsupplier.com", subject: "New catalog available", text: "Browse our catalog. Unsubscribe.", attachments: [pdf("catalog-2026.pdf")] }),
  email({ from: "no-reply@ring.com", subject: "Motion detected at the shop", text: "Your camera detected motion." }),
  email({ from: "no-reply@apple.com", subject: "Your receipt from Apple", text: "Receipt for your purchase.", attachments: [pdf("apple-receipt.pdf")] }),
  email({ from: "no-reply@verizon.com", subject: "Your bill is ready", text: "Statement of account ready. Invoice attached.", attachments: [pdf("verizon.pdf")] }),
  email({ from: "no-reply@dot.gov", subject: "DOT registration renewal", text: "Renew your registration. Past due." }),
  email({ from: "no-reply@insurance.com", subject: "Policy renewal notice", text: "Your certificate of insurance renewal is available.", attachments: [pdf("policy.pdf")] }),
  email({ from: "no-reply@statefarm.com", subject: "Auto policy documents", text: "Documents attached.", attachments: [pdf("auto-policy.pdf")] }),
  email({ from: "friend@example.com", subject: "Golf Saturday?", text: "You in?" }),
  email({ from: "school@example.edu", subject: "Parent-teacher conference", text: "Schedule your conference." }),
  email({ from: "no-reply@amazon.com", subject: "Your order of wire nuts", text: "Shipping confirmation. Tracking number attached." }),
  email({ from: "no-reply@yelp.com", subject: "You have a new review", text: "See your review. Manage your preferences." }),
  email({ from: "noreply@mailchimp.com", subject: "Campaign report ready", text: "Your campaign stats. Unsubscribe." }),
  email({ from: "no-reply@intuit.com", subject: "Time to file quarterly taxes", text: "Reminder to file. Statement of account." }),
  email({ from: "no-reply@godaddy.com", subject: "Domain renewal", text: "Your domain expires. Invoice attached.", attachments: [pdf("domain.pdf")] }),
  email({ from: "no-reply@fedex.com", subject: "Delivery exception", text: "Your order could not be delivered. Tracking number 7742." }),
  email({ from: "no-reply@sam.gov", subject: "Your SAM.gov registration expires", text: "Renew your entity registration to remain eligible." }),
  // A GC forwarding drawings mid-job: real sender, real PDF, no ask to bid.
  email({
    from: "pm@turnerridge.com",
    subject: "Latest drawings for the field",
    text: "Here are the current drawings and specifications for the crew. Scope of work unchanged.",
    attachments: [pdf("drawings-rev3.pdf")],
  }),
];

/** The full 100-email corpus. */
export const INBOX_CORPUS = [...ITB_EMAILS, ...NON_ITB_EMAILS];

/** GC domains this user has bid with before — a real signal from their history. */
export const KNOWN_GC_DOMAINS = [
  "turnerridge.com",
  "austincommercial.com",
  "ryancompanies.com",
  "hoarconstruction.com",
  "alstonco.com",
];
