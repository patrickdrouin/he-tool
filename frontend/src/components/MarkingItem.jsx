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
  const [selectedWordIndex, setSelectedWordIndex] = useState(null);
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
    setSelectedWordIndex(null);
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
    setSelectedWordIndex(null);
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
          setSelectedWordIndex(index);
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

  const markingsOnSelectedWord = selectedWordIndex !== null
    ? annotationMarkings
        .map((m, i) => ({ ...m, _arrayIndex: i }))
        .filter(m => selectedWordIndex >= m.errorStart && selectedWordIndex <= m.errorEnd)
    : [];
  const currentPosInWord = markingsOnSelectedWord.findIndex(m => m._arrayIndex === selectedMarking);

  function goToPrevMarking() {
    const idx = (currentPosInWord - 1 + markingsOnSelectedWord.length) % markingsOnSelectedWord.length;
    setSelectedMarking(markingsOnSelectedWord[idx]._arrayIndex);
  }

  function goToNextMarking() {
    const idx = (currentPosInWord + 1) % markingsOnSelectedWord.length;
    setSelectedMarking(markingsOnSelectedWord[idx]._arrayIndex);
  }

  function shouldShowMarkingPopup() {
    return selectedMarking !== null || selection !== null;
  }

  return (
    <div className="col-sm-10 markingText tw-select-text tw-whitespace-normal">
      {text.trim().replace(/\s+/g, " ").split(" ").map((word, wordIndex) => (
        <Fragment key={wordIndex}>
          {wordIndex > 0 && <span className="tw-select-none"> </span>}
          <span
            id={wordIndex}
            className={getClassByIndex(wordIndex)}
            onContextMenu={isSource || readOnly ? (e) => e.preventDefault() : getContextMenuByIndex(wordIndex)}
            onDoubleClick={(e) => {
              const textNode = Array.from(e.currentTarget.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
              if (textNode) {
                const range = document.createRange();
                range.selectNode(textNode);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
              }
            }}
          >
            {word}
            {!isSource && !readOnly && annotationMarkings.some(m => wordIndex >= m.errorStart && wordIndex <= m.errorEnd) && (
              <button
                className="tw-ml-0.5 tw-text-[9px] tw-font-bold tw-bg-white tw-text-gray-700 tw-rounded-full tw-w-3 tw-h-3 tw-inline-flex tw-items-center tw-justify-center tw-select-none tw-border-0 tw-p-0 tw-cursor-pointer"
                title="Add another annotation"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedWordIndex(null);
                  setSelectedMarking(null);
                  setSelection({ start: wordIndex, end: wordIndex });
                  setMouseX(e.clientX);
                  setMouseY(e.clientY);
                }}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                +
              </button>
            )}
          </span>
        </Fragment>
      ))}
      {!isSource && !readOnly && (
        <ClickOutsideListener
          enabled={shouldShowMarkingPopup()}
          onClickOutside={(_) => {
            setSelectedMarking(null);
            setSelectedWordIndex(null);
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
              markingPosition={currentPosInWord >= 0 ? currentPosInWord + 1 : 1}
              markingCount={markingsOnSelectedWord.length}
              onPrevMarking={goToPrevMarking}
              onNextMarking={goToNextMarking}
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
