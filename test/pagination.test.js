const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parsePagination } = require("../pagination");

test("pagination defaults to a bounded first page", () => {
    assert.deepEqual(parsePagination({}), { page: 1, limit: 50, offset: 0 });
});

test("pagination calculates an offset and enforces the maximum page size", () => {
    assert.deepEqual(parsePagination({ page: "3", limit: "25" }), {
        page: 3,
        limit: 25,
        offset: 50
    });
    assert.equal(parsePagination({ page: "1", limit: "101" }), null);
});

test("pagination rejects invalid and excessively large page numbers", () => {
    assert.equal(parsePagination({ page: "0" }), null);
    assert.equal(parsePagination({ page: "-1" }), null);
    assert.equal(parsePagination({ page: "1.5" }), null);
    assert.equal(parsePagination({ page: "1000001" }), null);
});
