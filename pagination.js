const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 1000000;

function parsePagination(query) {
    const rawPage = query.page;
    const rawLimit = query.limit;
    const page = rawPage === undefined ? 1 : Number(rawPage);
    const limit = rawLimit === undefined ? DEFAULT_PAGE_SIZE : Number(rawLimit);

    if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        page > MAX_PAGE ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > MAX_PAGE_SIZE
    ) {
        return null;
    }

    return { page, limit, offset: (page - 1) * limit };
}

function setPaginationHeaders(res, pagination, total) {
    const totalPages = Math.ceil(total / pagination.limit);
    res.set({
        "X-Total-Count": String(total),
        "X-Page": String(pagination.page),
        "X-Page-Size": String(pagination.limit),
        "X-Total-Pages": String(totalPages),
        "Access-Control-Expose-Headers": "X-Total-Count, X-Page, X-Page-Size, X-Total-Pages"
    });
}

module.exports = { parsePagination, setPaginationHeaders };
