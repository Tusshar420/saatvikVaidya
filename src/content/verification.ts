// Professional verification: the documents section of /account and the
// messages sent about uploads and decisions. Keep user-facing text here so
// Hindi can be added later.

import type { DocumentType } from "@/lib/verification";

export const verification = {
  documentTypes: {
    registration_certificate: {
      label: "Registration certificate",
      help: "Your Ayurveda practitioner registration from the state board or NCISM.",
    },
    clinic_registration: {
      label: "Clinic registration",
      help: "The registration certificate of your clinic or hospital.",
    },
    drug_licence: {
      label: "Drug licence",
      help: "Your retail or wholesale drug licence (Form 20/21 or equivalent).",
    },
    gst_certificate: {
      label: "GST certificate",
      help: "Your GST registration certificate (Form REG-06).",
    },
  } satisfies Record<DocumentType, { label: string; help: string }>,

  /** The status card on /account, by where the professional is in the flow. */
  state: {
    needed: {
      badge: "Documents needed",
      text: "Upload the documents below so our team can verify your account. Until then you see retail prices (MRP).",
    },
    review: {
      badge: "Pending review",
      text: "Thanks, your documents are with our team. We'll let you know once they're checked. Until then you see retail prices (MRP).",
    },
    approved: {
      badge: "Verified",
      text: "Our team has verified your documents. Professional prices are unlocked for your account.",
    },
    rejected: {
      badge: "Not approved",
      text: "We couldn't verify your documents. Please upload corrected documents below and we'll check them again.",
    },
  },
  submittedOn: (date: string) => `Submitted on ${date}`,
  reasonTitle: "Reason from our team",
  noReason: "No reason was given. Call us if you're not sure what to change.",
  reuploadPrompt: "Upload a corrected file for each document that needs it.",

  documentsTitle: "Your documents",
  documentsIntro: (maxSize: string) =>
    `PDF, JPG or PNG, up to ${maxSize} each. Only you and our verification team can see them.`,
  documentsLocked: "Your documents are verified. Call us if anything changes.",
  missing: "Not uploaded yet",
  uploadedOn: (date: string) => `Uploaded ${date}`,
  verifiedBadge: "Verified",
  view: "View",
  viewNamed: (label: string) => `View your ${label}`,
  choose: "Choose file",
  replace: "Replace file",
  /** Accessible name of the file picker: its visible text, then the document. */
  fileFor: (action: string, label: string) => `${action}: ${label}`,
  selected: "Ready to upload",
  upload: "Upload",
  uploadNamed: (label: string) => `Upload your ${label}`,
  uploading: "Uploading…",
  progressLabel: (label: string) => `Uploading your ${label}`,
  cancel: "Cancel",
  previewAlt: (label: string) => `Preview of your ${label}`,
  uploaded: (label: string) => `${label} uploaded.`,
  submitted: "All documents are in. Our team will review them soon.",

  errors: {
    tooLarge: (maxSize: string) =>
      `That file is too big. Please upload a file up to ${maxSize}.`,
    fileType: "Please upload a PDF, JPG or PNG file.",
    empty: "That file is empty. Please choose another.",
    locked: "Your account is already verified, so documents can't be changed.",
    notProfessional: "Your account type doesn't need documents.",
    documentType: "That document isn't needed for your account type.",
    rateLimited: "Too many uploads. Please wait a while and try again.",
    signedOut: "Your session has ended. Please sign in again.",
    failed: "The upload didn't finish. Please check your connection and try again.",
  },

  /** Emails and SMS sent through src/server/notify/verification.ts. */
  messages: {
    received: {
      subject: "We've received your document",
      heading: "We've received your document.",
      line: (document: string, complete: boolean) =>
        `Thank you. We've received your ${document}. ${
          complete
            ? "All your documents are in, and our team will review them soon. We'll email you as soon as it's done."
            : "Please upload the remaining documents from My account so we can start the review."
        }`,
      button: "Go to My account",
      sms: (document: string) =>
        `Saatvik Vaidya: we've received your ${document}. We'll let you know once it's reviewed.`,
    },
    adminUploaded: {
      subject: (name: string) => `Document uploaded by ${name}`,
      heading: (name: string) => `${name} uploaded a document`,
      line: (name: string, userType: string, document: string, complete: boolean) =>
        `${name} (${userType}) uploaded their ${document}.${
          complete ? " Their documents are complete and ready for review." : ""
        }`,
      button: "Review documents",
    },
    approved: {
      subject: "Your account is verified",
      heading: "Your account is verified!",
      line: "Our team has verified your documents. Professional prices are now unlocked for your account.",
      button: "Shop with professional prices",
      sms: "Saatvik Vaidya: your account is verified. Professional prices are now unlocked.",
    },
    rejected: {
      subject: "We couldn't verify your documents",
      heading: "We couldn't verify your documents.",
      reason: "Reason",
      line: "Please upload corrected documents from My account and we'll check them again.",
      button: "Upload documents",
      sms: "Saatvik Vaidya: we couldn't verify your documents. Please see My account to upload corrected ones.",
    },
  },
} as const;

export type VerificationState = keyof typeof verification.state;
