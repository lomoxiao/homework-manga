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

  const jobId = 'homework-' + Utilities.getUuid().replace(/-/g, '');
  const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : (mime === 'image/heic' || mime === 'image/heif') ? 'heic' : 'jpg';
  const folder = DriveApp.getFolderById(requireProperty_(properties, 'HOMEWORK_DRIVE_FOLDER_ID'));
  const blob = Utilities.newBlob(bytes, mime, jobId + '.' + extension);
  const file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    file.setDescription(JSON.stringify({ workflow: 'homework-manga', jobId: jobId, ownerUid: ownerUid }));
    const sourceImage = driveSource_(file, mime, bytes.length);
    const now = new Date().toISOString();
    // v3: worker は /homeworkJobsV3 の queueKey を直接購読するため Slack トリガー投稿は不要。
    // phase×runState の直交2軸 + 導出 queueKey(homework-manga packages/contracts/src/homeworkJob.ts と同一契約)。
    const job = {
      id: jobId, ownerUid: ownerUid,
      phase: 'analyzing', runState: 'queued', queueKey: 'analyzing:queued',
      sourceImage: sourceImage,
      createdAt: now, updatedAt: now
    };
    firebaseRequest_('/homeworkJobsV3/' + encodeURIComponent(jobId), 'put', job, input.idToken);
    return { jobId: jobId };
  } catch (error) {
    try { file.setTrashed(true); } catch (_) {}
    throw error;
  }
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
