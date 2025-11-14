// Script to clean up duplicate conversations
// Run with: node cleanup-duplicate-conversations.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupDuplicateConversations() {
  console.log('Starting cleanup of duplicate conversations...\n');

  try {
    // Get all conversations
    const allConversations = await prisma.conversation.findMany({
      include: {
        messages: true,
        field: true
      }
    });

    console.log(`Total conversations found: ${allConversations.length}\n`);

    // Group conversations by participant pairs
    const conversationGroups = new Map();

    for (const conversation of allConversations) {
      // Sort participants to create consistent key
      const sortedParticipants = [...conversation.participants].sort().join('-');

      if (!conversationGroups.has(sortedParticipants)) {
        conversationGroups.set(sortedParticipants, []);
      }

      conversationGroups.get(sortedParticipants).push(conversation);
    }

    // Find duplicate groups (groups with more than one conversation)
    let duplicatesFound = 0;
    let conversationsDeleted = 0;
    let messagesPreserved = 0;

    for (const [participantKey, conversations] of conversationGroups.entries()) {
      if (conversations.length > 1) {
        duplicatesFound++;
        console.log(`\n=== Duplicate Group ${duplicatesFound} ===`);
        console.log(`Participants: ${participantKey}`);
        console.log(`Number of duplicate conversations: ${conversations.length}`);

        // Sort by: 1) has messages, 2) most messages, 3) most recent
        const sortedConversations = conversations.sort((a, b) => {
          // Prioritize conversations with messages
          if (a.messages.length > 0 && b.messages.length === 0) return -1;
          if (b.messages.length > 0 && a.messages.length === 0) return 1;

          // Then by number of messages
          if (a.messages.length !== b.messages.length) {
            return b.messages.length - a.messages.length;
          }

          // Then by most recent lastMessageAt or updatedAt
          const aDate = a.lastMessageAt || a.updatedAt;
          const bDate = b.lastMessageAt || b.updatedAt;
          return new Date(bDate) - new Date(aDate);
        });

        // Keep the first one (best conversation)
        const keepConversation = sortedConversations[0];
        const deleteConversations = sortedConversations.slice(1);

        console.log(`\nKeeping conversation: ${keepConversation.id}`);
        console.log(`  - Messages: ${keepConversation.messages.length}`);
        console.log(`  - Last activity: ${keepConversation.lastMessageAt || keepConversation.updatedAt}`);
        console.log(`  - Field: ${keepConversation.fieldId || 'None'}`);

        // Migrate messages from conversations being deleted to the one we're keeping
        for (const deleteConv of deleteConversations) {
          console.log(`\nDeleting conversation: ${deleteConv.id}`);
          console.log(`  - Messages: ${deleteConv.messages.length}`);
          console.log(`  - Created: ${deleteConv.createdAt}`);

          if (deleteConv.messages.length > 0) {
            console.log(`  - Migrating ${deleteConv.messages.length} messages to kept conversation...`);

            // Update messages to point to the conversation we're keeping
            await prisma.message.updateMany({
              where: {
                conversationId: deleteConv.id
              },
              data: {
                conversationId: keepConversation.id
              }
            });

            messagesPreserved += deleteConv.messages.length;
          }

          // Delete the duplicate conversation
          await prisma.conversation.delete({
            where: {
              id: deleteConv.id
            }
          });

          conversationsDeleted++;
          console.log(`  ✓ Deleted`);
        }
      }
    }

    console.log('\n\n=== Cleanup Summary ===');
    console.log(`Duplicate groups found: ${duplicatesFound}`);
    console.log(`Conversations deleted: ${conversationsDeleted}`);
    console.log(`Messages preserved: ${messagesPreserved}`);
    console.log(`Remaining conversations: ${allConversations.length - conversationsDeleted}`);

    if (duplicatesFound === 0) {
      console.log('\n✨ No duplicate conversations found! Your database is clean.');
    } else {
      console.log('\n✨ Cleanup completed successfully!');
    }

  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupDuplicateConversations();
