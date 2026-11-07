const mechanics = require("../repositories/mechanicsRepository");
const { AppError, ForbiddenError, NotFoundError, ValidationError } = require("../domain/errors");

// PRODUCTION NOTE (carried over from the old routes/mechanics.js): storing
// uploaded document bytes as base64 directly in SQLite is an interim step
// to make upload work end-to-end without real object-storage credentials
// in this sandbox. Swap for S3-compatible storage (per the Phase 1 build
// spec's own "Path to Production" table) before real users upload real
// verification documents.
const MAX_DOCUMENT_BASE64_LENGTH = 8 * 1024 * 1024; // ~6MB decoded

function register(user, verificationDocsUrl) {
  if (user.role !== "mechanic") {
    throw new ForbiddenError("Only mechanic accounts can register as a mechanic");
  }
  const mechanic = mechanics.create(user.id, verificationDocsUrl);
  return {
    ...mechanic,
    note: "Awaiting manual verification per Phase 1 build spec (vetting is manual, not automated).",
  };
}

function getMyProfile(user) {
  const mechanic = mechanics.findByUserId(user.id);
  if (!mechanic) throw new NotFoundError("Not registered as a mechanic yet");

  const documents = mechanics.listDocuments(mechanic.id);
  return { ...mechanic, ...mechanics.ratingSummary(mechanic.id), documents };
}

function uploadDocument(user, { filename, mime_type, content_base64 }) {
  const mechanic = mechanics.findByUserId(user.id);
  if (!mechanic) throw new NotFoundError("Not registered as a mechanic yet");

  if (!filename || !mime_type || !content_base64) {
    throw new ValidationError("filename, mime_type, and content_base64 are required");
  }
  if (content_base64.length > MAX_DOCUMENT_BASE64_LENGTH) {
    // Note: the old code returned 413 here specifically (distinct from the
    // generic ValidationError's 400) — preserved via a raw AppError rather
    // than ValidationError, since 413 isn't a 400.
    throw new AppError(413, "File too large");
  }

  const docId = mechanics.insertDocument({ mechanicId: mechanic.id, filename, mimeType: mime_type, contentBase64: content_base64 });
  return { id: docId, filename, mime_type, uploaded_at: new Date().toISOString() };
}

module.exports = { register, getMyProfile, uploadDocument, MAX_DOCUMENT_BASE64_LENGTH };
