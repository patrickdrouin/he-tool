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

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  const [overlappingIndices, setOverlappingIndices] = useState([]);
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

  const SEVERITY_ORDER = ["critical", "major", "minor", "not-judgeable", "no-error"];

  function getMarkingsAtIndex(index) {
    return annotationMarkings
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => index >= m.errorStart && index <= m.errorEnd);
  }

  function getClassByIndex(index) {
    const matches = getMarkingsAtIndex(index);
    if (matches.length === 0) return undefined;
    matches.sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.m.errorSeverity) -
        SEVERITY_ORDER.indexOf(b.m.errorSeverity),
    );
    const base = getClassBySeverity(matches[0].m.errorSeverity);
    // Double underline indicates overlapping markings
    return matches.length > 1 ? `${base} tw-underline tw-decoration-double` : base;
  }

  function cycleOverlap(dir) {
    const pos = overlappingIndices.indexOf(selectedMarking);
    const next = (pos + dir + overlappingIndices.length) % overlappingIndices.length;
    setSelectedMarking(overlappingIndices[next]);
  }

  function getContextMenuByIndex(index) {
    const matches = getMarkingsAtIndex(index);

    if (matches.length > 0) {
      return (e) => {
        e.preventDefault();
        const indices = matches.map(({ i }) => i);
        setOverlappingIndices(indices);
        setSelectedMarking(indices[0]);
        setMouseX(e.clientX);
        setMouseY(e.clientY);
      };
    }

    return (e) => {
      e.preventDefault();

      const selection = window.getSelection();
      if (selection.isCollapsed) return;

      let start = parseInt(selection.anchorNode.parentElement.id);
      let end = parseInt(selection.focusNode.parentElement.id);
      if (start > end) [start, end] = [end, start];

      if (isNaN(start) || isNaN(end)) {
        toast.error("Selection is invalid. Please select carefully and try again.");
        return;
      }

      setOverlappingIndices([]);
      setSelection(selection);
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
  }

  function shouldShowMarkingPopup() {
    return selectedMarking !== null || selection !== null;
  }

  return (
    <div className="col-sm-10 markingText tw-select-text tw-whitespace-pre-wrap" onContextMenu={(e) => e.preventDefault()}>
      {text.split(" ").map((word, wordIndex) => {
        return (
          <span
            id={wordIndex}
            className={getClassByIndex(wordIndex)}
            onContextMenu={isSource || readOnly ? (e) => e.preventDefault() : getContextMenuByIndex(wordIndex)}
          >
            {word.concat(" ")}
          </span>
        );
      })}
      {!isSource && !readOnly && (
        <ClickOutsideListener
          enabled={shouldShowMarkingPopup()}
          onClickOutside={(_) => {
            setSelectedMarking(null);
            setOverlappingIndices([]);
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
              overlapIndex={overlappingIndices.length > 1 ? overlappingIndices.indexOf(selectedMarking) + 1 : null}
              overlapTotal={overlappingIndices.length > 1 ? overlappingIndices.length : null}
              onPrevOverlap={() => cycleOverlap(-1)}
              onNextOverlap={() => cycleOverlap(1)}
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
