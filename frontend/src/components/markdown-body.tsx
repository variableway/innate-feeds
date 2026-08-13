import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "@/lib/utils";

interface MarkdownBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  markdown: string;
  emptyMessage?: string;
}

/**
 * Shared GFM markdown renderer (Digest issue body + repo README).
 * Raw HTML is sanitized via rehype-sanitize.
 */
const MarkdownBody = React.forwardRef<HTMLDivElement, MarkdownBodyProps>(
  (
    {
      markdown,
      emptyMessage = "No content.",
      className,
      ...props
    },
    ref,
  ) => {
    if (!markdown.trim()) {
      return (
        <div
          ref={ref}
          className={cn("text-sm text-muted-foreground", className)}
          {...props}
        >
          {emptyMessage}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "markdown-body max-w-none",
          className,
        )}
        {...props}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            a: ({ href, children, ...rest }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                {...rest}
              >
                {children}
              </a>
            ),
            img: ({ src, alt, ...rest }) => (
              <img
                src={src}
                alt={alt || ""}
                loading="lazy"
                referrerPolicy="no-referrer"
                {...rest}
              />
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    );
  },
);
MarkdownBody.displayName = "MarkdownBody";

export { MarkdownBody };
