async function testApi() {
    const API_KEY = '579b464db66ec23bdd000001fe9d36968d1d4e8e62fee0cc92cefecd';
    const BASE_URL = 'https://api.data.gov.in/resource/9ef275ee-e289-487b-80a2-8c8d8dcb4545';
    const url = `${BASE_URL}?api-key=${API_KEY}&format=json&limit=5`;

    console.log(`Testing URL: ${url}`);

    try {
        const response = await fetch(url);
        console.log(`Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const text = await response.text();
            console.log(`Error Response: ${text}`);
            return;
        }

        const data = await response.json();
        console.log(`Total records: ${data.total}`);
        console.log(`Count: ${data.count}`);

        if (data.records && data.records.length > 0) {
            console.log(`Records length: ${data.records.length}`);
            console.log('Sample record summary:', data.records[0].commodity, 'at', data.records[0].market);
        } else {
            console.log('Records is empty or undefined:', data.records);
            console.log('Full JSON:', JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error('Fetch Exception:', err.message);
    }
}

testApi();
