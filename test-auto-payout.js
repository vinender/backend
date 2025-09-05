/**
 * Test script for automatic payout processing
 * This script tests the automatic payout system that processes payouts after the cancellation window
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5001/api';

// Admin token (you'll need to replace this with a valid admin token)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'your-admin-token-here';

async function testAutomaticPayout() {
  try {
    console.log('🚀 Testing Automatic Payout System');
    console.log('=====================================\n');

    // 1. Get payout summary for a field owner
    console.log('📊 Getting payout summary for field owner...');
    try {
      const summaryResponse = await axios.get(
        `${API_URL}/auto-payouts/summary`,
        {
          headers: {
            'Authorization': `Bearer ${ADMIN_TOKEN}`
          }
        }
      );

      console.log('✅ Payout Summary:');
      console.log(JSON.stringify(summaryResponse.data, null, 2));
      console.log('\n');
    } catch (error) {
      console.log('❌ Failed to get payout summary:', error.response?.data || error.message);
    }

    // 2. Trigger manual payout processing (Admin only)
    console.log('🔄 Triggering manual payout processing...');
    try {
      const triggerResponse = await axios.post(
        `${API_URL}/auto-payouts/trigger`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${ADMIN_TOKEN}`
          }
        }
      );

      console.log('✅ Payout Processing Results:');
      console.log(JSON.stringify(triggerResponse.data, null, 2));
      
      const { processed, skipped, failed, details } = triggerResponse.data.data;
      
      console.log('\n📈 Summary:');
      console.log(`  - Processed: ${processed} bookings`);
      console.log(`  - Skipped: ${skipped} bookings`);
      console.log(`  - Failed: ${failed} bookings`);
      
      if (details && details.length > 0) {
        console.log('\n📋 Details:');
        details.forEach(detail => {
          if (detail.status === 'processed') {
            console.log(`  ✅ Booking ${detail.bookingId}: £${detail.amount} processed (Payout ID: ${detail.payoutId})`);
          } else if (detail.status === 'skipped') {
            console.log(`  ⏭️ Booking ${detail.bookingId}: Skipped (${detail.reason})`);
          } else if (detail.status === 'failed') {
            console.log(`  ❌ Booking ${detail.bookingId}: Failed (${detail.error})`);
          }
        });
      }
    } catch (error) {
      console.log('❌ Failed to trigger payout processing:', error.response?.data || error.message);
    }

    // 3. Test processing a specific booking (if you have a booking ID)
    const testBookingId = process.env.TEST_BOOKING_ID;
    if (testBookingId) {
      console.log(`\n💰 Processing specific booking: ${testBookingId}`);
      try {
        const bookingPayoutResponse = await axios.post(
          `${API_URL}/auto-payouts/process/${testBookingId}`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
          }
        );

        console.log('✅ Booking Payout Result:');
        console.log(JSON.stringify(bookingPayoutResponse.data, null, 2));
      } catch (error) {
        console.log('❌ Failed to process booking payout:', error.response?.data || error.message);
      }
    }

    console.log('\n=====================================');
    console.log('✨ Test completed!');
    console.log('\n💡 Notes:');
    console.log('- Automatic payouts are processed hourly for bookings past the 24-hour cancellation window');
    console.log('- Field owners must have a complete Stripe Connect account to receive payouts');
    console.log('- Refunds will automatically deduct the Stripe fee from the field owner\'s account');
    console.log('- The system generates invoices for each payout with full transaction details');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the test
testAutomaticPayout();