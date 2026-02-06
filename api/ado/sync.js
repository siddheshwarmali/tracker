// d:\My Project\track-main (12)\track-main\api\ado\sync.js

const { json, readBody } = require('../_lib/http');
const { getSession } = require('../_lib/cookie');

function normalizeOrg(org){
  if(!org) return '';
  org = String(org).trim();
  org = org.replace(/^https?:\/\//i,'');
  org = org.replace(/^dev\.azure\.com\//i,'');
  org = org.replace(/\/$/,'');
  return org;
}

function authHeaderFromPat(pat){
  const token = Buffer.from(':'+String(pat||''),'utf8').toString('base64');
  return 'Basic '+token;
}

module.exports = async (req, res) => {
  try {
    // Basic auth check for the app session
    const s = getSession(req);
    if(!s) return json(res, 401, { error: 'Not authenticated' });
    
    if(req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

    const body = await readBody(req);
    const { org, project, pat, queryId } = body;

    if(!org || !project || !pat || !queryId) {
      return json(res, 400, { error: 'Missing required fields (org, project, pat, queryId)' });
    }

    const cleanOrg = normalizeOrg(org);
    const baseUrl = `https://dev.azure.com/${cleanOrg}/${encodeURIComponent(project)}/_apis`;
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': authHeaderFromPat(pat)
    };

    // 1. Get WIQL
    const qUrl = `${baseUrl}/wit/queries/${encodeURIComponent(queryId)}?$expand=wiql&api-version=6.0`;
    const qResp = await fetch(qUrl, { method: 'GET', headers });
    if(!qResp.ok) {
      const txt = await qResp.text();
      return json(res, qResp.status, { error: `Query fetch failed: ${txt}` });
    }
    const qJson = await qResp.json();
    const wiql = qJson.wiql;

    // 2. Execute Query
    const wiqlUrl = `${baseUrl}/wit/wiql?api-version=6.0`;
    const wiqlResp = await fetch(wiqlUrl, { method: 'POST', headers, body: JSON.stringify({ query: wiql }) });
    if(!wiqlResp.ok) {
      const txt = await wiqlResp.text();
      return json(res, wiqlResp.status, { error: `WIQL execution failed: ${txt}` });
    }
    const wiqlJson = await wiqlResp.json();
    
    // Handle both Flat List (workItems) and Tree/Direct Links (workItemRelations)
    let ids = [];
    if (wiqlJson.workItems) {
      ids = wiqlJson.workItems.map(wi => wi.id);
    } else if (wiqlJson.workItemRelations) {
      ids = wiqlJson.workItemRelations.map(wi => wi.target ? wi.target.id : wi.id).filter(id => id);
    }
    
    // Deduplicate IDs
    ids = [...new Set(ids)];

    if (ids.length === 0) {
      return json(res, 200, { value: [] });
    }

    // 3. Batch Get Details (Chunking to bypass 200 limit)
    const chunks = [];
    for (let i = 0; i < ids.length; i += 200) {
      chunks.push(ids.slice(i, i + 200));
    }

    let allItems = [];
    for (const chunk of chunks) {
      const batchUrl = `${baseUrl}/wit/workitemsbatch?api-version=6.0`;
      const batchResp = await fetch(batchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ids: chunk })
      });
      if(!batchResp.ok) {
        console.error('Batch fetch failed', await batchResp.text());
        continue; 
      }
      const batchJson = await batchResp.json();
      if(batchJson.value) allItems = allItems.concat(batchJson.value);
    }

    return json(res, 200, { value: allItems });

  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || String(e) });
  }
};
