const fetch = require('node-fetch');

async function testStripeLinkType() {
  console.log('🧪 Testing Stripe Account Link Type Generation...\n');
  
  const API_URL = 'http://localhost:5000/api';
  // Replace with a valid field owner token
  const authToken = 'YOUR_FIELD_OWNER_TOKEN'; 
  
  try {
    // First, check account status
    console.log('📊 Checking account status...');
    const statusResponse = await fetch(`${API_URL}/stripe-connect/account-status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const accountStatus = await statusResponse.json();
    console.log('Account Status:', {
      hasAccount: accountStatus.data?.hasAccount,
      detailsSubmitted: accountStatus.data?.detailsSubmitted,
      payoutsEnabled: accountStatus.data?.payoutsEnabled,
      hasCriticalRequirements: accountStatus.data?.hasCriticalRequirements,
      hasEventualRequirements: accountStatus.data?.hasEventualRequirements
    });
    
    // Test getting onboarding link with updateMode
    console.log('\n🔗 Testing onboarding link generation with updateMode...');
    
    const linkResponse = await fetch(`${API_URL}/stripe-connect/onboarding-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        updateMode: true // This should trigger account_update type
      })
    });
    
    const linkData = await linkResponse.json();
    console.log('Link Response:', {
      success: linkData.success,
      linkType: linkData.data?.type,
      url: linkData.data?.url ? '✅ URL generated' : '❌ No URL'
    });
    
    // Verify the link type
    if (linkData.data?.type === 'account_update') {
      console.log('\n✅ SUCCESS: Account update link type is correctly set!');
      console.log('   This should show forms for eventually due requirements.');
    } else if (linkData.data?.type === 'account_onboarding') {
      console.log('\n⚠️  WARNING: Account onboarding link type is being used.');
      console.log('   This might not show the proper forms for document submission.');
    }
    
    if (linkData.data?.url) {
      console.log('\n📋 Generated Stripe Link:');
      console.log(linkData.data.url);
      console.log('\nYou can open this link in a browser to test the Stripe forms.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Make sure you have a valid field owner auth token.');
    console.error('   To get a token, log in as a field owner and check the browser console or local storage.');
  }
}

// Instructions
console.log('📝 Instructions:');
console.log('1. Log in as a field owner on the frontend');
console.log('2. Open browser console and run: localStorage.getItem("token")');
console.log('3. Copy the token and replace YOUR_FIELD_OWNER_TOKEN above');
console.log('4. Run this script again\n');

testStripeLinkType();