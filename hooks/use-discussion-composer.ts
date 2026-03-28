"use client";

import { useRef, useState, type ChangeEvent } from "react";
import type { Address, Hex, PublicClient } from "viem";

import type { DiscussionDraft, BountyView } from "@/components/bounty-board-types";
import { arcBountyBoardAbi } from "@/lib/abi";
import { buildMessageUri, readBountyMessages, type BountyMessage } from "@/lib/agent-tools";
import { defaultDiscussionDraft, getErrorMessage } from "@/hooks/bounty-board-shared";

type WriteContractFn = (parameters: {
  address: Address;
  abi: unknown;
  functionName: string;
  args: readonly unknown[];
  chainId: number;
}) => Promise<Hex>;

type UseDiscussionComposerParams = {
  publicClient: PublicClient | undefined;
  resolvedBoardAddress: Address;
  hasBountyBoardAddress: boolean;
  ensureArcWallet: () => Promise<void>;
  waitForReceipt: (hash: Hex) => Promise<void>;
  writeContractAsync: WriteContractFn;
  setNotice: (value: string | null) => void;
  setError: (value: string | null) => void;
  chainId: number;
};

export function useDiscussionComposer({
  publicClient,
  resolvedBoardAddress,
  hasBountyBoardAddress,
  ensureArcWallet,
  waitForReceipt,
  writeContractAsync,
  setNotice,
  setError,
  chainId
}: UseDiscussionComposerParams) {
  const [messagesByBounty, setMessagesByBounty] = useState<Record<string, BountyMessage[]>>({});
  const [messageDrafts, setMessageDrafts] = useState<Record<string, DiscussionDraft>>({});
  const [activeDiscussionBountyId, setActiveDiscussionBountyId] = useState<string | null>(null);
  const [isLoadingMessagesFor, setIsLoadingMessagesFor] = useState<string | null>(null);
  const [isPostingMessageFor, setIsPostingMessageFor] = useState<string | null>(null);
  const [isFormatMenuOpen, setIsFormatMenuOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const discussionTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  function ensureDiscussionDraft(bountyId: string) {
    setMessageDrafts((current) =>
      current[bountyId]
        ? current
        : {
            ...current,
            [bountyId]: defaultDiscussionDraft()
          }
    );
  }

  async function loadDiscussionThread(bounty: BountyView, options?: { force?: boolean }) {
    if (!publicClient) {
      return;
    }

    const key = bounty.id.toString();

    if (!options?.force && messagesByBounty[key]) {
      return;
    }

    try {
      setIsLoadingMessagesFor(key);
      const thread = await readBountyMessages(publicClient, resolvedBoardAddress, bounty.id);
      setMessagesByBounty((current) => ({
        ...current,
        [key]: thread
      }));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoadingMessagesFor((current) => (current === key ? null : current));
    }
  }

  async function openDiscussion(bounty: BountyView) {
    const key = bounty.id.toString();
    setActiveDiscussionBountyId(key);
    ensureDiscussionDraft(key);
    setIsFormatMenuOpen(false);
    setIsAttachmentMenuOpen(false);
    await loadDiscussionThread(bounty);
  }

  function closeDiscussion() {
    setActiveDiscussionBountyId(null);
    setIsFormatMenuOpen(false);
    setIsAttachmentMenuOpen(false);
  }

  function updateDiscussionDraft(updater: (draft: DiscussionDraft) => DiscussionDraft) {
    if (!activeDiscussionBountyId) return;

    setMessageDrafts((current) => ({
      ...current,
      [activeDiscussionBountyId]: updater(current[activeDiscussionBountyId] ?? defaultDiscussionDraft())
    }));
  }

  function applyTextStyle(wrapper: "**" | "*" | "~~") {
    const textarea = discussionTextareaRef.current;
    const activeDraft =
      activeDiscussionBountyId ? messageDrafts[activeDiscussionBountyId] ?? defaultDiscussionDraft() : null;

    if (!textarea || !activeDraft) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = activeDraft.text;
    const selected = currentText.slice(start, end) || "text";
    const nextText = currentText.slice(0, start) + wrapper + selected + wrapper + currentText.slice(end);
    const nextCursorStart = start + wrapper.length;
    const nextCursorEnd = nextCursorStart + selected.length;

    updateDiscussionDraft((draft) => ({
      ...draft,
      text: nextText
    }));

    window.requestAnimationFrame(() => {
      if (!discussionTextareaRef.current) return;
      discussionTextareaRef.current.focus();
      discussionTextareaRef.current.setSelectionRange(nextCursorStart, nextCursorEnd);
    });
  }

  async function handleAttachmentFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError(null);

    if (file.size > 24_000) {
      setError("Keep attachment files under 24 KB for the onchain demo flow.");
      event.target.value = "";
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Could not read the selected file."));
      reader.readAsDataURL(file);
    });

    updateDiscussionDraft((draft) => ({
      ...draft,
      attachmentName: file.name,
      attachmentDataUrl: dataUrl
    }));
    setIsAttachmentMenuOpen(false);
    event.target.value = "";
  }

  function clearAttachment() {
    updateDiscussionDraft((draft) => ({
      ...draft,
      attachmentName: "",
      attachmentUrl: "",
      attachmentDataUrl: ""
    }));
  }

  async function handlePostMessage(bounty: BountyView) {
    if (!hasBountyBoardAddress) {
      setError("Deploy the board contract and expose NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS first.");
      return;
    }

    const bountyKey = bounty.id.toString();
    const draft = messageDrafts[bountyKey] ?? defaultDiscussionDraft();
    const messageText = draft.text.trim();

    if (!messageText && !draft.attachmentDataUrl && !draft.attachmentUrl) {
      setError("Write a message or attach a file before posting to the discussion thread.");
      return;
    }

    try {
      await ensureArcWallet();
      setIsPostingMessageFor(bountyKey);
      setError(null);
      setNotice("Posting discussion message to Arc...");

      const hash = await writeContractAsync({
        address: resolvedBoardAddress,
        abi: arcBountyBoardAbi,
        functionName: "postBountyMessage",
        args: [
          bounty.id,
          buildMessageUri({
            text: messageText,
            attachmentName: draft.attachmentName,
            attachmentUrl: draft.attachmentUrl,
            attachmentDataUrl: draft.attachmentDataUrl
          })
        ],
        chainId
      });

      await waitForReceipt(hash);
      await loadDiscussionThread(bounty, { force: true });
      setMessageDrafts((current) => ({
        ...current,
        [bountyKey]: defaultDiscussionDraft()
      }));
      setNotice("Discussion updated on Arc.");
    } catch (messageError) {
      setError(getErrorMessage(messageError));
    } finally {
      setIsPostingMessageFor(null);
    }
  }

  function toggleFormatMenu() {
    setIsFormatMenuOpen((open) => !open);
    setIsAttachmentMenuOpen(false);
  }

  function toggleAttachmentMenu() {
    setIsAttachmentMenuOpen((open) => !open);
    setIsFormatMenuOpen(false);
  }

  return {
    state: {
      messagesByBounty,
      messageDrafts,
      activeDiscussionBountyId,
      isLoadingMessagesFor,
      isPostingMessageFor,
      isFormatMenuOpen,
      isAttachmentMenuOpen,
      discussionTextareaRef
    },
    actions: {
      openDiscussion,
      closeDiscussion,
      updateDiscussionDraft,
      applyTextStyle,
      handleAttachmentFileChange,
      clearAttachment,
      handlePostMessage,
      toggleFormatMenu,
      toggleAttachmentMenu
    }
  };
}
