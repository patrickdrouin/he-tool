/*
 * Copyright (C) 2023 Yaraku, Inc.
 *
 * This file is part of Human Evaluation Tool.
 *
 * Human Evaluation Tool is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * Human Evaluation Tool is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * Human Evaluation Tool. If not, see <https://www.gnu.org/licenses/>.
 *
 * Written by Giovanni G. De Giacomo <giovanni@yaraku.com>, August 2023
 */

import { Fragment, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import {
  useCreateAnnotationMarking,
  useDeleteAnnotationMarking,
  useUpdateAnnotationMarking,
} from "../features/annotations/useAnnotationMarkings";
import ClickOutsideListener from "./ClickOutsideListener";
import MarkingPopup from "./MarkingPopup";

export default function MarkingItem({
  containerRef,
  annotationId,
  systemId,
  annotationMarkings,
  isSource,
  readOnly,
  text,
}) {
  const [selectedMarking, setSelectedMarking] = useState(null);
  const [selection, setSelection] = useState(null);
  const [mouseX, setMouseX] = useState(null);
  const [mouseY, setMouseY] = useState(null);
  const queryClient = useQueryClient();

  const { createAnnotationMarking } = useCreateAnnotationMarking();
  const { deleteAnnotationMarking } = useDeleteAnnotationMarking();
  const { updateAnnotationMarking, isLoading: isUpdateMarkingLoading } =
    useUpdateAnnotationMarking();

  function createMarking({ start, end, category, severity, comment }) {
    setSelectedMarking(null);
    setSelection(null);

    // Assert that neither start or end are NaN
    if (isNaN(start) || isNaN(end)) {
      toast.error(
        "Failed to create marking due to invalid selection. Please select carefully and try again.",
      );

      return;
    }

    createAnnotationMarking({
      annotationId,
      systemId,
      start,
      end,
      category,
      severity,
      isSource,
      comment,
      onSuccess: (data) => {
        queryClient.setQueryData(
          ["annotationMarkings", annotationId],
          (markings) => [...markings, data],
        );
      },
      onError: (_) => {
        toast.error(
          "Failed to create marking. Please check your internet connection and try again.",
        );
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: ["annotationMarkings", annotationId],
        });
      },
    });
  }

  function deleteMarking({ marking }) {
    setSelectedMarking(null);
    setSelection(null);
    deleteAnnotationMarking({
      annotationId,
      systemId,
      markingId: marking.id,
      onSuccess: () => {
        queryClient.setQueryData(
          ["annotationMarkings", annotationId],
          (markings) => markings.filter((m) => m.id !== marking.id),
        );
      },
      onError: () => {
        toast.error(
          "Failed to delete marking. Please check your internet connection and try again.",
        );
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: ["annotationMarkings", annotationId],
        });
      },
    });
  }

  function updateMarking({ marking, category, severity, comment }) {
    updateAnnotationMarking({
      annotationId,
      systemId,
      markingId: marking.id,
      start: marking.errorStart,
      end: marking.errorEnd,
      category,
      severity,
      isSource,
      comment,
      onSuccess: () => {
        queryClient.setQueryData(
          ["annotationMarkings", annotationId],
          (markings) =>
            markings.map((m) => {
              if (m.id === marking.id) {
                return {
                  ...m,
                  errorCategory: category,
                  errorSeverity: severity,
                };
              }

              return m;
            }),
        );
      },
      onError: () => {
        toast.error(
          "Failed to update marking. Please check your internet connection and try again.",
        );
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: ["annotationMarkings", annotationId],
        });
      },
    });
  }

  function getClassBySeverity(severity) {
    switch (severity) {
      case "no-error":
        return "tw-bg-gray-600 tw-text-white";
      case "minor":
        return "tw-bg-green-600 tw-text-white";
      case "major":
        return "tw-bg-yellow-500 tw-text-white";
      case "critical":
        return "tw-bg-red-500 tw-text-white";
      case "not-judgeable":
        return "tw-bg-blue-600 tw-text-white";
    }
  }

  const severityOrder = ["critical", "major", "minor", "not-judgeable", "no-error"];

  function getClassByIndex(index) {
    let bestClass = null;
    let bestPriority = severityOrder.length;
    for (const marking of annotationMarkings) {
      if (index >= marking.errorStart && index <= marking.errorEnd) {
        const priority = severityOrder.indexOf(marking.errorSeverity);
        if (priority < bestPriority) {
          bestPriority = priority;
          bestClass = getClassBySeverity(marking.errorSeverity);
        }
      }
    }
    return bestClass;
  }

  function getContextMenuByIndex(index) {
    return (e) => {
      e.preventDefault();

      const sel = window.getSelection();

      // With an active text selection the intent is always to create a new marking,
      // even when the selection overlaps existing ones.
      if (!sel.isCollapsed) {
        let start = index;
        let end = index;
        const anchorId = parseInt(sel.anchorNode?.parentElement?.id);
        const focusId = parseInt(sel.focusNode?.parentElement?.id);
        if (!isNaN(anchorId) && !isNaN(focusId) && anchorId !== focusId) {
          start = Math.min(anchorId, focusId);
          end = Math.max(anchorId, focusId);
        }
        setSelection({ start, end });
        setMouseX(e.clientX);
        setMouseY(e.clientY);
        return;
      }

      // No selection: edit the first marking that covers this word, or create
      // a single-word marking if the word is not yet marked.
      for (const [markingIndex, marking] of annotationMarkings.entries()) {
        if (index >= marking.errorStart && index <= marking.errorEnd) {
          setSelectedMarking(markingIndex);
          setMouseX(e.clientX);
          setMouseY(e.clientY);
          return;
        }
      }

      setSelection({ start: index, end: index });
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
  }

  function shouldShowMarkingPopup() {
    return selectedMarking !== null || selection !== null;
  }

  return (
    <div className="col-sm-10 markingText tw-select-text tw-whitespace-normal" onContextMenu={(e) => e.preventDefault()}>
      {text.trim().replace(/\s+/g, " ").split(" ").map((word, wordIndex) => (
        <Fragment key={wordIndex}>
          {wordIndex > 0 && <span className="tw-select-none"> </span>}
          <span
            id={wordIndex}
            className={getClassByIndex(wordIndex)}
            onContextMenu={isSource || readOnly ? (e) => e.preventDefault() : getContextMenuByIndex(wordIndex)}
            onDoubleClick={(e) => {
              const range = document.createRange();
              range.selectNodeContents(e.currentTarget);
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
            }}
          >
            {word}
          </span>
        </Fragment>
      ))}
      {!isSource && !readOnly && (
        <ClickOutsideListener
          enabled={shouldShowMarkingPopup()}
          onClickOutside={(_) => {
            setSelectedMarking(null);
            setSelection(null);
          }}
        >
          {shouldShowMarkingPopup() && (
            <MarkingPopup
              containerRef={containerRef.current}
              marking={annotationMarkings[selectedMarking]}
              selection={selection}
              disabled={isUpdateMarkingLoading}
              mouseX={mouseX}
              mouseY={mouseY}
              createMarking={createMarking}
              deleteMarking={deleteMarking}
              updateMarking={updateMarking}
            />
          )}
        </ClickOutsideListener>
      )}
    </div>
  );
}
