import type { ChangeEvent, RefObject } from "react";

import type { BountyMessage } from "@/lib/agent-tools";
import { formatDateTime } from "@/lib/format";

import type { BountyView, DiscussionDraft } from "@/components/bounty-board-types";

interface BountyDiscussionModalProps {
  bounty: BountyView;
  draft: DiscussionDraft;
  messages: BountyMessage[];
  isLoading: boolean;
  isPosting: boolean;
  isFormatMenuOpen: boolean;
  isAttachmentMenuOpen: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onClose: () => void;
  onToggleFormatMenu: () => void;
  onToggleAttachmentMenu: () => void;
  onApplyTextStyle: (wrapper: "**" | "*" | "~~") => void;
  onAttachmentFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAttachmentUrlChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onClearAttachment: () => void;
  onSendMessage: () => void;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderRichText(value: string) {
  const escaped = escapeHtml(value);
  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const withItalic = withBold.replace(/\*(.+?)\*/g, "<em>$1</em>");
  const withStrike = withItalic.replace(/~~(.+?)~~/g, "<s>$1</s>");

  return {
    __html: withStrike.replace(/\n/g, "<br />")
  };
}

export function BountyDiscussionModal({
  bounty,
  draft,
  messages,
  isLoading,
  isPosting,
  isFormatMenuOpen,
  isAttachmentMenuOpen,
  textareaRef,
  onClose,
  onToggleFormatMenu,
  onToggleAttachmentMenu,
  onApplyTextStyle,
  onAttachmentFileChange,
  onAttachmentUrlChange,
  onTextChange,
  onClearAttachment,
  onSendMessage
}: BountyDiscussionModalProps) {
  return (
    <div className="discussion-modal-backdrop" onClick={onClose} role="presentation">
      <section aria-label="Bounty discussion" className="discussion-modal" onClick={(event) => event.stopPropagation()}>
        <div className="discussion-modal-head">
          <div>
            <span className="card-label">Discussion room</span>
            <h2>
              #{bounty.id.toString()} | {bounty.title}
            </h2>
            <p className="panel-copy">Creator and claimant can coordinate here without leaving the board.</p>
          </div>
          <button className="button button-secondary" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="discussion-thread">
          {isLoading ? (
            <div className="empty-inline">Loading discussion from Arc...</div>
          ) : messages.length > 0 ? (
            messages.map((message, index) => {
              const roleLabel =
                message.author.toLowerCase() === bounty.creator.toLowerCase()
                  ? "Creator"
                  : message.author.toLowerCase() === bounty.claimant.toLowerCase()
                    ? "Claimant"
                    : "Participant";

              return (
                <article className="discussion-message" key={`${bounty.id.toString()}-${index.toString()}`}>
                  <div className="discussion-head">
                    <strong>{roleLabel}</strong>
                    <span>{formatDateTime(message.createdAt)}</span>
                  </div>
                  {message.text ? (
                    <div className="discussion-body" dangerouslySetInnerHTML={renderRichText(message.text)} />
                  ) : null}
                  {message.attachmentDataUrl || message.attachmentUrl ? (
                    <a
                      className="attachment-chip"
                      href={message.attachmentDataUrl ?? message.attachmentUrl ?? "#"}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {message.attachmentName || "Attachment"}
                    </a>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="empty-inline">
              No messages yet. Start the thread here instead of sending people off to external socials.
            </div>
          )}
        </div>

        <div className="composer-shell">
          <div className="composer-toolbar">
            <div className="toolbar-group">
              <button className="icon-button" onClick={onToggleFormatMenu} type="button">
                Aa
              </button>
              {isFormatMenuOpen ? (
                <div className="toolbar-popover">
                  <button className="popover-action" onClick={() => onApplyTextStyle("**")} type="button">
                    Bold
                  </button>
                  <button className="popover-action" onClick={() => onApplyTextStyle("*")} type="button">
                    Italic
                  </button>
                  <button className="popover-action" onClick={() => onApplyTextStyle("~~")} type="button">
                    Strike
                  </button>
                </div>
              ) : null}
            </div>

            <div className="toolbar-group">
              <button className="icon-button" onClick={onToggleAttachmentMenu} type="button">
                +
              </button>
              {isAttachmentMenuOpen ? (
                <div className="toolbar-popover attachment-popover">
                  <label className="popover-file">
                    <span>Attach file</span>
                    <input onChange={onAttachmentFileChange} type="file" />
                  </label>
                  <label className="field compact-field">
                    <span>Attachment URL</span>
                    <input value={draft.attachmentUrl} onChange={(event) => onAttachmentUrlChange(event.target.value)} />
                  </label>
                </div>
              ) : null}
            </div>

            <span className="muted-line">Formatting uses markdown-style markers and renders in the thread.</span>
          </div>

          {draft.attachmentName || draft.attachmentUrl ? (
            <div className="attachment-row">
              <span className="attachment-chip">{draft.attachmentName || draft.attachmentUrl}</span>
              <button className="button button-ghost" onClick={onClearAttachment} type="button">
                Remove attachment
              </button>
            </div>
          ) : null}

          <label className="field">
            <span>Message</span>
            <textarea ref={textareaRef} rows={5} value={draft.text} onChange={(event) => onTextChange(event.target.value)} />
          </label>

          <div className="post-action-footer">
            <button className="button button-primary" disabled={isPosting} onClick={onSendMessage} type="button">
              {isPosting ? "Posting message..." : "Send message"}
            </button>
            <span className="muted-line">Messages are stored as Arc contract events for this bounty.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
