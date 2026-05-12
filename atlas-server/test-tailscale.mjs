async function testConnectivity() {
  // Try directly using dev-jegs.buru-degree.ts.net
  // Also try 100.120.169.123
  
  const baseUrl = 'http://dev-jegs.buru-degree.ts.net:5002/api';
  const alternativeBaseUrl = 'http://100.120.169.123:5002/api'; // From the env file

  console.log(`Testing connection to ${baseUrl}...`);
  try {
    const res = await fetch(`${baseUrl}/health`, { timeout: 5000 }).catch(() => null);
    if (res) console.log(`[Health] Success: ${res.status}`);
    else console.log(`[Health] Failed or no route.`);
    
    // Testing ATLAS integration endpoints
    const sectionsUrl = `${baseUrl}/integration/v1/sections?schoolId=1&schoolYearId=29`;
    console.log(`\nFetching ${sectionsUrl}...`);
    const sectionsRes = await fetch(sectionsUrl);
    console.log(`Status: ${sectionsRes.status}`);
    if (sectionsRes.ok) {
      const data = await sectionsRes.json();
      console.log(`Sections retrieved: ${Array.isArray(data) ? data.length : data?.data?.length || 'Unknown'} records.`);
    } else {
      console.log(`Error: ${await sectionsRes.text()}`);
    }

    const facultyUrl = `${baseUrl}/integration/v1/faculty?schoolId=1&schoolYearId=29`;
    console.log(`\nFetching ${facultyUrl}...`);
    const facultyRes = await fetch(facultyUrl);
    console.log(`Status: ${facultyRes.status}`);
    if (facultyRes.ok) {
      const data = await facultyRes.json();
      console.log(`Faculty retrieved: ${Array.isArray(data) ? data.length : data?.data?.length || 'Unknown'} records.`);
    } else {
      console.log(`Error: ${await facultyRes.text()}`);
    }

  } catch (error) {
    console.error(`Error connecting to ${baseUrl}:`, error.message);
  }
}

testConnectivity();
