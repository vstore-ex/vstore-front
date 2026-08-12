function buildPages(currentPage, totalPages, maxVisiblePages) {
  if (totalPages <= maxVisiblePages) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= maxVisiblePages - 2) {
    return [...Array.from({ length: maxVisiblePages }, (_, index) => index + 1), 'end-ellipsis', totalPages]
  }

  if (currentPage >= totalPages - (maxVisiblePages - 3)) {
    const firstVisiblePage = totalPages - maxVisiblePages + 1
    return [1, 'start-ellipsis', ...Array.from({ length: maxVisiblePages }, (_, index) => firstVisiblePage + index)]
  }

  const pages = [1]
  const middleStart = Math.max(2, currentPage - 2)
  const middleEnd = Math.min(totalPages - 1, currentPage + 2)

  if (middleStart > 2) {
    pages.push('start-ellipsis')
  }

  for (let page = middleStart; page <= middleEnd; page += 1) {
    pages.push(page)
  }

  if (middleEnd < totalPages - 1) {
    pages.push('end-ellipsis')
  }

  pages.push(totalPages)
  return pages
}

function Pagination({
  activeClassName,
  ariaLabel,
  className,
  currentPage,
  disabledClassName,
  maxVisiblePages = 6,
  onPageChange,
  pageSize,
  totalItems,
}) {
  const totalPages = Math.ceil(totalItems / pageSize)

  if (totalPages <= 1) {
    return null
  }

  const pages = buildPages(currentPage, totalPages, maxVisiblePages)

  return (
    <nav className={className} aria-label={ariaLabel}>
      <button
        className={currentPage === 1 ? disabledClassName : undefined}
        type="button"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        Previous
      </button>

      {pages.map((page) =>
        typeof page === 'number' ? (
          <button
            className={page === currentPage ? activeClassName : undefined}
            type="button"
            onClick={() => onPageChange(page)}
            key={page}
          >
            {page}
          </button>
        ) : (
          <span key={page}>...</span>
        ),
      )}

      <button
        className={currentPage === totalPages ? disabledClassName : undefined}
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next
      </button>
    </nav>
  )
}

export default Pagination
