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
    password: 'a'.repeat(64),
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

    // Read must stay public: migrating an unclaimed legacy account is the one
    // operation a client performs before it has a Firebase Auth session at all.
    await assertSucceeds(getDoc(doc(anonymous, 'schedules/accounts')));
    await assertSucceeds(getDoc(doc(alice, 'schedules/accounts')));
    await assertFails(updateDoc(doc(anonymous, 'schedules/accounts'), { savedAt: Date.now() }));
    await assertFails(updateDoc(doc(alice, 'schedules/accounts'), { savedAt: Date.now() }));
    console.log('ok - the legacy account registry is publicly readable and never writable');
  } finally {
    await env.cleanup();
  }
}

run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
