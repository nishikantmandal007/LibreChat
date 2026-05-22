import { memo } from 'react';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import supersub from 'remark-supersub';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import type { PluggableList } from 'unified';
import { codeNoExecution } from '~/components/Chat/Messages/Content/MarkdownComponents';
import { langSubset } from '~/utils';

const REMARK_PLUGINS: PluggableList = [
  supersub,
  remarkGfm,
  [remarkMath, { singleDollarTextMath: false }],
];

const REHYPE_PLUGINS: PluggableList = [
  [rehypeKatex],
  [
    rehypeHighlight,
    {
      detect: true,
      ignoreMissing: true,
      subset: langSubset,
    },
  ],
];

const MARKDOWN_COMPONENTS = { code: codeNoExecution };

interface SkillMarkdownRendererProps {
  content: string;
  className?: string;
}

function SkillMarkdownRenderer({ content, className }: SkillMarkdownRendererProps) {
  return (
    <ReactMarkdown
      /** @ts-ignore - PluggableList vs Pluggable[] shape drift */
      remarkPlugins={REMARK_PLUGINS}
      /** @ts-ignore - PluggableList vs Pluggable[] shape drift */
      rehypePlugins={REHYPE_PLUGINS}
      components={MARKDOWN_COMPONENTS as unknown as Record<string, React.ElementType>}
      className={
        className ??
        'markdown prose prose-sm dark:prose-invert light prose-headings:scroll-m-20 prose-headings:font-semibold w-full max-w-none break-words leading-7 text-text-primary'
      }
    >
      {content}
    </ReactMarkdown>
  );
}

export default memo(SkillMarkdownRenderer);
