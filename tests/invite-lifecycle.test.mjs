import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeEmail, shouldShowPendingInvite } from '../lib/invite-state.ts';

test('normalizeEmail lowercases and trims values', () => {
  assert.equal(normalizeEmail('  User@Example.com  '), 'user@example.com');
});

test('accepted invites are hidden from the active request list', () => {
  assert.equal(
    shouldShowPendingInvite({ status: 'accepted', toEmail: 'User@Example.com' }, 'user@example.com'),
    false,
  );

  assert.equal(
    shouldShowPendingInvite({ status: 'pending', toEmail: 'User@Example.com' }, 'user@example.com'),
    true,
  );
});
