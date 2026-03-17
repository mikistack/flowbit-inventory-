const buildPagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 25, 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

module.exports = {
  buildPagination,
  paginateResult(data, count, { page, limit }) {
    return {
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
      data,
    };
  },
};
