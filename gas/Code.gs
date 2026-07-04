function doGet(e) { return handleApiRequest_(e, 'GET'); }
function doPost(e) { return handleApiRequest_(e, 'POST'); }

function handleApiRequest_(e, method) {
  try {
    const request = parseApiRequest_(e, method);
    return jsonResponse_({ ok: true, data: dispatchApiAction_(request) });
  } catch (error) {
    return jsonResponse_({ ok: false, error: { message: error && error.message ? error.message : String(error) } });
  }
}

function parseApiRequest_(e, method) {
  const params = (e && e.parameter) || {};
  let body = {};
  if (method === 'POST' && e && e.postData && e.postData.contents) body = JSON.parse(e.postData.contents);
  return { action: String(body.action || params.action || ''), body: body, params: params };
}

function dispatchApiAction_(request) {
  if (request.action === 'homeworkUpload') return createHomeworkUpload_(request.body);
  if (request.action === 'homeworkRetry') return retryHomework_(request.body);
  throw new Error('Unsupported action.');
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
