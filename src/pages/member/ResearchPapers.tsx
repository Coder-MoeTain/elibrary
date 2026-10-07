import MemberDigitalCatalog from "./MemberDigitalCatalog";

export const PAPERS_LIST_STATE_KEY = "memberPapersListSearch";

const ResearchPapers = () => (
  <MemberDigitalCatalog
    contentType="paper"
    title="Research Papers"
    description="Browse research papers from the library catalog."
    listStateKey={PAPERS_LIST_STATE_KEY}
    detailBasePath="/member/papers"
    searchPlaceholder="Search research papers…"
    emptyMessage="No research papers found."
    ariaSearchLabel="Search research papers"
  />
);

export default ResearchPapers;
