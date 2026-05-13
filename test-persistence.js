/**
 * Test: Session & Message Persistence
 * Verifies that sessions and messages persist across SessionManager instances
 */

const { SessionManager } = require('./dist/worker/sessionManager');
const path = require('path');
const fs = require('fs');

// Use a temporary test directory
const TEST_DIR = path.join(__dirname, '.test-sessions');

// Clean up test directory
function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

// Wait for async writes
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPersistence() {
  console.log('=== Session & Message Persistence Test ===\n');

  cleanup();

  // Phase 1: Create session and add messages
  console.log('Phase 1: Creating session and adding messages...');
  const mgr1 = new SessionManager(TEST_DIR);

  const session = mgr1.createSession('/test/project', 'Test Session');
  console.log(`  Created session: ${session.id}`);

  // Add multiple messages
  const testMessages = [
    { type: 'user', content: 'Hello, this is message 1', timestamp: Date.now() },
    { type: 'agent', content: 'Response to message 1', timestamp: Date.now() + 1, team: 'coder' },
    { type: 'user', content: 'This is message 2', timestamp: Date.now() + 2 },
    { type: 'tool_call', content: 'Reading file...', timestamp: Date.now() + 3, metadata: { tool: 'read' } },
    { type: 'tool_result', content: 'File contents here', timestamp: Date.now() + 4 },
    { type: 'agent', content: 'Here is the final response', timestamp: Date.now() + 5, team: 'reviewer' },
  ];

  for (const msg of testMessages) {
    mgr1.addMessage(session.id, msg);
  }
  console.log(`  Added ${testMessages.length} messages`);

  // Flush pending writes
  await mgr1.flush();
  console.log('  Flushed all pending writes');

  // Verify files exist
  const sessionFile = path.join(TEST_DIR, `${session.id}.json`);
  const messagesDir = path.join(TEST_DIR, session.id, 'messages');

  console.log(`\n  Session file exists: ${fs.existsSync(sessionFile)}`);
  console.log(`  Messages dir exists: ${fs.existsSync(messagesDir)}`);

  const messageFiles = fs.readdirSync(messagesDir);
  console.log(`  Message files count: ${messageFiles.length}`);
  console.log(`  Message files: ${messageFiles.join(', ')}`);

  // Phase 2: Simulate server restart - create new SessionManager
  console.log('\nPhase 2: Simulating server restart (new SessionManager instance)...');
  const mgr2 = new SessionManager(TEST_DIR);

  // Verify session loaded
  const loadedSession = mgr2.getSession(session.id);
  console.log(`  Session loaded: ${!!loadedSession}`);
  if (loadedSession) {
    console.log(`    Title: ${loadedSession.title}`);
    console.log(`    Status: ${loadedSession.status}`);
    console.log(`    Message count: ${loadedSession.metadata.messageCount}`);
  }

  // Verify messages loaded
  const loadedMessages = mgr2.getMessages(session.id);
  console.log(`  Messages loaded: ${loadedMessages.length}`);

  if (loadedMessages.length > 0) {
    console.log('\n  Loaded messages:');
    for (const msg of loadedMessages) {
      console.log(`    [${msg.sequenceId}] ${msg.type}: ${msg.content.substring(0, 40)}...`);
    }
  }

  // Phase 3: Test getMessagesAfter
  console.log('\nPhase 3: Testing getMessagesAfter...');
  const afterSeq3 = mgr2.getMessagesAfter(session.id, 3);
  console.log(`  Messages after sequence 3: ${afterSeq3.length}`);
  for (const msg of afterSeq3) {
    console.log(`    [${msg.sequenceId}] ${msg.type}: ${msg.content.substring(0, 40)}...`);
  }

  // Phase 4: Add more messages to reloaded session
  console.log('\nPhase 4: Adding messages to reloaded session...');
  mgr2.addMessage(session.id, {
    type: 'user',
    content: 'Message after restart',
    timestamp: Date.now(),
  });

  await mgr2.flush();

  // Verify new message persisted
  const mgr3 = new SessionManager(TEST_DIR);
  const allMessages = mgr3.getMessages(session.id);
  console.log(`  Total messages after adding to reloaded session: ${allMessages.length}`);
  console.log(`  Last message: ${allMessages[allMessages.length - 1]?.content}`);

  // Phase 5: Test session listing by project
  console.log('\nPhase 5: Testing session listing by project...');
  const sessions = mgr3.getSessions('/test/project');
  console.log(`  Sessions for /test/project: ${sessions.length}`);

  // Create another session for same project
  mgr3.createSession('/test/project', 'Second Session');
  await mgr3.flush();

  const allSessions = mgr3.getSessions('/test/project');
  console.log(`  Sessions after creating second: ${allSessions.length}`);

  // Phase 6: Test session archive
  console.log('\nPhase 6: Testing session archive...');
  const archived = mgr3.archiveSession(session.id);
  console.log(`  Archive result: ${archived}`);

  const archivedSession = mgr3.getSession(session.id);
  console.log(`  Session status after archive: ${archivedSession?.status}`);

  // Verify archived session still in list
  const sessionsAfterArchive = mgr3.getSessions('/test/project');
  console.log(`  Sessions after archive: ${sessionsAfterArchive.length}`);

  // Phase 7: Test getActiveSession
  console.log('\nPhase 7: Testing getActiveSession...');
  const activeSession = mgr3.getActiveSession('/test/project');
  console.log(`  Active session: ${activeSession?.title}`);
  console.log(`  Active session status: ${activeSession?.status}`);

  // Cleanup
  cleanup();
  console.log('\n=== Test Complete ===');
}

testPersistence().catch(err => {
  console.error('Test failed:', err);
  cleanup();
  process.exit(1);
});
