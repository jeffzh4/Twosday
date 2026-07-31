const fs = require('fs');
const path = require('path');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} = require('firebase/firestore');

const projectId = 'demo-twosday';
const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

function account(ownerUid, overrides = {}) {
  return {
    ownerUid,
    authUid: ownerUid,
    authClaimed: true,
    authEmail: `${ownerUid}@twosday.local`,
    profiles: ['alex', 'jamie'],
    firestoreDoc: ownerUid,
    notesDoc: `${ownerUid}-notes`,
    createdAt: Date.now(),
    ...overrides,
  };
}

function calendar(ownerUid, accountId = ownerUid, overrides = {}) {
  return {
    ownerUid,
    accountId,
    allData: {},
    userTheme: {},
    savedAt: Date.now(),
    ...overrides,
  };
}

function share(ownerUid, overrides = {}) {
  return {
    ownerUid,
    event: {
      title: 'sf moma',
      dateKey: '2026-07-19',
      start: 15,
      end: 17,
      location: '151 3rd St',
      description: null,
      sharedBy: 'jeff',
    },
    createdAt: Date.now(),
    expiresAt: Date.now() + 1000,
    ...overrides,
  };
}

async function run() {
  const env = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });

  const anonymous = env.unauthenticatedContext().firestore();
  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();

  try {
    await env.clearFirestore();

    await assertFails(setDoc(doc(anonymous, 'accounts/alice'), account('alice')));
    await assertSucceeds(setDoc(doc(alice, 'accounts/alice'), account('alice')));
    await assertSucceeds(setDoc(doc(bob, 'accounts/bob'), account('bob')));
    await assertSucceeds(getDoc(doc(alice, 'accounts/alice')));
    await assertFails(getDoc(doc(bob, 'accounts/alice')));
    console.log('ok - account records are private to their Firebase Auth owner');

    await assertSucceeds(getDocs(query(
      collection(alice, 'accounts'),
      where('ownerUid', '==', 'alice'),
    )));
    console.log('ok - owner-filtered account lookup supports Google sign-in');

    await assertSucceeds(setDoc(doc(alice, 'schedules/alice'), calendar('alice')));
    await assertSucceeds(getDoc(doc(alice, 'schedules/alice')));
    await assertFails(getDoc(doc(anonymous, 'schedules/alice')));
    await assertFails(getDoc(doc(bob, 'schedules/alice')));
    await assertFails(updateDoc(doc(bob, 'schedules/alice'), { savedAt: Date.now() }));
    await assertFails(deleteDoc(doc(bob, 'schedules/alice')));
    console.log('ok - calendar data rejects anonymous and cross-account access');

    await assertFails(updateDoc(doc(alice, 'schedules/alice'), { ownerUid: 'bob' }));
    await assertFails(setDoc(doc(alice, 'schedules/not-alices-doc'), calendar('alice')));
    await assertFails(setDoc(doc(alice, 'schedules/alice-notes'), {
      ownerUid: 'alice',
      accountId: 'alice',
      junk: true,
    }));
    console.log('ok - ownership is immutable and malformed or mislinked writes fail');

    await env.withSecurityRulesDisabled(async context => {
      const admin = context.firestore();
      await setDoc(doc(admin, 'schedules/legacy-calendar'), { allData: { old: {} } });
      await setDoc(doc(admin, 'schedules/accounts'), { accounts: { alice: account('alice') } });
      await setDoc(doc(admin, 'accounts/alice'), account('alice', {
        firestoreDoc: 'legacy-calendar',
        notesDoc: 'legacy-notes',
      }));
    });

    await assertFails(updateDoc(doc(bob, 'schedules/legacy-calendar'), {
      ownerUid: 'bob',
      accountId: 'bob',
    }));
    await assertSucceeds(updateDoc(doc(alice, 'schedules/legacy-calendar'), {
      ownerUid: 'alice',
      accountId: 'alice',
    }));
    console.log('ok - only the linked owner can claim a legacy data document');

    // The retired registry contains account metadata as one shared document.
    // Rules cannot safely expose selected fields from a document, so no client
    // may read it.
    await assertFails(getDoc(doc(anonymous, 'schedules/accounts')));
    await assertFails(getDoc(doc(alice, 'schedules/accounts')));
    await assertFails(updateDoc(doc(anonymous, 'schedules/accounts'), { savedAt: Date.now() }));
    await assertFails(updateDoc(doc(alice, 'schedules/accounts'), { savedAt: Date.now() }));
    console.log('ok - the retired account registry is unreachable to clients');

    await assertFails(setDoc(doc(anonymous, 'shares/anon-token'), share('alice')));
    await assertFails(setDoc(doc(alice, 'shares/spoofed-token'), share('bob')));
    await assertFails(setDoc(doc(alice, 'shares/malformed-token'), { ownerUid: 'alice', event: 'not-a-map' }));
    await assertFails(setDoc(doc(alice, 'shares/short-token'), share('alice')));
    await assertSucceeds(setDoc(doc(alice, 'shares/aaaaaaaaaaaaaaaaaaaaaa'), share('alice')));
    console.log('ok - share links are owner-stamped and shape-validated on write');

    // The token in the URL is the recipient's only credential, so a direct get
    // must work unauthenticated.
    await assertSucceeds(getDoc(doc(anonymous, 'shares/aaaaaaaaaaaaaaaaaaaaaa')));
    await assertFails(updateDoc(doc(anonymous, 'shares/aaaaaaaaaaaaaaaaaaaaaa'), { createdAt: Date.now() }));
    await assertFails(updateDoc(doc(bob, 'shares/aaaaaaaaaaaaaaaaaaaaaa'), share('bob')));
    await assertFails(deleteDoc(doc(bob, 'shares/aaaaaaaaaaaaaaaaaaaaaa')));
    await assertSucceeds(deleteDoc(doc(alice, 'shares/aaaaaaaaaaaaaaaaaaaaaa')));
    console.log('ok - an unexpired share token is read-only outside its owner');

    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'shares/bbbbbbbbbbbbbbbbbbbbbb'), share('alice', {
        // A fixed historical timestamp avoids an emulator-clock race around
        // a just-expired value.
        expiresAt: 1,
      }));
    });
    await assertFails(getDoc(doc(anonymous, 'shares/bbbbbbbbbbbbbbbbbbbbbb')));
    console.log('ok - expired share tokens are denied by Firestore rules');

    // Enumeration guard: without list, an unknown token cannot be discovered.
    await assertFails(getDocs(collection(anonymous, 'shares')));
    await assertFails(getDocs(collection(alice, 'shares')));
    console.log('ok - the shares collection cannot be enumerated by anyone');

    // Size caps: unbounded growth is rejected before the 1 MiB document limit
    // can brick the account's sync.
    // (accounts/alice was re-pointed at 'legacy-calendar' by the migration test
    // above, so the linked doc ids are legacy-calendar / legacy-calendar-presence.)
    const hugeAudit = Array.from({ length: 301 }, (_, i) => ({ id: String(i), ts: i }));
    await assertFails(setDoc(doc(alice, 'schedules/legacy-calendar'), calendar('alice', 'alice', { auditLog: hugeAudit })));
    await assertSucceeds(setDoc(doc(alice, 'schedules/legacy-calendar'), calendar('alice', 'alice', { auditLog: hugeAudit.slice(0, 300) })));
    await assertFails(setDoc(doc(alice, 'schedules/legacy-calendar'), calendar('alice', 'alice', { auditLog: 'not-a-list' })));
    const manySessions = {};
    for (let i = 0; i < 31; i++) manySessions['client' + i] = { updatedAt: i };
    await assertFails(setDoc(doc(alice, 'schedules/legacy-calendar-presence'), {
      ownerUid: 'alice',
      accountId: 'alice',
      sessions: manySessions,
      savedAt: Date.now(),
    }));
    delete manySessions.client30;
    await assertSucceeds(setDoc(doc(alice, 'schedules/legacy-calendar-presence'), {
      ownerUid: 'alice',
      accountId: 'alice',
      sessions: manySessions,
      savedAt: Date.now(),
    }));
    console.log('ok - schedule documents reject oversized audit logs and session maps');
  } finally {
    await env.cleanup();
  }
}

run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
