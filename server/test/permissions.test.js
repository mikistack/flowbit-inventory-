const test = require('node:test');
const assert = require('node:assert/strict');

const hasPermission = require('../src/middlewares/permissions');

const makeRes = () => {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

test('permissions: rejects when req.user is missing', () => {
  const req = {};
  const res = makeRes();
  let nextCalled = false;
  hasPermission('any.key')(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { message: 'Forbidden' });
});

test('permissions: Admin bypasses permission checks', () => {
  const req = { user: { role: { name: 'Admin', permissions: [] } } };
  const res = makeRes();
  let nextCalled = false;
  hasPermission('does.not.matter')(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test('permissions: Super Admin bypasses permission checks', () => {
  const req = { user: { role: { name: 'Super Admin', permissions: [] } } };
  const res = makeRes();
  let nextCalled = false;
  hasPermission('does.not.matter')(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test('permissions: allows when permission exists as string', () => {
  const req = { user: { role: { name: 'Worker', permissions: ['sales.create'] } } };
  const res = makeRes();
  let nextCalled = false;
  hasPermission('sales.create')(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});

test('permissions: allows when permission exists as object', () => {
  const req = { user: { role: { name: 'Worker', permissions: [{ key: 'sales.create' }] } } };
  const res = makeRes();
  let nextCalled = false;
  hasPermission('sales.create')(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});

test('permissions: denies when permission is missing', () => {
  const req = { user: { role: { name: 'Worker', permissions: [{ key: 'sales.view' }] } } };
  const res = makeRes();
  let nextCalled = false;
  hasPermission('sales.create')(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { message: 'Permission denied' });
});

test('permissions: mode=all requires all permissions', () => {
  const req = { user: { role: { name: 'Worker', permissions: ['a', 'b'] } } };
  const res = makeRes();
  let nextCalled = false;
  hasPermission(['a', 'c'], { mode: 'all' })(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

