import MemberDigitalCatalog from "./MemberDigitalCatalog";

export const EBOOKS_LIST_STATE_KEY = "memberEbooksListSearch";

const Ebooks = () => (
  <MemberDigitalCatalog
    contentType="ebook"
    title="e-Books"
    description="Browse digital books and open details instantly."
    listStateKey={EBOOKS_LIST_STATE_KEY}
    detailBasePath="/member/ebooks"
    searchPlaceholder="Search by title..."
    emptyMessage="No e-books found in this category."
    ariaSearchLabel="Search e-books"
  />
);

export default Ebooks;
