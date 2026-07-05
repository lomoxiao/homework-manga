const HOMEWORK_ALLOWED_MIME_ = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const HOMEWORK_MAX_BYTES_ = 5 * 1024 * 1024;

function createHomeworkUpload_(input) {
  const user = verifyFirebaseUser_(input.idToken);
  const properties = PropertiesService.getScriptProperties();
  const ownerUid = requireProperty_(properties, 'HOMEWORK_OWNER_UID');
  if (user.localId !== ownerUid) throw new Error('This account is not allowed.');

  const mime = String(input.contentType || '').toLowerCase();
  if (HOMEWORK_ALLOWED_MIME_.indexOf(mime) < 0) throw new Error('Unsupported image type.');
  const encoded = String(input.base64 || '');
  const bytes = Utilities.base64Decode(encoded);
  if (!bytes.length || bytes.length > HOMEWORK_MAX_BYTES_) throw new Error('Image must be 5MB or less.');
  const decodedSha256 = sha256Hex_(bytes);

  const jobId = 'homework-' + Utilities.getUuid().replace(/-/g, '');
  const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : (mime === 'image/heic' || mime === 'image/heif') ? 'heic' : 'jpg';
  const folder = DriveApp.getFolderById(requireProperty_(properties, 'HOMEWORK_DRIVE_FOLDER_ID'));
  const blob = Utilities.newBlob(bytes, mime, jobId + '.' + extension);
  const blobBytes = blob.getBytes();
  const blobSha256 = sha256Hex_(blobBytes);
  logHomeworkUploadDiagnostic_({
    stage: 'blob_created',
    jobId: jobId,
    base64Length: encoded.length,
    decodedByteLength: bytes.length,
    decodedSha256: decodedSha256,
    blobByteLength: blobBytes.length,
    blobSha256: blobSha256
  });

  const file = folder.createFile(blob);
  const reloadedFile = DriveApp.getFileById(file.getId());
  const reloadedBytes = reloadedFile.getBlob().getBytes();
  logHomeworkUploadDiagnostic_({
    stage: 'drive_reloaded',
    jobId: jobId,
    base64Length: encoded.length,
    decodedByteLength: bytes.length,
    decodedSha256: decodedSha256,
    blobByteLength: blobBytes.length,
    blobSha256: blobSha256,
    createdFileId: file.getId(),
    createdFileSize: file.getSize(),
    reloadedBlobSize: reloadedBytes.length,
    reloadedSha256: sha256Hex_(reloadedBytes)
  });
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    file.setDescription(JSON.stringify({ workflow: 'homework-manga', jobId: jobId, ownerUid: ownerUid }));
    const sourceImage = driveSource_(file, mime, bytes.length);
    const now = new Date().toISOString();
    const job = {
      id: jobId, ownerUid: ownerUid, status: 'queued', stage: 'queued',
      trigger: { provider: 'web', requestedBy: ownerUid }, sourceImage: sourceImage,
      createdAt: now, updatedAt: now
    };
    firebaseRequest_('/homeworkJobs/' + encodeURIComponent(jobId), 'put', job, input.idToken);
    const slackTs = postHomeworkTrigger_(jobId);
    firebaseRequest_('/homeworkJobs/' + encodeURIComponent(jobId), 'patch', {
      trigger: { provider: 'web', requestedBy: ownerUid, slackTriggerSentAt: new Date().toISOString() },
      updatedAt: new Date().toISOString()
    }, input.idToken);
    return { jobId: jobId, slackTs: slackTs };
  } catch (error) {
    try { file.setTrashed(true); } catch (_) {}
    throw error;
  }
}

