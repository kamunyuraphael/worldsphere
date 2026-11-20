import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './assistant.css';

/* Pull the hast `node` prop out so it is not spread onto DOM elements. */
const withoutNode = <T extends { node?: unknown }>(props: T) => {
  const rest = { ...props };
  delete rest.node;
  return rest;
};

const components: Components = {
  table: (props) => (
    <div className="md-table-wrap" role="region" aria-label="Table" tabIndex={0}>
      <table {...withoutNode(props)} />
    </div>
  ),
  a: (props) => <a {...withoutNode(props)} target="_blank" rel="noopener noreferrer" />,
};

const Markdown = ({ children }: { children: string }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
    {children}
  </ReactMarkdown>
);

export default Markdown;
