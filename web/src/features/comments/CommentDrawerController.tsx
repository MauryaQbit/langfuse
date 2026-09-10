import Header from "@/src/components/layouts/header";
import {
  DrawerContent,
  DrawerController,
  DrawerHeader,
  DrawerTitle,
} from "@/src/components/ui/drawer";
import { CommentList } from "@/src/features/comments/CommentList";
import { useHasProjectAccess } from "@/src/features/rbac";
import { type CommentObjectType } from "@langfuse/shared";
import { useRouter } from "next/router";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { type SelectionData } from "./contexts/InlineCommentSelectionContext";

type CommentDrawerContentProps = {
  projectId: string;
  objectId: string;
  objectType: CommentObjectType;
  objectStartTime?: Date | null;
  pendingSelection: SelectionData | null;
  onSelectionUsed: () => void;
  onCommentChange?: () => void | Promise<void>;
  onMentionDropdownChange: (isOpen: boolean) => void;
};

function CommentDrawerContent({
  projectId,
  objectId,
  objectType,
  objectStartTime,
  pendingSelection,
  onSelectionUsed,
  onCommentChange,
  onMentionDropdownChange,
}: CommentDrawerContentProps) {
  const hasFocusedRef = useRef(false);

  return (
    <DrawerContent
      overlayClassName="bg-primary/10"
      className="h-screen-with-banner max-h-screen-with-banner overflow-hidden"
    >
      <div
        className="mx-auto flex h-full w-full flex-col overflow-hidden focus:ring-0 focus:outline-hidden focus-visible:ring-0 focus-visible:outline-hidden md:max-h-full"
        tabIndex={-1}
        ref={(element) => {
          if (element && !hasFocusedRef.current) {
            hasFocusedRef.current = true;
            setTimeout(() => element.focus({ preventScroll: true }), 100);
          }
        }}
      >
        <DrawerHeader className="bg-background sr-only shrink-0 rounded-sm">
          <DrawerTitle>
            <Header title="Comments" />
          </DrawerTitle>
        </DrawerHeader>
        <div
          data-vaul-no-drag
          className="min-h-0 flex-1 overflow-hidden px-2 py-2"
        >
          <CommentList
            projectId={projectId}
            objectId={objectId}
            objectType={objectType}
            objectStartTime={objectStartTime}
            onMentionDropdownChange={onMentionDropdownChange}
            isDrawerOpen
            pendingSelection={pendingSelection}
            onSelectionUsed={onSelectionUsed}
            onCommentChange={onCommentChange}
          />
        </div>
      </div>
    </DrawerContent>
  );
}

export type CommentDrawerControllerProps = {
  projectId: string;
  autoOpenState?: CommentDrawerState;
  allowReadOnly?: boolean;
  count?: number;
  onCommentChange?: () => void | Promise<void>;
  children: (control: {
    disabled: boolean;
    openDrawer: (state: CommentDrawerState) => void;
  }) => ReactNode;
};

type CommentDrawerTarget = {
  objectId: string;
  objectType: CommentObjectType;
  objectStartTime?: Date | null;
};

export type CommentDrawerState = CommentDrawerTarget &
  ({ type: "comments" } | { type: "inline-comment"; selection: SelectionData });

function CommentDrawerTriggers({
  children,
  disabled,
  openDrawer,
}: {
  children: CommentDrawerControllerProps["children"];
  disabled: boolean;
  openDrawer: (state: CommentDrawerState) => void;
}) {
  return children({
    disabled,
    openDrawer: (state) => {
      if (!disabled) openDrawer(state);
    },
  });
}

export function CommentDrawerController({
  children,
  projectId,
  autoOpenState,
  allowReadOnly = false,
  count,
  onCommentChange,
}: CommentDrawerControllerProps) {
  const router = useRouter();
  const [isMentionDropdownOpen, setIsMentionDropdownOpen] = useState(false);

  const hasReadAccess = useHasProjectAccess({
    projectId,
    scope: "comments:read",
  });
  const hasWriteAccess = useHasProjectAccess({
    projectId,
    scope: "comments:CUD",
  });
  const disabled =
    !hasReadAccess || (!allowReadOnly && !hasWriteAccess && !count);

  useEffect(() => {
    if (disabled || !autoOpenState || !router.asPath.includes("#comment-"))
      return;

    setTimeout(() => {
      const hash = router.asPath.split("#")[1];
      document.getElementById(hash)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 300);
  }, [autoOpenState, disabled, router.asPath]);

  const handleOpenChange = (open: boolean) => {
    if (!open && isMentionDropdownOpen) return false;
    if (!open && router.query.comments === "open") {
      const { comments, commentObjectType, commentObjectId, ...rest } =
        router.query;
      router.replace({ pathname: router.pathname, query: rest }, undefined, {
        shallow: true,
      });
    }
  };

  return (
    <DrawerController<CommentDrawerState>
      autoOpenState={disabled ? undefined : autoOpenState}
      key={hasReadAccess ? "allowed" : "denied"}
      blockTextSelection={false}
      onOpenChange={handleOpenChange}
      renderContent={({ state, replaceState }) => (
        <CommentDrawerContent
          projectId={projectId}
          objectId={state.objectId}
          objectType={state.objectType}
          objectStartTime={state.objectStartTime}
          pendingSelection={
            state.type === "inline-comment" ? state.selection : null
          }
          onSelectionUsed={() => replaceState({ ...state, type: "comments" })}
          onCommentChange={onCommentChange}
          onMentionDropdownChange={setIsMentionDropdownOpen}
        />
      )}
    >
      {({ openDrawer }) => (
        <CommentDrawerTriggers disabled={disabled} openDrawer={openDrawer}>
          {children}
        </CommentDrawerTriggers>
      )}
    </DrawerController>
  );
}

export function useCommentDrawerUrlState() {
  const router = useRouter();
  const comments = router.query.comments;
  const objectId = router.query.commentObjectId;
  const objectType = router.query.commentObjectType;

  return useMemo(() => {
    if (
      comments !== "open" ||
      typeof objectId !== "string" ||
      typeof objectType !== "string"
    ) {
      return undefined;
    }

    return {
      type: "comments",
      objectId,
      objectType: objectType as CommentObjectType,
    } satisfies CommentDrawerState;
  }, [comments, objectId, objectType]);
}
