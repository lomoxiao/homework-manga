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

function retryHomework_(input) {
  const user = verifyFirebaseUser_(input.idToken);
  const jobId = String(input.jobId || '');
  if (!/^homework-[A-Za-z0-9_-]+$/.test(jobId)) throw new Error('Invalid job ID.');
  const job = firebaseRequest_('/homeworkJobs/' + encodeURIComponent(jobId), 'get', null, input.idToken);
  if (!job || job.ownerUid !== user.localId || job.trigger.provider !== 'web') throw new Error('Job not found.');
  if (['analyzing', 'validating', 'review_required', 'completed', 'deleting'].indexOf(job.status) >= 0) throw new Error('This job cannot be retried now.');
  firebaseRequest_('/homeworkJobs/' + encodeURIComponent(jobId), 'patch', {
    status: 'queued', stage: 'queued', error: null, updatedAt: new Date().toISOString()
  }, input.idToken);
  return { jobId: jobId, slackTs: postHomeworkTrigger_(jobId) };
}

function verifyFirebaseUser_(idToken) {
  if (!idToken) throw new Error('Login is required.');
  const key = requireProperty_(PropertiesService.getScriptProperties(), 'FIREBASE_WEB_API_KEY');
  const response = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(key), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true
  });
  const body = JSON.parse(response.getContentText() || '{}');
  if (response.getResponseCode() !== 200 || !body.users || !body.users[0]) throw new Error('Invalid login token.');
  return body.users[0];
}

function firebaseRequest_(path, method, payload, idToken) {
  const base = requireProperty_(PropertiesService.getScriptProperties(), 'FIREBASE_DATABASE_URL').replace(/\/$/, '');
  const options = { method: method, contentType: 'application/json', muteHttpExceptions: true };
  if (payload !== null) options.payload = JSON.stringify(payload);
  const response = UrlFetchApp.fetch(base + path + '.json?auth=' + encodeURIComponent(idToken), options);
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error('Firebase request failed: ' + response.getContentText());
  return JSON.parse(response.getContentText() || 'null');
}

function postHomeworkTrigger_(jobId) {
  const properties = PropertiesService.getScriptProperties();
  const response = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + requireProperty_(properties, 'SLACK_BOT_TOKEN') },
    payload: JSON.stringify({ channel: requireProperty_(properties, 'SLACK_HOMEWORK_CHANNEL_ID'), text: '[homework-web] ' + jobId }),
    muteHttpExceptions: true
  });
  const body = JSON.parse(response.getContentText() || '{}');
  if (!body.ok) throw new Error('Slack trigger failed: ' + (body.error || response.getResponseCode()));
  return body.ts;
}

function driveSource_(file, contentType, size) {
  const id = file.getId();
  return { provider: 'google_drive', fileId: id, contentType: contentType, size: size,
    viewUrl: 'https://drive.google.com/file/d/' + id + '/view',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + id };
}

function requireProperty_(properties, name) {
  const value = properties.getProperty(name);
  if (!value) throw new Error(name + ' is not set.');
  return value;
}


function sha256Hex_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)
    .map(function(value) { return ('0' + ((value + 256) % 256).toString(16)).slice(-2); })
    .join('');
}

function logHomeworkUploadDiagnostic_(diagnostic) {
  console.log('[homework-upload-diagnostic] ' + JSON.stringify(diagnostic));
}
